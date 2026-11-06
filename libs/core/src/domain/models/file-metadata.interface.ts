import type { ImageDimensions } from './image-dimensions.interface';

/** The characteristics of a file. */
export interface FileMetadata {
  /** The name given to the file, or `null` */
  name: string | null;

  /** For example, `image/png` */
  mimeType: string;

  /** Dimensions of the image, in pixels */
  dimensions: ImageDimensions;

  /** File size, in bytes */
  size: number;
}
