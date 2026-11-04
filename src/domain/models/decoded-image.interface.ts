/** What an image decoder makes of the received file. */
export interface DecodedImage {
  /** The image, as a PNG */
  png: Uint8Array;

  /** The `mimeType` of the received file, kept in `originalFile` */
  originalMimeType: string;
}
