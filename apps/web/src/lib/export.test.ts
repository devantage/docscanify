import type {
  PdfDocumentEncoderOptions,
  PdfPageArea,
} from '@devantage/docscanify';
import { type UnzipFileInfo, unzipSync } from 'fflate';
import { PDFDocument, type PDFPage } from 'pdf-lib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_EXPORT_SETTINGS,
  downloadFile,
  exportDocuments,
  type ExportedFile,
  type ExportItem,
  type PdfPagePreview,
  pdfPagePreview,
} from './export';
import type { ExportSettings } from './types';

interface ConstructedEncoder {
  kind: 'pdf' | 'png' | 'jpg';
  options: unknown;
}

/**
 * Fake docscanify encoders. The PDF one makes a real single-page PDF whose page width is
 * 100 + the first byte of the render, so the order of merged pages can be read back; it checks
 * its options and lays out pages as the real encoder does.
 */
const fakes: {
  constructed: ConstructedEncoder[];
  encoded: { kind: string; input: Uint8Array }[];
} = vi.hoisted(
  (): {
    constructed: ConstructedEncoder[];
    encoded: { kind: string; input: Uint8Array }[];
  } => ({ constructed: [], encoded: [] }),
);

vi.mock('@devantage/docscanify', async (): Promise<Record<string, unknown>> => {
  const core: typeof import('@devantage/docscanify') = await vi.importActual(
    '@devantage/docscanify',
  );
  class PdfDocumentEncoder extends core.PdfDocumentEncoder {
    public constructor(options: PdfDocumentEncoderOptions) {
      super(options);
      fakes.constructed.push({ kind: 'pdf', options });
    }
    public override async encode(png: Uint8Array): Promise<Uint8Array> {
      fakes.encoded.push({ kind: 'pdf', input: png });
      const { PDFDocument: Pdf } = await import('pdf-lib');
      const pdf: PDFDocument = await Pdf.create();
      pdf.addPage([100 + png[0], 200]);
      return pdf.save();
    }
  }
  class PngImageEncoder {
    public readonly mimeType: string = 'image/png';
    public readonly fileExtension: string = 'png';
    public constructor() {
      fakes.constructed.push({ kind: 'png', options: undefined });
    }
    public async encode(png: Uint8Array): Promise<Uint8Array> {
      fakes.encoded.push({ kind: 'png', input: png });
      return Promise.resolve(png);
    }
  }
  class JpegImageEncoder {
    public readonly mimeType: string = 'image/jpeg';
    public readonly fileExtension: string = 'jpg';
    public constructor(options: unknown) {
      fakes.constructed.push({ kind: 'jpg', options });
    }
    public async encode(png: Uint8Array): Promise<Uint8Array> {
      fakes.encoded.push({ kind: 'jpg', input: png });
      // Marks the bytes as encoded, to tell them apart from the render
      return Promise.resolve(new Uint8Array([0xff, 0xd8, ...png]));
    }
  }
  return { PdfDocumentEncoder, PngImageEncoder, JpegImageEncoder };
});

// image.ts imports scan.ts, which needs OpenCV adapters: not used by the export
vi.mock('./scan', (): Record<string, unknown> => ({}));

const NOW: Date = new Date('2026-03-04T05:06:07.890Z');
const STAMP: string = '202603040506';

/** A document whose render is the bytes [id, id + 1]. */
function item(name: string, id: number): ExportItem {
  return {
    name,
    render: async (): Promise<Uint8Array> =>
      Promise.resolve(new Uint8Array([id, id + 1])),
  };
}

/** The default export settings, with the given ones changed. */
function settings(overrides: Partial<ExportSettings>): ExportSettings {
  return { ...DEFAULT_EXPORT_SETTINGS, ...overrides };
}

/** Reads the bytes of an exported blob. */
async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer());
}

/** ZIP entries in archive order, with their compression method (0 = stored). */
function zipEntries(
  zip: Uint8Array,
): { name: string; compression: number; bytes: Uint8Array }[] {
  const infos: UnzipFileInfo[] = [];
  const files: Record<string, Uint8Array> = unzipSync(zip, {
    filter: (info: UnzipFileInfo): boolean => {
      infos.push(info);
      return true;
    },
  });
  return infos.map(
    (
      info: UnzipFileInfo,
    ): { name: string; compression: number; bytes: Uint8Array } => ({
      name: info.name,
      compression: info.compression,
      bytes: files[info.name],
    }),
  );
}

