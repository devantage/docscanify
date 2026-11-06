import type { DocumentEncoder } from './document-encoder.interface';

/** Exports the document as a PDF. */
export interface PdfEncoder extends DocumentEncoder {
  /**
   * Makes the PDF from the document.
   *
   * @param buffer a copy of the document, always a PNG
   * @returns the exported PDF
   */
  encode(buffer: Uint8Array): Promise<Uint8Array>;
}
