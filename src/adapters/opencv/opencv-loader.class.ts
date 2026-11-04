import { Runtime } from '../runtime.class';
import { BrowserOpenCvEnvironment } from './browser-opencv-environment.class';
import { NodeOpenCvEnvironment } from './node-opencv-environment.class';
import type { OpenCv } from './opencv.interface';

/** What can be chosen when loading OpenCV. */
export interface OpenCvLoaderOptions {
  /** URL of the opencv.js file. Required on browsers, ignored on Node.js */
  scriptUrl?: string;
}

/** Loads the default OpenCV implementation, `@techstark/opencv-js`, once per process or page. */
export class OpenCvLoader {
  private static _loading: Promise<OpenCv> | undefined;

  /**
   * Loads OpenCV on the first call. Later calls get the same module, ignoring
   * their options, unless the load failed.
   *
   * @param options on browsers, must have the URL of the opencv.js file
   * @returns OpenCV, ready to use
   * @throws if OpenCV cannot be loaded
   */
  public static async load(options: OpenCvLoaderOptions = {}): Promise<OpenCv> {
    if (!OpenCvLoader._loading) {
      OpenCvLoader._loading = (
        Runtime.isNode()
          ? new NodeOpenCvEnvironment()
          : new BrowserOpenCvEnvironment()
      ).load(options.scriptUrl);

      // On failure, allow a retry on the next call
      OpenCvLoader._loading.catch((): void => {
        OpenCvLoader._loading = undefined;
      });
    }

    return OpenCvLoader._loading;
  }
}