/** Width of each page of a PDF, in points: the fake encoder derives it from the render. */
async function pageWidths(pdfBytes: Uint8Array): Promise<number[]> {
  const pdf: PDFDocument = await PDFDocument.load(pdfBytes);
  return pdf.getPages().map((page: PDFPage): number => page.getWidth());
}

beforeEach((): void => {
  fakes.constructed.length = 0;
  fakes.encoded.length = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('DEFAULT_EXPORT_SETTINGS', (): void => {
  it('is an A4 PDF without margins, combining every document', (): void => {
    expect(DEFAULT_EXPORT_SETTINGS).toEqual({
      format: 'pdf',
      pageFormat: 'a4',
      margins: 0,
      combine: true,
    });
  });
});

describe('exportDocuments', (): void => {
  describe('encoder choice', (): void => {
    it('builds the PDF encoder with the page format and the margins converted from cm to points', async (): Promise<void> => {
      await exportDocuments(
        [item('a', 1)],
        settings({ format: 'pdf', pageFormat: 'letter', margins: 1 }),
        { batchName: 'scan' },
      );

      expect(fakes.constructed).toHaveLength(1);
      expect(fakes.constructed[0].kind).toBe('pdf');
      const options: { pageFormat: string; margin: number } = fakes
        .constructed[0].options as { pageFormat: string; margin: number };
      expect(options.pageFormat).toBe('letter');
      // 1 cm = 1 / 2.54 in = 28.3465 pt
      expect(options.margin).toBeCloseTo(28.346456, 5);
    });

    it('converts 2.54 cm to exactly 72 points and keeps zero margins at zero', async (): Promise<void> => {
      await exportDocuments(
        [item('a', 1)],
        settings({ pageFormat: 'image', margins: 2.54 }),
        { batchName: 'scan' },
      );
      await exportDocuments([item('a', 1)], settings({ margins: 0 }), {
        batchName: 'scan',
      });

      expect(
        fakes.constructed.map((c: ConstructedEncoder): unknown => c.options),
      ).toEqual([
        { pageFormat: 'image', margin: expect.closeTo(72, 10) as number },
        { pageFormat: 'a4', margin: 0 },
      ]);
    });

    it('uses the PNG encoder for PNG', async (): Promise<void> => {
      await exportDocuments([item('a', 1)], settings({ format: 'png' }), {
        batchName: 'scan',
      });

      expect(fakes.constructed).toEqual([{ kind: 'png', options: undefined }]);
    });

    it('uses the JPEG encoder at quality 100 for JPG', async (): Promise<void> => {
      await exportDocuments([item('a', 1)], settings({ format: 'jpg' }), {
        batchName: 'scan',
      });

      expect(fakes.constructed).toEqual([
        { kind: 'jpg', options: { quality: 100 } },
      ]);
    });

    it('creates a single encoder for every document and encodes each render once, in order', async (): Promise<void> => {
      await exportDocuments(
        [item('a', 1), item('b', 5), item('c', 9)],
        settings({ format: 'png' }),
        { batchName: 'scan' },
      );

      expect(fakes.constructed).toHaveLength(1);
      expect(
        fakes.encoded.map(
          (e: { kind: string; input: Uint8Array }): number[] => [...e.input],
        ),
      ).toEqual([
        [1, 2],
        [5, 6],
        [9, 10],
      ]);
    });
  });

  describe('a single document', (): void => {
    it('exports a PDF named after the document', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('receipt', 1)],
        settings({ format: 'pdf' }),
        { batchName: 'scan' },
      );

      expect(file.fileName).toBe('receipt.pdf');
      expect(file.blob.type).toBe('application/pdf');
      expect(await pageWidths(await bytesOf(file.blob))).toEqual([101]);
    });

    it('exports a PDF, not a ZIP, even when combine is off', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('receipt', 1)],
        settings({ format: 'pdf', combine: false }),
        { batchName: 'scan' },
      );

      expect(file.fileName).toBe('receipt.pdf');
      expect(file.blob.type).toBe('application/pdf');
    });

    it('exports the PNG bytes as they come from the encoder', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('photo', 7)],
        settings({ format: 'png' }),
        { batchName: 'scan' },
      );

      expect(file.fileName).toBe('photo.png');
      expect(file.blob.type).toBe('image/png');
      expect([...(await bytesOf(file.blob))]).toEqual([7, 8]);
    });

    it('exports a JPG with the .jpg extension and the JPEG MIME type', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('photo', 7)],
        settings({ format: 'jpg' }),
        { batchName: 'scan' },
      );

      expect(file.fileName).toBe('photo.jpg');
      expect(file.blob.type).toBe('image/jpeg');
      expect([...(await bytesOf(file.blob))]).toEqual([0xff, 0xd8, 7, 8]);
    });
  });

  describe('several documents as a combined PDF', (): void => {
    it('merges them into one PDF with one page per document, in list order', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('c', 30), item('a', 10), item('b', 20)],
        settings({ format: 'pdf', combine: true }),
        { batchName: 'scan' },
      );

      expect(file.blob.type).toBe('application/pdf');
      expect(await pageWidths(await bytesOf(file.blob))).toEqual([
        130, 110, 120,
      ]);
    });

    it('names the PDF with the batch name and the UTC date and time', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('a', 1), item('b', 2)],
        settings({ format: 'pdf', combine: true }),
        { batchName: 'documents' },
      );

      expect(file.fileName).toBe(`documents-${STAMP}.pdf`);
    });
  });

  describe('several documents in a ZIP', (): void => {
    it('puts one PDF per document in a ZIP when combine is off, numbered in list order', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('invoice', 10), item('contract', 20), item('invoice', 30)],
        settings({ format: 'pdf', combine: false }),
        { batchName: 'scan' },
      );

      expect(file.fileName).toBe(`scan-${STAMP}.zip`);
      expect(file.blob.type).toBe('application/zip');
      const entries: {
        name: string;
        compression: number;
        bytes: Uint8Array;
      }[] = zipEntries(await bytesOf(file.blob));
      expect(entries.map((e: { name: string }): string => e.name)).toEqual([
        '1-invoice.pdf',
        '2-contract.pdf',
        '3-invoice.pdf',
      ]);
      const widths: number[][] = await Promise.all(
        entries.map(async (e: { bytes: Uint8Array }): Promise<number[]> =>
          pageWidths(e.bytes),
        ),
      );
      expect(widths).toEqual([[110], [120], [130]]);
    });

    it.each(['png', 'jpg'] as const)(
      'puts one %s per document in a ZIP, with the encoded bytes',
      async (format: 'png' | 'jpg'): Promise<void> => {
        const file: ExportedFile = await exportDocuments(
          [item('front', 1), item('back', 3)],
          // combine only applies to PDF
          settings({ format, combine: true }),
          { batchName: 'scan' },
        );

        expect(file.fileName).toBe(`scan-${STAMP}.zip`);
        expect(file.blob.type).toBe('application/zip');
        const entries: { name: string; bytes: Uint8Array }[] = zipEntries(
          await bytesOf(file.blob),
        );
        const prefix: number[] = format === 'jpg' ? [0xff, 0xd8] : [];
        expect(
          entries.map(
            (e: { name: string; bytes: Uint8Array }): [string, number[]] => [
              e.name,
              [...e.bytes],
            ],
          ),
        ).toEqual([
          [`1-front.${format}`, [...prefix, 1, 2]],
          [`2-back.${format}`, [...prefix, 3, 4]],
        ]);
      },
    );

    it('stores the files without compression', async (): Promise<void> => {
      const file: ExportedFile = await exportDocuments(
        [item('a', 1), item('b', 2)],
        settings({ format: 'png' }),
        { batchName: 'scan' },
      );

      expect(
        zipEntries(await bytesOf(file.blob)).map(
          (e: { compression: number }): number => e.compression,
        ),
      ).toEqual([0, 0]);
    });

    it('pads the numbers to the digits of the document count', async (): Promise<void> => {
      const items: ExportItem[] = Array.from(
        { length: 10 },
        (_: unknown, i: number): ExportItem => item(`page${String(i)}`, i),
      );

      const file: ExportedFile = await exportDocuments(
        items,
        settings({ format: 'png' }),
        { batchName: 'scan' },
      );

      expect(
        zipEntries(await bytesOf(file.blob)).map(
          (e: { name: string }): string => e.name,
        ),
      ).toEqual([
        '01-page0.png',
        '02-page1.png',
        '03-page2.png',
        '04-page3.png',
        '05-page4.png',
        '06-page5.png',
        '07-page6.png',
        '08-page7.png',
        '09-page8.png',
        '10-page9.png',
      ]);
    });

    it('does not pad the numbers with up to nine documents', async (): Promise<void> => {
      const items: ExportItem[] = Array.from(
        { length: 9 },
        (_: unknown, i: number): ExportItem => item('doc', i),
      );

      const file: ExportedFile = await exportDocuments(
        items,
        settings({ format: 'jpg' }),
        { batchName: 'scan' },
      );

      const names: string[] = zipEntries(await bytesOf(file.blob)).map(
        (e: { name: string }): string => e.name,
      );
      expect(names[0]).toBe('1-doc.jpg');
      expect(names[8]).toBe('9-doc.jpg');
    });
  });

  describe('progress', (): void => {
    it('reports before each document and once more when all are done, before the final file', async (): Promise<void> => {
      const log: string[] = [];
      const tracked = (name: string, id: number): ExportItem => ({
        name,
        render: async (): Promise<Uint8Array> => {
          log.push(`render ${name}`);
          return Promise.resolve(new Uint8Array([id]));
        },
      });

      await exportDocuments(
        [tracked('a', 1), tracked('b', 2), tracked('c', 3)],
        settings({ format: 'png' }),
        {
          batchName: 'scan',
          onProgress: (done: number, total: number): void => {
            log.push(`progress ${String(done)}/${String(total)}`);
          },
        },
      );

      expect(log).toEqual([
        'progress 0/3',
        'render a',
        'progress 1/3',
        'render b',
        'progress 2/3',
        'render c',
        'progress 3/3',
      ]);
    });

    it('reports 0/1 and 1/1 for a single document', async (): Promise<void> => {
      const onProgress: (done: number, total: number) => void = vi.fn();

      await exportDocuments([item('a', 1)], settings({}), {
        batchName: 'scan',
        onProgress,
      });

      expect(vi.mocked(onProgress).mock.calls).toEqual([
        [0, 1],
        [1, 1],
      ]);
    });

    it('works without a progress callback', async (): Promise<void> => {
      await expect(
        exportDocuments([item('a', 1), item('b', 2)], settings({}), {
          batchName: 'scan',
        }),
      ).resolves.toMatchObject({ fileName: `scan-${STAMP}.pdf` });
    });
  });

  it('fails when a render fails, without rendering the next documents', async (): Promise<void> => {
    const error: Error = new Error('render failed');
    const third: ExportItem = item('c', 3);
    const renderThird: () => Promise<Uint8Array> = vi.fn(third.render);

    await expect(
      exportDocuments(
        [
          item('a', 1),
          {
            name: 'b',
            render: async (): Promise<Uint8Array> => Promise.reject(error),
          },
          { name: 'c', render: renderThird },
        ],
        settings({ format: 'png' }),
        { batchName: 'scan' },
      ),
    ).rejects.toBe(error);
    expect(renderThird).not.toHaveBeenCalled();
  });
});

