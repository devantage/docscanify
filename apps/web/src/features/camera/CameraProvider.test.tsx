import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { StepsProvider, useSteps } from '@/features/steps';
import type { StepsContextValue } from '@/features/steps/StepsContext';

import type { CameraContextValue } from './CameraContext';
import { CameraProvider } from './CameraProvider';
import { useCamera } from './useCamera';

interface Session {
  camera: CameraContextValue;
  steps: StepsContextValue;
}

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <StepsProvider>
    <CameraProvider>{children}</CameraProvider>
  </StepsProvider>
);

type Hook = RenderHookResult<Session, unknown>;

const renderSession = (): Hook =>
  renderHook((): Session => ({ camera: useCamera(), steps: useSteps() }), {
    wrapper,
  });

describe('CameraProvider', (): void => {
  it('starts with the camera closed', (): void => {
    const { result } = renderSession();

    expect(result.current.camera.isOpen).toBe(false);
  });

  it('opens and closes the camera', (): void => {
    const { result } = renderSession();

    act(() => {
      result.current.camera.open();
    });
    expect(result.current.camera.isOpen).toBe(true);

    act(() => {
      result.current.camera.close();
    });
    expect(result.current.camera.isOpen).toBe(false);
  });

  it.each(['upload', 'crop', 'enhance', 'export'] as const)(
    'opens over the %s step and returns to it on close',
    (step: StepsContextValue['step']): void => {
      const { result } = renderSession();
      act(() => {
        result.current.steps.goTo(step);
      });

      act(() => {
        result.current.camera.open();
      });
      // The top bar keeps showing where the user came from
      expect(result.current.steps.step).toBe(step);

      act(() => {
        result.current.camera.close();
      });
      expect(result.current.camera.isOpen).toBe(false);
      expect(result.current.steps.step).toBe(step);
    },
  );

  it('stays open when opened twice, and closed when closed twice', (): void => {
    const { result } = renderSession();

    act(() => {
      result.current.camera.open();
      result.current.camera.open();
    });
    expect(result.current.camera.isOpen).toBe(true);

    act(() => {
      result.current.camera.close();
      result.current.camera.close();
    });
    expect(result.current.camera.isOpen).toBe(false);
  });

  it('keeps open and close stable while the camera opens and closes', (): void => {
    const { result } = renderSession();
    const { open, close } = result.current.camera;

    act(() => {
      open();
    });
    act(() => {
      close();
    });

    expect(result.current.camera.open).toBe(open);
    expect(result.current.camera.close).toBe(close);
  });
});
