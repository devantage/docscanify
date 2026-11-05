import type { JSX } from 'react';

import { useScan } from '@/features/scan/useScan';

import { CameraCapture } from './CameraCapture';
import { useCamera } from './useCamera';

/**
 * The camera over the workspace of the step on display. Done imports the photos with the same
 * rules as any other added image; back discards them.
 */
export function CameraLayer(): JSX.Element {
  const { close } = useCamera();
  const { addFiles } = useScan();

  const done = (photos: File[]): void => {
    close();
    void addFiles(photos);
  };

  return (
    <section className="stage stage-camera">
      <CameraCapture onDone={done} onCancel={close} />
    </section>
  );
}