/** Checks a rectangle on the page, to a thousandth of a point. */
function expectArea(actual: PdfPageArea, expected: PdfPageArea): void {
  expect(actual.x).toBeCloseTo(expected.x, 3);
  expect(actual.y).toBeCloseTo(expected.y, 3);
  expect(actual.width).toBeCloseTo(expected.width, 3);
  expect(actual.height).toBeCloseTo(expected.height, 3);
}

describe('pdfPagePreview', (): void => {
  it('lays a portrait render on a portrait A4 page, filling its width without margins', (): void => {
    const preview: PdfPagePreview = pdfPagePreview(settings({}), {
      width: 1000,
      height: 1500,
    });

    expect(preview.pageFormat).toBe('a4');
    expect(preview.margin).toBe(0);
    expect(preview.layout.page).toEqual({ width: 595.28, height: 841.89 });
    // 595.28 / 1000 pt per pixel: 892.92 pt tall would not fit, so the height decides
    const scale: number = 841.89 / 1500;
    expectArea(preview.layout.image, {
      x: (595.28 - 1000 * scale) / 2,
      y: 0,
      width: 1000 * scale,
      height: 841.89,
    });
  });

  it('turns the A4 page to landscape for a wide render', (): void => {
    const preview: PdfPagePreview = pdfPagePreview(settings({}), {
      width: 1600,
      height: 900,
    });

    expect(preview.layout.page).toEqual({ width: 841.89, height: 595.28 });
    expectArea(preview.layout.image, {
      x: 0,
      y: (595.28 - 900 * (841.89 / 1600)) / 2,
      width: 841.89,
      height: 900 * (841.89 / 1600),
    });
  });

  it('keeps the margins, converted from cm to points, around the render on a Letter page', (): void => {
    const preview: PdfPagePreview = pdfPagePreview(
      settings({ pageFormat: 'letter', margins: 2.54 }),
      { width: 800, height: 800 },
    );

    expect(preview.pageFormat).toBe('letter');
    expect(preview.margin).toBeCloseTo(72, 10);
    expect(preview.layout.page).toEqual({ width: 612, height: 792 });
    // A square inside 468 × 648 pt: 468 pt wide, centered down the page
    expectArea(preview.layout.image, {
      x: 72,
      y: 162,
      width: 468,
      height: 468,
    });
  });

  it('makes a page the size of the render at 150 dpi, plus the margins', (): void => {
    const preview: PdfPagePreview = pdfPagePreview(
      settings({ pageFormat: 'image', margins: 1 }),
      { width: 1500, height: 3000 },
    );

    const margin: number = 72 / 2.54;
    expect(preview.margin).toBeCloseTo(margin, 10);
    // 1500 px at 150 dpi = 10 in = 720 pt
    expect(preview.layout.page.width).toBeCloseTo(720 + margin * 2, 10);
    expect(preview.layout.page.height).toBeCloseTo(1440 + margin * 2, 10);
    expectArea(preview.layout.image, {
      x: margin,
      y: margin,
      width: 720,
      height: 1440,
    });
  });

  it('lays out the page with the encoder the export uses', async (): Promise<void> => {
    const exportSettings: ExportSettings = settings({
      pageFormat: 'letter',
      margins: 1.5,
    });

    pdfPagePreview(exportSettings, { width: 10, height: 20 });
    await exportDocuments([item('a', 1)], exportSettings, {
      batchName: 'scan',
    });

    expect(fakes.constructed).toHaveLength(2);
    expect(fakes.constructed[0]).toEqual(fakes.constructed[1]);
  });
});

