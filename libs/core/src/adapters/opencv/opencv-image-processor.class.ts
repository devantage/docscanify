import { CanvasImage } from '../canvas/canvas-image.class';
import type { OpenCv, OpenCvMat } from './opencv.interface';
import { OpenCvImageConverter } from './opencv-image-converter.class';
import { OpenCvLoader, type OpenCvLoaderOptions } from './opencv-loader.class';
import { OpenCvOperations } from './opencv-operations.class';
import { OpenCvResources } from './opencv-resources.class';

/** What an operation has available to work on an image. */
export interface OpenCvImageContext {
  cv: OpenCv;

  /** The image as a RGBA Mat */
  mat: OpenCvMat;

  /** Creates the OpenCV objects of the operation, which are released at its end */
  resources: OpenCvResources;

  operations: OpenCvOperations;
}

/**
 * Takes care of everything around an OpenCV operation: loads OpenCV, decodes the
 * buffer, reports its failures as errors and releases the memory.
 */
export class OpenCvImageProcessor {
  private readonly _options: OpenCvLoaderOptions;

  /**
   * Creates the processor. OpenCV is only loaded when it is used.
   *
   * @param options on browsers, must have the URL of the opencv.js file
   */
  public constructor(options: OpenCvLoaderOptions = {}) {
    this._options = options;
  }

  /**
   * Runs an operation that reads the image.
   *
   * @template TResult what the operation finds, which cannot depend on the
   * resources of the operation
   * @param buffer the image, as a PNG
   * @param operation what to run
   * @returns what the operation returned
   * @throws if OpenCV cannot be loaded, the image cannot be read or the
   * operation fails
   */
  public async inspect<TResult>(
    buffer: Uint8Array,
    operation: (context: OpenCvImageContext) => TResult,
  ): Promise<TResult> {
    const cv: OpenCv = await OpenCvLoader.load(this._options);
    const canvasImage: CanvasImage = await CanvasImage.fromBuffer(buffer);
    const resources: OpenCvResources = new OpenCvResources(cv);

    try {
      return operation({
        cv,
        mat: resources.track(OpenCvImageConverter.toMat(cv, canvasImage)),
        resources,
        operations: new OpenCvOperations(cv, resources),
      });
    } catch (error: unknown) {
      throw this.toError(cv, error);
    } finally {
      resources.release();
    }
  }

  /**
   * Runs an operation that creates a new image, and encodes it as a PNG.
   *
   * @param buffer the image, as a PNG
   * @param operation returns the new image, as a RGBA or single channel Mat
   * @returns the new image, as a PNG
   * @throws if OpenCV cannot be loaded, the image cannot be read or the
   * operation fails
   */
  public async transform(
    buffer: Uint8Array,
    operation: (context: OpenCvImageContext) => OpenCvMat,
  ): Promise<Uint8Array> {
    return this.inspect(buffer, (context: OpenCvImageContext): Uint8Array =>
      OpenCvImageConverter.toCanvasImage(
        context.cv,
        operation(context),
      ).toPng(),
    );
  }

  /**
   * Reads what OpenCV.js threw, because it throws its exceptions as pointers.
   *
   * @param cv OpenCV
   * @param error what was caught
   * @returns an `Error` with the message of a pointer, or what was caught if it
   * is not a pointer
   */
  private toError(cv: OpenCv, error: unknown): unknown {
    return typeof error === 'number'
      ? new Error(cv.exceptionFromPtr(error).msg)
      : error;
  }
}
