import {
  type DocumentEncoder,
  JpegImageEncoder,
  PdfDocumentEncoder,
  PngImageEncoder,
} from '@devantage/docscanify';
import { zipSync } from 'fflate';
import { PDFDocument, type PDFPage } from 'pdf-lib';

import { fileStamp } from './image';
import type { ExportSettings } from './types';

/** The PDF encoder measures margins in typographic points (1/72 inch). */
const POINTS_PER_CM: number = 72 / 2.54;

/** Initial export options, restored on every new scan. */
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margins: 0,
  combine: true,
};

export interface ExportItem {
  /** Base file name, without extension. */
  name: string;
  /**
   * The document cropped and with its adjustments, as PNG. Encoding a render gives the same
   * file as `ScannedDocument.toPdf`/`toImage`, which render and encode in one go, so a render
   * that already exists does not need to run again.
   */
  render(): Promise<Uint8Array>;
}

export interface ExportedFile {
  blob: Blob;
  fileName: string;
}

interface EncodedFile {
  bytes: Uint8Array;
  mimeType: string;
}

/**
 * Picks the docscanify encoder for the export format. The PDF margins are converted from
 * centimeters to points; JPG uses the highest quality.
 */
function createEncoder(settings: ExportSettings): DocumentEncoder {
  if (settings.format === 'pdf') {
    return new PdfDocumentEncoder({
      pageFormat: settings.pageFormat,
      margin: settings.margins * POINTS_PER_CM,
    });
  }
  return settings.format === 'png'
    ? new PngImageEncoder()
    : new JpegImageEncoder({ quality: 100 });
}

/** Renders a document and encodes the render, keeping the MIME type of the result. */
async function encode(
  item: ExportItem,
  encoder: DocumentEncoder,
): Promise<EncodedFile> {
  return {
    bytes: await encoder.encode(await item.render()),
    mimeType: encoder.mimeType,
  };
}

/** Merges single-page PDFs into one PDF, in the given order. */
async function mergePdfs(pdfs: Uint8Array[]): Promise<Uint8Array> {
  const merged: PDFDocument = await PDFDocument.create();
  for (const bytes of pdfs) {
    const pdf: PDFDocument = await PDFDocument.load(bytes);
    const pages: PDFPage[] = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach((page: PDFPage) => merged.addPage(page));
  }
  return merged.save();
}

/** Wraps encoded bytes in a Blob of the given MIME type, for download. */
const toBlob = (bytes: Uint8Array, type: string): Blob =>
  new Blob([bytes as Uint8Array<ArrayBuffer>], { type });

/**
 * Builds the final file for the documents, cropped and with each one's adjustments.
 *
 * - One document: its own file, with its own name.
 * - Several as PDF with `combine`: a single PDF, one page per document, in list order.
 * - Several otherwise: a ZIP with one file per document, numbered in list order.
 *
 * @param options
 * - `batchName`: base name of the file with several documents, before the date.
 * - `onProgress`: called before each document with how many are done and the total, and once
 *   more, with every document done, before the final file is put together.
 */
export async function exportDocuments(
  items: ExportItem[],
  settings: ExportSettings,
  {
    batchName,
    onProgress,
  }: { batchName: string; onProgress?(done: number, total: number): void },
): Promise<ExportedFile> {
  const encoder: DocumentEncoder = createEncoder(settings);
  const encoded: EncodedFile[] = [];
  for (const [i, item] of items.entries()) {
    onProgress?.(i, items.length);
    encoded.push(await encode(item, encoder));
  }
  onProgress?.(items.length, items.length);

  if (items.length === 1) {
    return {
      blob: toBlob(encoded[0].bytes, encoded[0].mimeType),
      fileName: `${items[0].name}.${settings.format}`,
    };
  }

  const batchFile: string = `${batchName}-${fileStamp()}`;

  if (settings.format === 'pdf' && settings.combine) {
    const pdf: Uint8Array = await mergePdfs(
      encoded.map((e: EncodedFile) => e.bytes),
    );
    return {
      blob: toBlob(pdf, 'application/pdf'),
      fileName: `${batchFile}.pdf`,
    };
  }

  // Stored without compression: PDF, PNG, and JPG are already compressed
  const digits: number = String(items.length).length;
  const zip: Uint8Array = zipSync(
    Object.fromEntries(
      items.map((item: ExportItem, i: number) => [
        `${String(i + 1).padStart(digits, '0')}-${item.name}.${settings.format}`,
        [encoded[i].bytes, { level: 0 }],
      ]),
    ),
  );
  return { blob: toBlob(zip, 'application/zip'), fileName: `${batchFile}.zip` };
}

/**
 * Downloads a file through a temporary link, which is removed right after the click. Its object
 * URL is revoked 10 seconds later.
 */
export function downloadFile({ blob, fileName }: ExportedFile): void {
  const url: string = URL.createObjectURL(blob);
  const link: HTMLAnchorElement = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoked later: some browsers start reading the URL after click() returns
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 10_000);
}
