import { useContext } from 'react';

import { CameraContext, type CameraContextValue } from './CameraContext';

/**
 * Opens and closes the in-app camera.
 *
 * @throws When used outside `CameraProvider`.
 */
export function useCamera(): CameraContextValue {
  const value: CameraContextValue | null = useContext(CameraContext);
  if (!value) throw new Error('useCamera must be used inside CameraProvider');
  return value;
}
