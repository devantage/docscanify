import type { ImageDimensions } from '../models/image-dimensions.interface';

/** Resizes an image. */
export interface ImageResizer {
  /**
   * Changes the dimensions of an image.
   *
   * @param buffer a copy of the image, always a PNG
   * @param dimensions the dimensions of the result
   * @returns the image in the given dimensions, as a PNG
   */
  resize(buffer: Uint8Array, dimensions: ImageDimensions): Promise<Uint8Array>;
}
