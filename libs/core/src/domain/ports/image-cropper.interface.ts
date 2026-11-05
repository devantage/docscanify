import type { Corners } from '../models/corners.interface';

/** Crops the document from an image and corrects its perspective. */
export interface ImageCropper {
  /**
   * Crops the document, removing the perspective of the photo.
   *
   * @param buffer a copy of the image, always a PNG
   * @param corners the corners of the document, in the coordinate system of the
   * image
   * @returns the cropped document, as a PNG
   */
  crop(buffer: Uint8Array, corners: Corners): Promise<Uint8Array>;
}