describe('downloadFile', (): void => {
  const createObjectURL: typeof URL.createObjectURL = URL.createObjectURL;
  const revokeObjectURL: typeof URL.revokeObjectURL = URL.revokeObjectURL;
  let created: Blob[];
  let revoked: string[];

  beforeEach((): void => {
    vi.useFakeTimers();
    created = [];
    revoked = [];
    URL.createObjectURL = (blob: Blob | MediaSource): string => {
      created.push(blob as Blob);
      return 'blob:http://localhost/file-1';
    };
    URL.revokeObjectURL = (url: string): void => {
      revoked.push(url);
    };
  });

  afterEach((): void => {
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = revokeObjectURL;
    vi.useRealTimers();
  });

  it('clicks a temporary link to the object URL with the file name to download', (): void => {
    const blob: Blob = new Blob(['%PDF'], { type: 'application/pdf' });
    const clicks: {
      href: string;
      download: string;
      connected: boolean;
    }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ): void {
      clicks.push({
        href: this.href,
        download: this.download,
        connected: this.isConnected,
      });
    });

    downloadFile({ blob, fileName: 'scan-202603040506.pdf' });

    expect(created).toHaveLength(1);
    expect(created[0]).toBe(blob);
    expect(clicks).toEqual([
      {
        href: 'blob:http://localhost/file-1',
        download: 'scan-202603040506.pdf',
        connected: true,
      },
    ]);
    // The link is removed right after the click
    expect(document.querySelector('a')).toBeNull();
  });

  it('revokes the object URL 10 seconds after the click, not before', (): void => {
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      (): void => undefined,
    );

    downloadFile({ blob: new Blob(['x']), fileName: 'a.png' });

    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(9_999);
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(revoked).toEqual(['blob:http://localhost/file-1']);
  });
});
