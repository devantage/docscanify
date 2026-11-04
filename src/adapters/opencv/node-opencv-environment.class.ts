import {
  OPENCV_LOAD_TIMEOUT_MESSAGE,
  OPENCV_LOAD_TIMEOUT_MS,
} from './opencv.constants';
import type { OpenCv, OpenCvModule } from './opencv.interface';
import type { OpenCvEnvironment } from './opencv-environment.interface';

/** Loads `@techstark/opencv-js` from the package. */
export class NodeOpenCvEnvironment implements OpenCvEnvironment {
  /**
   * Loads the package and waits for its runtime to start.
   *
   * @returns OpenCV, ready to use
   * @throws if the package cannot be loaded or if its runtime takes too long to
   * start
   */
  public async load(): Promise<OpenCv> {
    return new Promise<OpenCv>(
      (resolve: (cv: OpenCv) => void, reject: (error: Error) => void): void => {
        const timer: NodeJS.Timeout = setTimeout((): void => {
          reject(new Error(OPENCV_LOAD_TIMEOUT_MESSAGE));
        }, OPENCV_LOAD_TIMEOUT_MS);

        try {
          // Loaded on demand because parsing it slows down the process startup
          const cvModule: OpenCvModule =
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            require('@techstark/opencv-js') as OpenCvModule;

          if (!cvModule.then) {
            // Already initialized by a previous attempt that timed out
            clearTimeout(timer);
            resolve(cvModule);

            return;
          }

          cvModule.then((cv: OpenCvModule): void => {
            clearTimeout(timer);
            delete cv.then;
            resolve(cv);
          });
        } catch (error: unknown) {
          clearTimeout(timer);
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      },
    );
  }
}
