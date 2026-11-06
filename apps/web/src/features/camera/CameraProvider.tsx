import {
  type JSX,
  type ReactNode,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { CameraContext, type CameraContextValue } from './CameraContext';

/**
 * Provides the in-app camera, opened from any step. It does not change the step: the top bar
 * keeps showing where the user came from.
 */
export function CameraProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [isOpen, setOpen] = useState(false);
  const open: () => void = useCallback(() => {
    setOpen(true);
  }, []);
  const close: () => void = useCallback(() => {
    setOpen(false);
  }, []);
  const value: CameraContextValue = useMemo(
    () => ({ isOpen, open, close }),
    [isOpen, open, close],
  );
  return (
    <CameraContext.Provider value={value}>{children}</CameraContext.Provider>
  );
}
