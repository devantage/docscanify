/** The value of a white pixel in a single channel Mat. */
export const MAX_PIXEL_VALUE: number = 255;

/** How long to wait for OpenCV to load. */
export const OPENCV_LOAD_TIMEOUT_MS: number = 60_000;

/** The error of an OpenCV that took too long to load. */
export const OPENCV_LOAD_TIMEOUT_MESSAGE: string =
  'Timed out loading OpenCV.js';
