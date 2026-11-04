import type { ExportFormat } from '../models/export-format.interface';

/** Exports the document to a file of the format it declares. */
export interface DocumentEncoder extends ExportFormat {
  /**
   * Makes the file from the document.
   *
   * @param buffer a copy of the document, always a PNG
   * @returns the exported file
   */
  encode(buffer: Uint8Array): Promise<Uint8Array>;
}
