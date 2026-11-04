import { CanvasImageDecoder } from './adapters/decoders/canvas-image-decoder.class';
import { PdfDocumentEncoder } from './adapters/encoders/pdf-document-encoder.class';
import { PngImageEncoder } from './adapters/encoders/png-image-encoder.class';
import type { OpenCvAdapterOptions } from './adapters/opencv/opencv-adapter.class';
import { OpenCvCornersDetector } from './adapters/opencv/opencv-corners-detector.class';
import { OpenCvImageCropper } from './adapters/opencv/opencv-image-cropper.class';
import { OpenCvImageResizer } from './adapters/opencv/opencv-image-resizer.class';
import type { ScannedDocumentAdapters } from './domain/ports';

/**
 * Creates the adapters of this package, ready to use. Replace any of them with
 * your own.
 *
 * @param options on browsers, must have the URL of the opencv.js file
 * @returns one adapter for each port the document needs
 */
export function createDefaultAdapters(
  options: OpenCvAdapterOptions = {},
): ScannedDocumentAdapters {
  return {
    imageDecoder: new CanvasImageDecoder(),
    imageResizer: new OpenCvImageResizer(options),
    cornersDetector: new OpenCvCornersDetector(options),
    imageCropper: new OpenCvImageCropper(options),
    imageEncoder: new PngImageEncoder(),
    pdfEncoder: new PdfDocumentEncoder(),
  };
}

/** The adapters of this package for Node.js. */
export const DEFAULT_ADAPTERS: ScannedDocumentAdapters =
  createDefaultAdapters();
