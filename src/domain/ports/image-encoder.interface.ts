import type { DocumentEncoder } from './document-encoder.interface';

/** Exports the document as an image. */
export interface ImageEncoder extends DocumentEncoder {
  /**
   * Makes the image from the document.
   *
   * @param buffer a copy of the document, always a PNG
   * @returns the exported image
   */
  encode(buffer: Uint8Array): Promise<Uint8Array>;
}
