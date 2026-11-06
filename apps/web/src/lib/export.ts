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
const POINTS_PER_MM: number = 72 / 25.4;

/** Initial export options, restored on every new scan. */
export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margin: 0,
  combine: true,
};

/** A document to export. */
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

/** A file ready to download. */
export interface ExportedFile {
  blob: Blob;
  fileName: string;
}

interface EncodedFile {
  bytes: Uint8Array;
  mimeType: string;
}

/** The encoder of the chosen format. */
function createEncoder(settings: ExportSettings): DocumentEncoder {
  if (settings.format === 'pdf') {
    return new PdfDocumentEncoder({
      pageFormat: settings.pageFormat,
      margin: settings.margin * POINTS_PER_MM,
    });
  }
  return settings.format === 'png'
    ? new PngImageEncoder()
    : new JpegImageEncoder({ quality: 100 });
}

/** Encodes one rendered document in the chosen format. */
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

const toBlob = (bytes: Uint8Array, type: string): Blob =>
  new Blob([bytes as Uint8Array<ArrayBuffer>], { type });

/**
 * Builds the final file for the documents, cropped and with each one's adjustments.
 *
 * - One document: its own file, with its own name.
 * - Several as PDF with `combine`: a single PDF, one page per document, in list order.
 * - Several otherwise: a ZIP with one file per document, numbered in list order.
 *
 * @param items Documents, in list order.
 * @param settings Format and, for PDF, page, margin, and whether to combine everything.
 * @param options
 * - `batchName`: base name of the file with several documents, before the date.
 * - `onProgress`: called before each document with how many are done and the total, and once
 *   more, with every document done, before the final file is put together.
 * @returns The file and the name it should be downloaded with.
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
 * Downloads a file through a temporary link.
 *
 * @param file File and the name to save it with.
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
