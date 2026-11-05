/** An OpenCV object, whose memory the garbage collector does not release. */
export interface OpenCvDeletable {
  /** Releases the memory of the object. */
  delete(): void;
}

/**
 * The loaded module is a thenable that resolves to itself. It must lose its
 * `then` before being resolved from a promise, otherwise the promise never
 * settles.
 */
export type OpenCvModule = OpenCv & {
  /**
   * Calls back when the runtime has started.
   *
   * @param callback receives the module
   */
  then?(callback: (cv: OpenCvModule) => void): void;
};

/** An image or a matrix, in the memory of OpenCV. */
export interface OpenCvMat extends OpenCvDeletable {
  rows: number;

  cols: number;

  /** The values, for a Mat of 8 bit channels */
  data: Uint8Array;

  /** The values, for a Mat of 32 bit integers */
  data32S: Int32Array;

  /**
   * Counts the channels.
   *
   * @returns the number of channels of each pixel
   */
  channels(): number;

  /**
   * Copies the Mat.
   *
   * @returns a new Mat to delete
   */
  clone(): OpenCvMat;

  /**
   * Copies the Mat to another one.
   *
   * @param dst receives the copy
   */
  copyTo(dst: OpenCvMat): void;

  /**
   * Reads a value of a Mat of 8 bit channels.
   *
   * @param row the row
   * @param col the column
   * @returns the value
   */
  ucharAt(row: number, col: number): number;
}

/** A list of Mats, in the memory of OpenCV. */
export interface OpenCvMatVector extends OpenCvDeletable {
  /**
   * Counts the Mats.
   *
   * @returns the number of Mats
   */
  size(): number;

  /**
   * Gets a Mat of the list.
   *
   * @param index its position in the list
   * @returns a Mat to delete
   */
  get(index: number): OpenCvMat;
}

/** Dimensions, as OpenCV receives them. */
export interface OpenCvSize {
  width: number;

  height: number;
}

/** A point, as OpenCV receives it. */
export interface OpenCvPoint {
  x: number;

  y: number;
}

/** The result of `minAreaRect`. */
export interface OpenCvRotatedRect {
  center: OpenCvPoint;
}

/** The pixels OpenCV reads an image from. */
export interface OpenCvImageData {
  data: ArrayLike<number>;

  width: number;

  height: number;
}

/** The result of `minMaxLoc`. */
export interface OpenCvMinMaxLocation {
  minVal: number;

  maxVal: number;
}

/** An OpenCV exception, once read from its pointer. */
export interface OpenCvException {
  msg: string;
}

/**
 * The subset of the OpenCV.js API used by the OpenCV adapters of this package.
 * Names and arguments are the ones of OpenCV, where `dst` receives the result.
 */
export interface OpenCv {
  /** Creates an empty Mat, which must be deleted */
  Mat: new () => OpenCvMat;

  /** Creates an empty list of Mats, which must be deleted */
  MatVector: new () => OpenCvMatVector;

  /** Creates dimensions */
  Size: new (width: number, height: number) => OpenCvSize;

  /** Creates a point */
  Point: new (x: number, y: number) => OpenCvPoint;

  /** Creates a value for each channel, all of them 0 */
  Scalar: new () => unknown;

  ADAPTIVE_THRESH_GAUSSIAN_C: number;

  BORDER_CONSTANT: number;

  CHAIN_APPROX_SIMPLE: number;

  COLOR_GRAY2RGBA: number;

  COLOR_RGB2RGBA: number;

  COLOR_RGBA2GRAY: number;

  COLOR_RGBA2RGB: number;

  CV_32FC2: number;

  INTER_AREA: number;

  INTER_LINEAR: number;

  MORPH_CLOSE: number;

  MORPH_OPEN: number;

  MORPH_RECT: number;

  NORM_MINMAX: number;

  RETR_CCOMP: number;

  RETR_LIST: number;

  ROTATE_180: number;

  ROTATE_90_CLOCKWISE: number;

  ROTATE_90_COUNTERCLOCKWISE: number;

  THRESH_BINARY: number;

  THRESH_BINARY_INV: number;

  THRESH_OTSU: number;

  /**
   * Reads an exception, which OpenCV.js throws as a pointer.
   *
   * @param pointer what was thrown
   * @returns the exception
   */
  exceptionFromPtr(pointer: number): OpenCvException;

  /**
   * Copies pixels to a new RGBA Mat.
   *
   * @param imageData the pixels
   * @returns a Mat to delete
   */
  matFromImageData(imageData: OpenCvImageData): OpenCvMat;

