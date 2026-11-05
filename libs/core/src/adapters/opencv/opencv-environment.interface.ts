import type { OpenCv } from './opencv.interface';

/** What changes in loading OpenCV from one environment to another. */
export interface OpenCvEnvironment {
  /**
   * Loads OpenCV.
   *
   * @param scriptUrl URL of the opencv.js file. Required on browsers, ignored
   * on Node.js
   * @returns OpenCV, ready to use
   */
  load(scriptUrl?: string): Promise<OpenCv>;
}
