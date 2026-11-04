import { OpenCvImageProcessor } from './opencv-image-processor.class';
import type { OpenCvLoaderOptions } from './opencv-loader.class';

/** What can be chosen for an OpenCV adapter. */
export type OpenCvAdapterOptions = OpenCvLoaderOptions;

/** A port implemented with OpenCV. */
export abstract class OpenCvAdapter {
  protected readonly _imageProcessor: OpenCvImageProcessor;

  /**
   * Creates the adapter. OpenCV is only loaded when the adapter is used.
   *
   * @param options on browsers, must have the URL of the opencv.js file
   */
  public constructor(options: OpenCvAdapterOptions = {}) {
    this._imageProcessor = new OpenCvImageProcessor(options);
  }
}
