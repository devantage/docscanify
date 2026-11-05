import type { ImageDimensions } from '../../domain/models';
import { MAX_PIXEL_VALUE } from './opencv.constants';
import type { OpenCv, OpenCvMat, OpenCvMatVector } from './opencv.interface';
import type { OpenCvResources } from './opencv-resources.class';

/** The OpenCV operations shared by the adapters. Every result is released with the resources. */
export class OpenCvOperations {
  private readonly _cv: OpenCv;

  private readonly _resources: OpenCvResources;

  /**
   * Creates the operations of a block of work.
   *
   * @param cv OpenCV
   * @param resources what releases the results
   */
  public constructor(cv: OpenCv, resources: OpenCvResources) {
    this._cv = cv;
    this._resources = resources;
  }

  /**
   * Converts an image to grayscale.
   *
   * @param mat a RGBA Mat
   * @returns a single channel Mat
   */
  public toGray(mat: OpenCvMat): OpenCvMat {
    const gray: OpenCvMat = this._resources.createMat();

    this._cv.cvtColor(mat, gray, this._cv.COLOR_RGBA2GRAY);

    return gray;
  }

  /**
   * Applies a Gaussian blur, with a sigma derived from the side of the kernel.
   *
   * @param mat the image
   * @param kernelSide the side of the kernel, which must be odd
   * @returns the blurred image
   */
  public blur(mat: OpenCvMat, kernelSide: number): OpenCvMat {
    const blurred: OpenCvMat = this._resources.createMat();

    this._cv.GaussianBlur(
      mat,
      blurred,
      new this._cv.Size(kernelSide, kernelSide),
      0,
    );

    return blurred;
  }

  /**
   * Resizes an image with area interpolation.
   *
   * @param mat the image
   * @param dimensions the dimensions of the result
   * @returns the resized image
   */
  public resize(mat: OpenCvMat, dimensions: ImageDimensions): OpenCvMat {
    const resized: OpenCvMat = this._resources.createMat();

    this._cv.resize(
      mat,
      resized,
      new this._cv.Size(dimensions.width, dimensions.height),
      0,
      0,
      this._cv.INTER_AREA,
    );

    return resized;
  }

  /**
   * Separates an image in two tones, finding the threshold with the Otsu
   * method.
   *
   * @param mat a single channel Mat
   * @param thresholdType `THRESH_BINARY` or `THRESH_BINARY_INV`
   * @returns the mask
   */
  public applyOtsu(mat: OpenCvMat, thresholdType: number): OpenCvMat {
    const mask: OpenCvMat = this._resources.createMat();

    this._cv.threshold(
      mat,
      mask,
      0,
      MAX_PIXEL_VALUE,
      thresholdType + this._cv.THRESH_OTSU,
    );

    return mask;
  }

  /**
   * Finds the contours of a mask, which this OpenCV.js version may modify.
   *
   * @param mask a single channel Mat
   * @param mode `RETR_LIST`, `RETR_CCOMP`...
   * @returns the contours
   */
  public findContours(mask: OpenCvMat, mode: number): OpenCvMat[] {
    const contours: OpenCvMatVector = this._resources.createMatVector();

    this._cv.findContours(
      mask,
      contours,
      this._resources.createMat(),
      mode,
      this._cv.CHAIN_APPROX_SIMPLE,
    );

    return Array.from(
      { length: contours.size() },
      (_: unknown, index: number): OpenCvMat =>
        this._resources.track(contours.get(index)),
    );
  }
}
