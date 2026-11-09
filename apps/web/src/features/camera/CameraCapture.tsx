import './CameraCapture.css';

import type { CSSProperties, JSX, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import { fileStamp, frameFromVideo } from '@/lib/image';

import { useCameraStream, useGuideBox } from './useCameraStream';

interface Props {
  /** Called on the done button with the photos, in the order they were taken. */
  onDone(photos: File[]): void;
  /** Called on the back button. The photos taken are discarded. */
  onCancel(): void;
}

/**
 * Camera to photograph documents in a row. It opens the rear camera, shows framing marks over the
 * video, and stays open after each photo until the user is done. It shows a message when the
 * camera is unavailable or blocked, and turns it off when leaving the screen.
 */
export function CameraCapture({ onDone, onCancel }: Props): JSX.Element {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const videoRef: RefObject<HTMLVideoElement | null> =
    useRef<HTMLVideoElement>(null);
  const viewRef: RefObject<HTMLDivElement | null> =
    useRef<HTMLDivElement>(null);
  const { ready, error, stop } = useCameraStream(videoRef);
  const guideBox: CSSProperties | null = useGuideBox(viewRef, videoRef, ready);
  const [photos, setPhotos] = useState<File[]>([]);
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string | null>(null);
  const [shooting, setShooting] = useState(false);
  // Changes on every shot, to replay the flash animation
  const [flashKey, setFlashKey] = useState(0);
  const count: number = photos.length;
  const photoCount: string = t('camera.photos', { count });

  useEffect(
    () => (): void => {
      if (lastPhotoUrl) URL.revokeObjectURL(lastPhotoUrl);
    },
    [lastPhotoUrl],
  );

  useEffect(() => {
    if (error) toast.error(t(`camera.error.${error}`), { id: 'camera' });
  }, [error, toast, t]);

  /** Keeps the current frame as a photo and leaves the camera ready for the next one. */
  const shoot = async (): Promise<void> => {
    const video: HTMLVideoElement | null = videoRef.current;
    if (!video || !ready || shooting) return;
    setShooting(true);
    setFlashKey((key: number) => key + 1);
    try {
      const name: string = `${t('files.document')}-${fileStamp()}-${count + 1}`;
      const photo: File = await frameFromVideo(video, name);
      setPhotos((list: File[]) => [...list, photo]);
      setLastPhotoUrl(URL.createObjectURL(photo));
    } finally {
      setShooting(false);
    }
  };

  const finish = (): void => {
    if (!count) return;
    stop();
    onDone(photos);
  };

  return (
    <div className="camera">
      <div ref={viewRef} className="camera-view">
        <video ref={videoRef} playsInline muted data-testid="camera-video" />
        {flashKey > 0 && (
          <div key={flashKey} className="camera-flash" aria-hidden />
        )}
        {ready && !error && guideBox && (
          <div className="camera-guide" style={guideBox} aria-hidden>
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
        {ready && !error && (
          <p className="camera-hint" role="status">
            {count === 0
              ? t('camera.frame')
              : t('camera.next', { photos: photoCount })}
          </p>
        )}
      </div>
      <div className="camera-bar">
        <button
          type="button"
          className="btn btn-ghost camera-back"
          onClick={onCancel}
        >
          {t('common.back')}
        </button>
        <button
          type="button"
          className="shutter"
          onClick={() => {
            void shoot();
          }}
          disabled={!ready || shooting}
          aria-label={t('camera.shutter')}
          data-testid="shutter"
        />
        <button
          type="button"
          className="camera-done"
          onClick={finish}
          disabled={!count}
          aria-label={
            count
              ? t('camera.doneWith', { photos: photoCount })
              : t('camera.done')
          }
          data-testid="camera-done"
        >
          {lastPhotoUrl && (
            <span className="camera-done-thumb">
              <img src={lastPhotoUrl} alt="" />
              <span className="camera-done-count">{count}</span>
            </span>
          )}
          {t('camera.done')}
        </button>
      </div>
    </div>
  );
}
