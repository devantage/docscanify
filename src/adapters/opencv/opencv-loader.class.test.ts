import type { OpenCv } from './opencv.interface';
import type { OpenCvAdapterOptions } from './opencv-adapter.class';

type Load = (options?: OpenCvAdapterOptions) => Promise<OpenCv>;

interface FakeScript {
  src: string;
  async: boolean;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  remove: jest.Mock;
}

type BrowserGlobals = { document?: unknown; window?: { cv?: unknown } };

const browser: BrowserGlobals = globalThis as BrowserGlobals;

const mockThen: jest.Mock = jest.fn();
const mockRequire: jest.Mock = jest.fn();

jest.mock('@techstark/opencv-js', () => {
  mockRequire();

  return { Mat: 'mat', then: mockThen };
});

/** A fresh copy of the class, because it keeps the loaded module in a static property. */
function getLoad(): Load {
  jest.resetModules();

  const { OpenCvLoader } = jest.requireActual<
    typeof import('./opencv-loader.class')
  >('./opencv-loader.class');

  return async (options?: OpenCvAdapterOptions): Promise<OpenCv> =>
    OpenCvLoader.load(options);
}

describe('OpenCvLoader', (): void => {
  afterEach((): void => {
    jest.useRealTimers();
  });

  describe('on Node.js', (): void => {
    beforeEach((): void => {
      mockThen.mockImplementation(function (
        this: unknown,
        callback: (cv: unknown) => void,
      ): void {
        callback(this);
      });
    });

    it('resolves the module without its self-resolving then', async (): Promise<void> => {
      const cv: OpenCv = await getLoad()();

      expect(cv.Mat).toBeDefined();
      expect(cv).not.toHaveProperty('then');
    });

    it('loads OpenCV.js only once', async (): Promise<void> => {
      const load: Load = getLoad();

      await expect(load()).resolves.toBe(await load());
      expect(mockRequire).toHaveBeenCalledTimes(1);
    });

    it('allows a retry after a failure', async (): Promise<void> => {
      const load: Load = getLoad();

      mockThen.mockImplementationOnce((): never => {
        throw new Error('load failed');
      });

      await expect(load()).rejects.toThrow('load failed');
      await expect(load()).resolves.toBeDefined();
    });

    it('wraps non-error failures into errors', async (): Promise<void> => {
      mockThen.mockImplementationOnce((): never => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'plain failure';
      });

      await expect(getLoad()()).rejects.toThrow('plain failure');
    });

    it('resolves a module that finished loading after a timed out attempt', async (): Promise<void> => {
      jest.useFakeTimers();

      let finishLoading: () => void = (): void => undefined;

      mockThen.mockImplementationOnce(function (
        this: unknown,
        callback: (cv: unknown) => void,
      ): void {
        finishLoading = (): void => {
          callback(this);
        };
      });

      const load: Load = getLoad();
      const timedOut: Promise<OpenCv> = load();

      jest.advanceTimersByTime(60_000);

      await expect(timedOut).rejects.toThrow('Timed out loading OpenCV.js');

      finishLoading();

      await expect(load()).resolves.toHaveProperty('Mat');
    });

    it('rejects when OpenCV.js takes too long to load', async (): Promise<void> => {
      jest.useFakeTimers();
      mockThen.mockImplementation((): void => undefined);

      const loading: Promise<OpenCv> = getLoad()();

      jest.advanceTimersByTime(60_000);

      await expect(loading).rejects.toThrow('Timed out loading OpenCV.js');
    });
  });

  describe('on browsers', (): void => {
    let script: FakeScript;
    let appendChild: jest.Mock;

    beforeEach((): void => {
      jest.useFakeTimers();

      script = {
        src: '',
        async: false,
        onload: null,
        onerror: null,
        remove: jest.fn(),
      };
      appendChild = jest.fn();
      browser.window = {};
      browser.document = {
        createElement: jest.fn().mockReturnValue(script),
        head: { appendChild },
      };
    });

    afterEach((): void => {
      delete browser.window;
      delete browser.document;
    });

    it('does not load the Node.js module', async (): Promise<void> => {
      const ready: { Mat: jest.Mock } = { Mat: jest.fn() };

      browser.window = { cv: ready };

      await expect(getLoad()({ scriptUrl: '/opencv.js' })).resolves.toBe(ready);
      expect(mockRequire).not.toHaveBeenCalled();
    });

    it('requires the script URL', async (): Promise<void> => {
      await expect(getLoad()()).rejects.toThrow('scriptUrl');
      expect(appendChild).not.toHaveBeenCalled();
    });

    it('resolves an already loaded OpenCV.js without its then', async (): Promise<void> => {
      browser.window = { cv: { Mat: jest.fn(), then: jest.fn() } };

      const cv: OpenCv = await getLoad()();

      expect(cv.Mat).toBeDefined();
      expect(cv).not.toHaveProperty('then');
      expect(appendChild).not.toHaveBeenCalled();
    });

    it('waits for the runtime to initialize after the script loads', async (): Promise<void> => {
      const loading: Promise<OpenCv> = getLoad()({ scriptUrl: '/opencv.js' });

      expect(script.src).toBe('/opencv.js');
      expect(appendChild).toHaveBeenCalledWith(script);

      // The global exists, but the runtime is still initializing
      browser.window = { cv: { then: jest.fn() } };
      script.onload?.();
      jest.advanceTimersByTime(100);

      browser.window = { cv: { Mat: jest.fn(), then: jest.fn() } };
      jest.advanceTimersByTime(100);

      const cv: OpenCv = await loading;

      expect(cv.Mat).toBeDefined();
      expect(cv).not.toHaveProperty('then');
    });

    it('rejects when the script fails to load', async (): Promise<void> => {
      const loading: Promise<OpenCv> = getLoad()({ scriptUrl: '/opencv.js' });

      script.onerror?.();

      await expect(loading).rejects.toThrow('/opencv.js');
      expect(script.remove).toHaveBeenCalled();
    });

    it('rejects when the runtime takes too long to initialize', async (): Promise<void> => {
      const loading: Promise<OpenCv> = getLoad()({ scriptUrl: '/opencv.js' });

      script.onload?.();
      jest.advanceTimersByTime(60_100);

      await expect(loading).rejects.toThrow('Timed out loading OpenCV.js');
    });
  });
});
