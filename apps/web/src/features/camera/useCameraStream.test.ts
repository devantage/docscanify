import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import type { CSSProperties, RefObject } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import {
  type CameraError,
  useCameraStream,
  type UseCameraStreamResult,
  useGuideBox,
} from './useCameraStream';

type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

interface FakeStream {
  stream: MediaStream;
  tracks: { stop: Mock<() => void> }[];
}

/** A camera stream with a video track and an extra track, both stoppable. */
function fakeStream(): FakeStream {
  const tracks: { stop: Mock<() => void> }[] = [
    { stop: vi.fn() },
    { stop: vi.fn() },
  ];
  const stream: MediaStream = {
    getTracks: (): MediaStreamTrack[] =>
      tracks as unknown as MediaStreamTrack[],
  } as unknown as MediaStream;
  return { stream, tracks };
}

/** Gives the page a camera API, as secure contexts (HTTPS, localhost) do. */
function installMediaDevices(getUserMedia: GetUserMedia | undefined): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  });
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>((r: (value: T) => void) => {
    resolve = r;
  });
  return { promise, resolve };
}

type StreamHook = RenderHookResult<UseCameraStreamResult, unknown>;

const renderStream = (ref: RefObject<HTMLVideoElement | null>): StreamHook =>
  renderHook(() => useCameraStream(ref));

