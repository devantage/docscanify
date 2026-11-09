import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

/** Why the camera could not be opened. Each one has its own user-facing message. */
export type CameraError = 'unsupported' | 'denied' | 'notFound' | 'unknown';

/**
 * Reason for a failed camera request: `denied` when the user or the browser refused access,
 * `notFound` when there is no camera, `unknown` otherwise.
 */
function cameraError(error: unknown): CameraError {
  const name: string | undefined = (error as DOMException | null | undefined)
    ?.name;
  if (name === 'NotAllowedError') return 'denied';
  if (name === 'NotFoundError') return 'notFound';
  return 'unknown';
}

export interface UseCameraStreamResult {
  /** The video is playing. */
  ready: boolean;
  /** Why the camera is unavailable or blocked, or null. */
  error: CameraError | null;
  /** Turns the camera off right away. */
  stop(): void;
}

/**
 * Plays the camera in a video element, preferring the rear one in Full HD, and turns it off on
 * unmount, also when access is granted only after that.
 */
export function useCameraStream(
  videoRef: RefObject<HTMLVideoElement | null>,
): UseCameraStreamResult {
  const streamRef: RefObject<MediaStream | null> = useRef<MediaStream | null>(
    null,
  );
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);

  const stop = (): void => {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
      track.stop();
    });
  };

  useEffect(() => {
    let cancelled: boolean = false;
    void (async (): Promise<void> => {
      // `mediaDevices` is undefined outside secure contexts (plain HTTP), which the DOM types
      // don't model
      const mediaNavigator: { mediaDevices?: MediaDevices } = navigator;
      if (!mediaNavigator.mediaDevices?.getUserMedia) {
        setError('unsupported');
        return;
      }
      try {
        const stream: MediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set by the effect cleanup while getUserMedia is pending
        if (cancelled) {
          stream.getTracks().forEach((track: MediaStreamTrack) => {
            track.stop();
          });
          return;
        }
        streamRef.current = stream;
        const video: HTMLVideoElement | null = videoRef.current;
        if (!video) throw new Error('The camera video element is not mounted');
        video.srcObject = stream;
        await video.play();
        setReady(true);
      } catch (e) {
        setError(cameraError(e));
      }
    })();
    return (): void => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => {
        track.stop();
      });
    };
  }, [videoRef]);

  return { ready, error, stop };
}

/**
 * Area where the video shows up inside its container (`object-fit: contain`), inset by 6% of its
 * shorter side, kept between 16 and 48 px. The framing marks are placed in it. It follows the
 * size of the container and of the video.
 *
 * @param viewRef Container of the video.
 * @param ready Whether the video is playing, so its size is known.
 * @returns Absolute position and size for the framing marks, or null before the video plays.
 */
export function useGuideBox(
  viewRef: RefObject<HTMLElement | null>,
  videoRef: RefObject<HTMLVideoElement | null>,
  ready: boolean,
): CSSProperties | null {
  const [box, setBox] = useState<CSSProperties | null>(null);

  useEffect(() => {
    const view: HTMLElement | null = viewRef.current;
    const video: HTMLVideoElement | null = videoRef.current;
    if (!ready || !view || !video) return;
    const update = (): void => {
      const { clientWidth: w, clientHeight: h } = view;
      const scale: number = Math.min(
        w / video.videoWidth,
        h / video.videoHeight,
      );
      const vw: number = video.videoWidth * scale;
      const vh: number = video.videoHeight * scale;
      const margin: number = Math.min(
        48,
        Math.max(16, Math.min(vw, vh) * 0.06),
      );
      setBox({
        left: (w - vw) / 2 + margin,
        top: (h - vh) / 2 + margin,
        width: vw - margin * 2,
        height: vh - margin * 2,
      });
    };
    update();
    const observer: ResizeObserver = new ResizeObserver(update);
    observer.observe(view);
    video.addEventListener('resize', update);
    return (): void => {
      observer.disconnect();
      video.removeEventListener('resize', update);
    };
  }, [viewRef, videoRef, ready]);

  return box;
}
