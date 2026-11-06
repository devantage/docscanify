import type { JSX } from 'react';

import type { CameraContextValue } from '@/features/camera/CameraContext';
import { CameraLayer } from '@/features/camera/CameraLayer';
import { useCamera } from '@/features/camera/useCamera';
import { CropStep } from '@/features/crop/CropStep';
import { ResultSteps } from '@/features/result/ResultSteps';
import { useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { UploadStep } from '@/features/upload/UploadStep';

/**
 * What the workspace shows: the camera when it is open, otherwise the current step. Crop needs a
 * document on display, and Enhance and Export need it cropped; without that, they show nothing.
 */
export function CurrentStep(): JSX.Element | null | undefined {
  const { step } = useSteps();
  const camera: CameraContextValue = useCamera();
  const { active } = useScan();

  if (camera.isOpen) return <CameraLayer />;

  switch (step) {
    case 'upload':
      return <UploadStep />;
    case 'crop':
      return active && <CropStep />;
    case 'enhance':
    case 'export':
      return active?.corners && <ResultSteps />;
  }
}
