import type { ExportFormat } from './export-format.interface';

/** A file made from the document. */
export interface ExportedFile extends ExportFormat {
  /** The file, as returned by the encoder */
  buffer: Uint8Array;
}
