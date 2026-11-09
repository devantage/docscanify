import type { JSX } from 'react';

import { CameraProvider } from '@/features/camera/CameraProvider';
import { ScanProvider } from '@/features/scan/ScanProvider';
import { StepsProvider } from '@/features/steps';

import { AppShell } from './AppShell';

/**
 * The app: the navigation between steps, the camera, and the scanning session, provided to the
 * shell. Language and toasts are provided around it (see `main.tsx`).
 */
export function App(): JSX.Element {
  return (
    <StepsProvider>
      <CameraProvider>
        <ScanProvider>
          <AppShell />
        </ScanProvider>
      </CameraProvider>
    </StepsProvider>
  );
}