  /**
   * Copies values to a new Mat.
   *
   * @param rows the number of rows
   * @param cols the number of columns
   * @param type the type of the values, such as `CV_32FC2`
   * @param values the values, row by row
   * @returns a Mat to delete
   */
  matFromArray(
    rows: number,
    cols: number,
    type: number,
    values: number[],
  ): OpenCvMat;

  /**
   * Finds the transform that takes 4 points to 4 others.
   *
   * @param src where the points are
   * @param dst where the points must end up
   * @returns the matrix of the transform, in a Mat to delete
   */
  getPerspectiveTransform(src: OpenCvMat, dst: OpenCvMat): OpenCvMat;

  /**
   * Applies a perspective transform to an image.
   *
   * @param src the image
   * @param dst receives the result
   * @param matrix the transform
   * @param size the dimensions of the result
   * @param flags the interpolation
   * @param borderMode what to do with pixels from outside of the image
   * @param borderValue the value of those pixels, with `BORDER_CONSTANT`
   */
  warpPerspective(
    src: OpenCvMat,
    dst: OpenCvMat,
    matrix: OpenCvMat,
    size: OpenCvSize,
    flags: number,
    borderMode: number,
    borderValue: unknown,
  ): void;

  /**
   * Finds the smallest rectangle around some points.
   *
   * @param points the points
   * @returns the rectangle
   */
  minAreaRect(points: OpenCvMat): OpenCvRotatedRect;

  /**
   * Resizes an image.
   *
   * @param src the image
   * @param dst receives the result
   * @param size the dimensions of the result
   * @param fx the horizontal factor, if `size` is 0
   * @param fy the vertical factor, if `size` is 0
   * @param interpolation how to calculate the new pixels
   */
  resize(
    src: OpenCvMat,
    dst: OpenCvMat,
    size: OpenCvSize,
    fx: number,
    fy: number,
    interpolation: number,
  ): void;

  /**
   * Converts an image from a color space to another.
   *
   * @param src the image
   * @param dst receives the result
   * @param code the conversion, such as `COLOR_RGBA2GRAY`
   */
  cvtColor(src: OpenCvMat, dst: OpenCvMat, code: number): void;

  /**
   * Creates a kernel for the morphological operations.
   *
   * @param shape the shape, such as `MORPH_RECT`
   * @param size the dimensions of the kernel
   * @returns a Mat to delete
   */
  getStructuringElement(shape: number, size: OpenCvSize): OpenCvMat;

  /**
   * Applies a morphological operation.
   *
   * @param src the image
   * @param dst receives the result
   * @param operation the operation, such as `MORPH_CLOSE`
   * @param kernel the kernel
   * @param anchor the position of the anchor in the kernel, (-1, -1) for its
   * center
   * @param iterations how many times to apply it
   */
  morphologyEx(
    src: OpenCvMat,
    dst: OpenCvMat,
    operation: number,
    kernel: OpenCvMat,
    anchor: OpenCvPoint,
    iterations: number,
  ): void;

  /**
   * Blurs an image.
   *
   * @param src the image
   * @param dst receives the result
   * @param size the side of the kernel. With 0, it comes from the sigma
   * @param sigmaX the sigma. With 0, it comes from the side of the kernel
   */
  GaussianBlur(
    src: OpenCvMat,
    dst: OpenCvMat,
    size: OpenCvSize,
    sigmaX: number,
  ): void;

  /**
   * Smooths an image preserving its edges. It does not accept 4 channels.
   *
   * @param src the image
   * @param dst receives the result
   * @param diameter the size of the neighborhood of each pixel
   * @param sigmaColor how different two colors can be and still get mixed
   * @param sigmaSpace how far two pixels can be and still get mixed
   */
  bilateralFilter(
    src: OpenCvMat,
    dst: OpenCvMat,
    diameter: number,
    sigmaColor: number,
    sigmaSpace: number,
  ): void;

  /**
   * Adds two images: `src1 * alpha + src2 * beta + gamma`.
   *
   * @param src1 the first image
   * @param alpha the weight of the first image
   * @param src2 the second image
   * @param beta the weight of the second image
   * @param gamma what to add to the result
   * @param dst receives the result
   */
  addWeighted(
    src1: OpenCvMat,
    alpha: number,
    src2: OpenCvMat,
    beta: number,
    gamma: number,
    dst: OpenCvMat,
  ): void;

  /**
   * Rotates an image in multiples of 90 degrees.
   *
   * @param src the image
   * @param dst receives the result
   * @param rotateCode the rotation, such as `ROTATE_180`
   */
  rotate(src: OpenCvMat, dst: OpenCvMat, rotateCode: number): void;

