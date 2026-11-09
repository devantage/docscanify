import { act, renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CameraProvider } from './CameraProvider';
import { useCamera } from './useCamera';

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <CameraProvider>{children}</CameraProvider>
);

describe('useCamera', (): void => {
  it('throws when used outside CameraProvider', (): void => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useCamera())).toThrow(
      'useCamera must be used inside CameraProvider',
    );
  });

  it('shares one camera state with every component of the provider', (): void => {
    const { result } = renderHook(() => [useCamera(), useCamera()] as const, {
      wrapper,
    });

    act(() => {
      result.current[0].open();
    });

    expect(result.current[1].isOpen).toBe(true);
  });
});