describe('useCameraStream', (): void => {
  let video: HTMLVideoElement;
  let ref: RefObject<HTMLVideoElement | null>;
  let play: Mock<() => Promise<void>>;

  beforeEach((): void => {
    video = document.createElement('video');
    ref = { current: video };
    play = vi
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockResolvedValue(undefined);
  });

  afterEach((): void => {
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('asks for the rear camera in full HD, without audio', async (): Promise<void> => {
    const getUserMedia: Mock<GetUserMedia> = vi
      .fn<GetUserMedia>()
      .mockResolvedValue(fakeStream().stream);
    installMediaDevices(getUserMedia);

    const { result } = renderStream(ref);
    await waitFor((): void => {
      expect(result.current.ready).toBe(true);
    });

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledWith({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });
  });

  it('plays the camera in the video and becomes ready', async (): Promise<void> => {
    const { stream } = fakeStream();
    installMediaDevices(vi.fn<GetUserMedia>().mockResolvedValue(stream));

    const { result } = renderStream(ref);
    expect(result.current.ready).toBe(false);

    await waitFor((): void => {
      expect(result.current.ready).toBe(true);
    });
    expect(result.current.error).toBeNull();
    expect(video.srcObject).toBe(stream);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('reports the camera as unsupported without mediaDevices (insecure context)', async (): Promise<void> => {
    const { result } = renderStream(ref);

    await waitFor((): void => {
      expect(result.current.error).toBe('unsupported');
    });
    expect(result.current.ready).toBe(false);
    expect(play).not.toHaveBeenCalled();
  });

  it('reports the camera as unsupported when getUserMedia is missing', async (): Promise<void> => {
    installMediaDevices(undefined);

    const { result } = renderStream(ref);

    await waitFor((): void => {
      expect(result.current.error).toBe('unsupported');
    });
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'notFound'],
    ['OverconstrainedError', 'unknown'],
    ['NotReadableError', 'unknown'],
  ] as [string, CameraError][])(
    'maps a %s from getUserMedia to the %s error',
    async (name: string, expected: CameraError): Promise<void> => {
      installMediaDevices(
        vi
          .fn<GetUserMedia>()
          .mockRejectedValue(new DOMException('camera failed', name)),
      );

      const { result } = renderStream(ref);

      await waitFor((): void => {
        expect(result.current.error).toBe(expected);
      });
      expect(result.current.ready).toBe(false);
    },
  );

  it('reports an unknown error for a failure that is not a DOMException', async (): Promise<void> => {
    installMediaDevices(vi.fn<GetUserMedia>().mockRejectedValue(null));

    const { result } = renderStream(ref);

    await waitFor((): void => {
      expect(result.current.error).toBe('unknown');
    });
  });

  it('reports an error when the video cannot play', async (): Promise<void> => {
    installMediaDevices(
      vi.fn<GetUserMedia>().mockResolvedValue(fakeStream().stream),
    );
    play.mockRejectedValue(new DOMException('aborted', 'AbortError'));

    const { result } = renderStream(ref);

    await waitFor((): void => {
      expect(result.current.error).toBe('unknown');
    });
    expect(result.current.ready).toBe(false);
  });

  it('reports an error when the video element is not mounted', async (): Promise<void> => {
    installMediaDevices(
      vi.fn<GetUserMedia>().mockResolvedValue(fakeStream().stream),
    );

    const { result } = renderStream({ current: null });

    await waitFor((): void => {
      expect(result.current.error).toBe('unknown');
    });
  });

  it('turns every track off on stop, right away', async (): Promise<void> => {
    const { stream, tracks } = fakeStream();
    installMediaDevices(vi.fn<GetUserMedia>().mockResolvedValue(stream));
    const { result } = renderStream(ref);
    await waitFor((): void => {
      expect(result.current.ready).toBe(true);
    });

    act(() => {
      result.current.stop();
    });

    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(tracks[1].stop).toHaveBeenCalledTimes(1);
  });

  it('does nothing on stop before the camera opened', (): void => {
    installMediaDevices(
      vi.fn<GetUserMedia>().mockReturnValue(deferred<MediaStream>().promise),
    );
    const { result } = renderStream(ref);

    expect(() => {
      result.current.stop();
    }).not.toThrow();
  });

  it('turns every track off when unmounted', async (): Promise<void> => {
    const { stream, tracks } = fakeStream();
    installMediaDevices(vi.fn<GetUserMedia>().mockResolvedValue(stream));
    const { result, unmount } = renderStream(ref);
    await waitFor((): void => {
      expect(result.current.ready).toBe(true);
    });

    unmount();

    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(tracks[1].stop).toHaveBeenCalledTimes(1);
  });

  it('turns the camera off as soon as it opens when unmounted while it was opening', async (): Promise<void> => {
    const pending: Deferred<MediaStream> = deferred();
    installMediaDevices(vi.fn<GetUserMedia>().mockReturnValue(pending.promise));
    const { stream, tracks } = fakeStream();
    const { unmount } = renderStream(ref);

    unmount();
    await act(async () => {
      pending.resolve(stream);
      await pending.promise;
    });

    await waitFor((): void => {
      expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    });
    expect(tracks[1].stop).toHaveBeenCalledTimes(1);
    expect(video.srcObject).toBeFalsy();
    expect(play).not.toHaveBeenCalled();
  });
});

/** Records the resize observers created by the hook. */
const observers: {
  callback(): void;
  observed: Element[];
  disconnected: boolean;
}[] = [];

class FakeResizeObserver {
  private readonly entry: {
    callback(): void;
    observed: Element[];
    disconnected: boolean;
  };

  public constructor(callback: () => void) {
    this.entry = { callback, observed: [], disconnected: false };
    observers.push(this.entry);
  }

  public observe(target: Element): void {
    this.entry.observed.push(target);
  }

  public disconnect(): void {
    this.entry.disconnected = true;
  }
}

const setSize = (el: HTMLElement, props: Record<string, number>): void => {
  for (const [key, value] of Object.entries(props))
    Object.defineProperty(el, key, { value, configurable: true });
};

type GuideHook = RenderHookResult<CSSProperties | null, { ready: boolean }>;

describe('useGuideBox', (): void => {
  let view: HTMLDivElement;
  let video: HTMLVideoElement;

  beforeEach((): void => {
    observers.length = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    view = document.createElement('div');
    video = document.createElement('video');
    setSize(view, { clientWidth: 800, clientHeight: 600 });
    setSize(video, { videoWidth: 1920, videoHeight: 1080 });
  });

  const renderGuide = (ready: boolean): GuideHook => {
    // Refs keep their identity between renders, as useRef does
    const viewRef: RefObject<HTMLElement | null> = { current: view };
    const videoRef: RefObject<HTMLVideoElement | null> = { current: video };
    return renderHook(
      ({ ready: playing }: { ready: boolean }) =>
        useGuideBox(viewRef, videoRef, playing),
      { initialProps: { ready } },
    );
  };

  it('has no box before the video plays', (): void => {
    const { result } = renderGuide(false);

    expect(result.current).toBeNull();
    expect(observers).toHaveLength(0);
  });

  it('frames the area where the video shows up, inset by a margin', (): void => {
    const { result } = renderGuide(true);

    // 1920×1080 fit in 800×600 is 800×450, centered; margin is 6% of 450
    expect(result.current).toEqual({
      left: 27,
      top: 102,
      width: 746,
      height: 396,
    });
  });

  it('appears once the video starts playing', (): void => {
    const { result, rerender } = renderGuide(false);

    rerender({ ready: true });

    expect(result.current).toEqual({
      left: 27,
      top: 102,
      width: 746,
      height: 396,
    });
  });

  it('keeps the margin between 16 and 48 px', (): void => {
    setSize(view, { clientWidth: 400, clientHeight: 600 });
    const small: GuideHook = renderGuide(true);
    // 400×225: 6% would be 13.5 px
    expect(small.result.current).toEqual({
      left: 16,
      top: 203.5,
      width: 368,
      height: 193,
    });
    small.unmount();

    setSize(view, { clientWidth: 3840, clientHeight: 2160 });
    const large: GuideHook = renderGuide(true);
    // 3840×2160: 6% would be 129.6 px
    expect(large.result.current).toEqual({
      left: 48,
      top: 48,
      width: 3744,
      height: 2064,
    });
  });

  it('follows the size of the container', (): void => {
    const { result } = renderGuide(true);
    expect(observers).toHaveLength(1);
    expect(observers[0].observed).toEqual([view]);

    setSize(view, { clientWidth: 400, clientHeight: 600 });
    act(() => {
      observers[0].callback();
    });

    expect(result.current).toEqual({
      left: 16,
      top: 203.5,
      width: 368,
      height: 193,
    });
  });

  it('follows the resolution of the video', (): void => {
    const { result } = renderGuide(true);

    // Portrait camera: 1080×1920 fit in 800×600 is 337.5×600
    setSize(video, { videoWidth: 1080, videoHeight: 1920 });
    act(() => {
      video.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toEqual({
      left: 251.5,
      top: 20.25,
      width: 297,
      height: 559.5,
    });
  });

  it('stops following the sizes when unmounted', (): void => {
    const { unmount } = renderGuide(true);
    const remove: Mock = vi.spyOn(video, 'removeEventListener');

    unmount();

    expect(observers[0].disconnected).toBe(true);
    expect(remove).toHaveBeenCalledWith('resize', expect.any(Function));
  });
});
