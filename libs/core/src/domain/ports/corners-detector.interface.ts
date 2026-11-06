import type { Corners } from '../models/corners.interface';

/** Finds the document in an image. */
export interface CornersDetector {
  /**
   * Looks for the document in an image.
   *
   * @param buffer a copy of the image, always a PNG
   * @returns the corners in the coordinate system of the image, or `null` if
   * there is no document
   */
  detect(buffer: Uint8Array): Promise<Corners | null>;
}
