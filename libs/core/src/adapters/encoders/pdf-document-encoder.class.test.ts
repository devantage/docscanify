import { type Canvas, createCanvas } from '@napi-rs/canvas';
import { PDFDocument, type PDFPage } from 'pdf-lib';

import { createDocumentPhoto } from '../../test-helpers';
import { CanvasImage } from '../canvas/canvas-image.class';
import { JpegImageEncoder } from './jpeg-image-encoder.class';
import {
  PdfDocumentEncoder,
  type PdfDocumentEncoderOptions,
  type PdfPageLayout,
} from './pdf-document-encoder.class';

async function getPage(pdf: Uint8Array): Promise<PDFPage> {
  return (await PDFDocument.load(pdf)).getPage(0);
}

describe('PdfDocumentEncoder', (): void => {
  const canvas: Canvas = createCanvas(300, 600);

  it('declares its format', (): void => {
    expect(new PdfDocumentEncoder().mimeType).toBe('application/pdf');
    expect(new PdfDocumentEncoder().fileExtension).toBe('pdf');
  });

  it('creates an A4 page without margin by default', async (): Promise<void> => {
    const page: PDFPage = await getPage(
      await new PdfDocumentEncoder().encode(new CanvasImage(canvas).toPng()),
    );

    expect(page.getSize()).toEqual({ width: 595.28, height: 841.89 });
  });

  it('applies the options', async (): Promise<void> => {
    const page: PDFPage = await getPage(
      await new PdfDocumentEncoder({
        pageFormat: 'image',
        margin: 10,
        imageDpi: 300,
      }).encode(new CanvasImage(canvas).toPng()),
    );

    expect(page.getWidth()).toBeCloseTo((300 * 72) / 300 + 20);
    expect(page.getHeight()).toBeCloseTo((600 * 72) / 300 + 20);
  });

  it('rotates the page for landscape images', async (): Promise<void> => {
    const page: PDFPage = await getPage(
      await new PdfDocumentEncoder({ pageFormat: 'letter' }).encode(
        new CanvasImage(createCanvas(600, 300)).toPng(),
      ),
    );

    expect(page.getSize()).toEqual({ width: 792, height: 612 });
  });

  it('sizes the page to the image at 150 DPI plus margins', async (): Promise<void> => {
    const page: PDFPage = await getPage(
      await new PdfDocumentEncoder({ pageFormat: 'image', margin: 10 }).encode(
        new CanvasImage(canvas).toPng(),
      ),
    );

    expect(page.getSize()).toEqual({ width: 164, height: 308 });
  });

  it('embeds the PNG by default', async (): Promise<void> => {
    const embedPngSpy: jest.SpyInstance = jest.spyOn(
      PDFDocument.prototype,
      'embedPng',
    );

    await new PdfDocumentEncoder().encode(new CanvasImage(canvas).toPng());

    expect(embedPngSpy).toHaveBeenCalled();
    embedPngSpy.mockRestore();
  });

  it('embeds a JPEG when given a JPEG encoder', async (): Promise<void> => {
    const embedJpgSpy: jest.SpyInstance = jest.spyOn(
      PDFDocument.prototype,
      'embedJpg',
    );

    await new PdfDocumentEncoder({
      imageEncoder: new JpegImageEncoder({ quality: 50 }),
    }).encode(new CanvasImage(canvas).toPng());

    expect(embedJpgSpy).toHaveBeenCalled();
    embedJpgSpy.mockRestore();
  });

  it('is much smaller with a JPEG encoder for a photo', async (): Promise<void> => {
    const photo: Uint8Array = new CanvasImage(
      createDocumentPhoto().canvas,
    ).toPng();
    const png: Uint8Array = await new PdfDocumentEncoder().encode(photo);
    const jpeg: Uint8Array = await new PdfDocumentEncoder({
      imageEncoder: new JpegImageEncoder({ quality: 50 }),
    }).encode(photo);

    expect(jpeg.length).toBeLessThan(png.length);
  });

  it('rejects an image encoder of a format a PDF cannot embed', async (): Promise<void> => {
    await expect(
      new PdfDocumentEncoder({
        imageEncoder: {
          mimeType: 'image/webp',
          fileExtension: 'webp',
          encode: async (png: Uint8Array): Promise<Uint8Array> =>
            Promise.resolve(png),
        },
      }).encode(new CanvasImage(canvas).toPng()),
    ).rejects.toThrow('A PDF can only embed a JPEG or a PNG');
  });

  it.each([
    ['imageDpi', { imageDpi: 0 }, 'imageDpi must be a positive number'],
    ['imageDpi', { imageDpi: NaN }, 'imageDpi must be a positive number'],
    ['margin', { margin: -1 }, 'The margin must leave room'],
    ['margin', { margin: NaN }, 'The margin must leave room'],
    ['margin', { margin: 1000 }, 'The margin must leave room'],
  ])(
    'rejects an invalid %s: %j',
    (_: string, options: PdfDocumentEncoderOptions, message: string): void => {
      expect((): void => {
        new PdfDocumentEncoder(options);
      }).toThrow(message);
    },
  );

  it('accepts any margin when the page is sized to the image', (): void => {
    expect((): void => {
      new PdfDocumentEncoder({ pageFormat: 'image', margin: 1000 });
    }).not.toThrow();
  });
  describe('getPageLayout', (): void => {
    it('centers the image on the page, as large as it fits, without margin by default', (): void => {
      const layout: PdfPageLayout = new PdfDocumentEncoder().getPageLayout({
        width: 300,
        height: 600,
      });

      // A4 is 595.28 × 841.89 pt: the height limits a 1:2 image to 420.945 × 841.89
      expect(layout.page).toEqual({ width: 595.28, height: 841.89 });
      expect(layout.image.width).toBeCloseTo(420.945);
      expect(layout.image.height).toBeCloseTo(841.89);
      expect(layout.image.x).toBeCloseTo((595.28 - 420.945) / 2);
      expect(layout.image.y).toBeCloseTo(0);
    });

    it('keeps the image inside the margins, centered', (): void => {
      const layout: PdfPageLayout = new PdfDocumentEncoder({
        pageFormat: 'letter',
        margin: 36,
      }).getPageLayout({ width: 1000, height: 1000 });

      // Letter is 612 × 792 pt: the width leaves 540 pt for a square image
      expect(layout.page).toEqual({ width: 612, height: 792 });
      expect(layout.image).toEqual({ x: 36, y: 126, width: 540, height: 540 });
    });

    it('turns a fixed page to landscape for a wide image', (): void => {
      const layout: PdfPageLayout = new PdfDocumentEncoder({
        pageFormat: 'a4',
      }).getPageLayout({ width: 600, height: 300 });

      expect(layout.page).toEqual({ width: 841.89, height: 595.28 });
    });

    it('sizes the page to the image at the DPI plus the margins, with the image filling the rest', (): void => {
      const layout: PdfPageLayout = new PdfDocumentEncoder({
        pageFormat: 'image',
        margin: 10,
        imageDpi: 300,
      }).getPageLayout({ width: 300, height: 600 });

      expect(layout.page.width).toBeCloseTo(72 + 20);
      expect(layout.page.height).toBeCloseTo(144 + 20);
      expect(layout.image.x).toBeCloseTo(10);
      expect(layout.image.y).toBeCloseTo(10);
      expect(layout.image.width).toBeCloseTo(72);
      expect(layout.image.height).toBeCloseTo(144);
    });

    it.each<PdfDocumentEncoderOptions>([
      {},
      { pageFormat: 'letter', margin: 50 },
      { pageFormat: 'image', margin: 25 },
    ])(
      'describes the page encode makes, with %o',
      async (options: PdfDocumentEncoderOptions): Promise<void> => {
        const encoder: PdfDocumentEncoder = new PdfDocumentEncoder(options);
        const page: PDFPage = await getPage(
          await encoder.encode(new CanvasImage(canvas).toPng()),
        );

        const { page: expected } = encoder.getPageLayout({
          width: canvas.width,
          height: canvas.height,
        });
        expect(page.getWidth()).toBeCloseTo(expected.width);
        expect(page.getHeight()).toBeCloseTo(expected.height);
      },
    );
  });
});
