import type { Corners } from './corners.interface';
import type { FileMetadata } from './file-metadata.interface';
import type { ImageDimensions } from './image-dimensions.interface';

/** What was done to a document to get to an exported file. */
export interface ScanReport {
  /** The corners the document was cropped from, in the coordinate system of the original image, or `null` if it was not cropped */
  corners: Corners | null;

  /** Dimensions of the document, whatever the encoder does to it */
  dimensions: ImageDimensions;

  /** The file the document came from. Its dimensions are from before `maxDimension` */
  originalFile: FileMetadata;
}
