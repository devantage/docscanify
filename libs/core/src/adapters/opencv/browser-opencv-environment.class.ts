import {
  OPENCV_LOAD_TIMEOUT_MESSAGE,
  OPENCV_LOAD_TIMEOUT_MS,
} from './opencv.constants';
import type { OpenCv, OpenCvModule } from './opencv.interface';
import type { OpenCvEnvironment } from './opencv-environment.interface';

const POLL_INTERVAL_MS: number = 50;

/** Loads OpenCV.js from a script tag, which keeps its 9 MB out of the application bundle. */
export class BrowserOpenCvEnvironment implements OpenCvEnvironment {
  /**
   * Loads OpenCV.js, unless the page already has it.
   *
   * @param scriptUrl URL of the opencv.js file. Required if the page does not
   * have it yet
   * @returns OpenCV, ready to use
   * @throws if there is no `scriptUrl`, if the script fails to load or if its
   * runtime takes too long to start
   */
  public async load(scriptUrl?: string): Promise<OpenCv> {
    const ready: OpenCv | null = this.getReady();

    if (ready) {
      return ready;
    }

    if (!scriptUrl) {
      throw new Error(
        'The scriptUrl option is required to load OpenCV.js on browsers',
      );
    }

    return new Promise<OpenCv>(
      (resolve: (cv: OpenCv) => void, reject: (error: Error) => void): void => {
        const script: HTMLScriptElement = document.createElement('script');

        script.src = scriptUrl;
        script.async = true;

        script.onerror = (): void => {
          script.remove();
          reject(new Error(`Failed to load OpenCV.js from ${scriptUrl}`));
        };

        script.onload = (): void => {
          // The WASM runtime initializes asynchronously after the script loads
          const startedAt: number = Date.now();
          const timer: ReturnType<typeof setInterval> = setInterval(
            (): void => {
              const cv: OpenCv | null = this.getReady();

              if (cv) {
                clearInterval(timer);
                resolve(cv);
              } else if (Date.now() - startedAt > OPENCV_LOAD_TIMEOUT_MS) {
                clearInterval(timer);
                reject(new Error(OPENCV_LOAD_TIMEOUT_MESSAGE));
              }
            },
            POLL_INTERVAL_MS,
          );
        };

        document.head.appendChild(script);
      },
    );
  }

  /**
   * Looks for an OpenCV.js that finished starting on the page.
   *
   * @returns OpenCV, or `null` if it is not ready
   */
  private getReady(): OpenCv | null {
    const { cv } = window as unknown as { cv?: OpenCvModule };

    if (typeof cv?.Mat !== 'function') {
      return null;
    }

    // See OpenCvModule
    delete cv.then;

    return cv;
  }
}