  /**
   * Finds the lowest and the highest value of a single channel Mat.
   *
   * @param src the Mat
   * @param mask which values to consider. An empty Mat considers all of them
   * @returns the values
   */
  minMaxLoc(src: OpenCvMat, mask: OpenCvMat): OpenCvMinMaxLocation;

  /**
   * Stretches the values of a Mat to a range.
   *
   * @param src the Mat
   * @param dst receives the result
   * @param alpha the start of the range, with `NORM_MINMAX`
   * @param beta the end of the range, with `NORM_MINMAX`
   * @param normType the kind of normalization
   */
  normalize(
    src: OpenCvMat,
    dst: OpenCvMat,
    alpha: number,
    beta: number,
    normType: number,
  ): void;

  /**
   * Separates an image in two tones, by a fixed threshold or one it finds.
   *
   * @param src the image
   * @param dst receives the result
   * @param threshold the threshold, ignored with `THRESH_OTSU`
   * @param maxValue the value of the bright tone
   * @param type the kind of threshold
   * @returns the threshold used
   */
  threshold(
    src: OpenCvMat,
    dst: OpenCvMat,
    threshold: number,
    maxValue: number,
    type: number,
  ): number;

  /**
   * Separates an image in two tones, comparing each pixel to its neighbors.
   *
   * @param src the image
   * @param dst receives the result
   * @param maxValue the value of the bright tone
   * @param adaptiveMethod how to calculate the threshold of each pixel
   * @param thresholdType the kind of threshold
   * @param blockSize the size of the neighborhood, which must be odd
   * @param constant what to subtract from the threshold
   */
  adaptiveThreshold(
    src: OpenCvMat,
    dst: OpenCvMat,
    maxValue: number,
    adaptiveMethod: number,
    thresholdType: number,
    blockSize: number,
    constant: number,
  ): void;

  /**
   * Finds the edges of an image.
   *
   * @param src the image
   * @param dst receives the mask of the edges
   * @param threshold1 the lower threshold
   * @param threshold2 the upper threshold
   */
  Canny(
    src: OpenCvMat,
    dst: OpenCvMat,
    threshold1: number,
    threshold2: number,
  ): void;

  /**
   * Thickens the bright areas of an image.
   *
   * @param src the image
   * @param dst receives the result
   * @param kernel the kernel
   * @param anchor the position of the anchor in the kernel, (-1, -1) for its
   * center
   * @param iterations how many times to apply it
   */
  dilate(
    src: OpenCvMat,
    dst: OpenCvMat,
    kernel: OpenCvMat,
    anchor: OpenCvPoint,
    iterations: number,
  ): void;

  /**
   * Finds the contours of a mask, which this OpenCV.js version may modify.
   *
   * @param image the mask
   * @param contours receives the contours
   * @param hierarchy receives how the contours are nested
   * @param mode which contours to find, such as `RETR_LIST`
   * @param method how to store the points, such as `CHAIN_APPROX_SIMPLE`
   */
  findContours(
    image: OpenCvMat,
    contours: OpenCvMatVector,
    hierarchy: OpenCvMat,
    mode: number,
    method: number,
  ): void;

  /**
   * Measures the area of a contour.
   *
   * @param contour the contour
   * @returns the area, in square pixels
   */
  contourArea(contour: OpenCvMat): number;

  /**
   * Finds the convex hull of some points.
   *
   * @param points the points
   * @param hull receives the hull
   * @param clockwise the direction of the hull
   * @param returnPoints whether the hull has points, instead of their indexes
   */
  convexHull(
    points: OpenCvMat,
    hull: OpenCvMat,
    clockwise: boolean,
    returnPoints: boolean,
  ): void;

  /**
   * Measures the length of a curve.
   *
   * @param curve the curve
   * @param closed whether the curve is closed
   * @returns the length, in pixels
   */
  arcLength(curve: OpenCvMat, closed: boolean): number;

  /**
   * Approximates a curve as a polygon.
   *
   * @param curve the curve
   * @param approx receives the polygon
   * @param epsilon the largest distance between the curve and the polygon
   * @param closed whether the curve is closed
   */
  approxPolyDP(
    curve: OpenCvMat,
    approx: OpenCvMat,
    epsilon: number,
    closed: boolean,
  ): void;

  /**
   * Checks if a contour is convex.
   *
   * @param contour the contour
   * @returns whether it is convex
   */
  isContourConvex(contour: OpenCvMat): boolean;
}
