import type { ImageDimensions } from '../../domain/models';

/** An image as a list of pixels. */
export interface RawImage {
  dimensions: ImageDimensions;

  /** RGBA pixels */
  data: ArrayLike<number>;
}
