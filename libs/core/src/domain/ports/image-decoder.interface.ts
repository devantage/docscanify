import type { DecodedImage } from '../models';

/** Decodes the input of `ScannedDocument.fromImage`. */
export interface ImageDecoder {
  /**
   * Reads the received file.
   *
   * @param buffer a copy of the received file
   * @returns the image as a PNG and the format of the received file
   * @throws if it cannot read the file
   */
  decode(buffer: Uint8Array): Promise<DecodedImage>;
}
