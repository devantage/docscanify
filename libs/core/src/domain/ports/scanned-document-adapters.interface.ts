import type { CornersDetector } from './corners-detector.interface';
import type { ImageCropper } from './image-cropper.interface';
import type { ImageDecoder } from './image-decoder.interface';
import type { ImageEncoder } from './image-encoder.interface';
import type { ImageResizer } from './image-resizer.interface';
import type { PdfEncoder } from './pdf-encoder.interface';

/** Everything the document needs to work with images. */
export interface ScannedDocumentAdapters {
  /** Reads the received file */
  imageDecoder: ImageDecoder;

  /** Shrinks an image larger than `maxDimension` */
  imageResizer: ImageResizer;

  /** Used by `detectCorners` when it receives no corners detector */
  cornersDetector: CornersDetector;

  /** Crops the document when rendering or exporting */
  imageCropper: ImageCropper;

  /** Used by `toImage` when it receives no encoder */
  imageEncoder: ImageEncoder;

  /** Used by `toPdf` when it receives no encoder */
  pdfEncoder: PdfEncoder;
}
