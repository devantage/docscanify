import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { StepsProvider, useSteps } from './index';
import type { StepsContextValue } from './StepsContext';

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <StepsProvider>{children}</StepsProvider>
);

type Hook = RenderHookResult<StepsContextValue, unknown>;

const renderSteps = (): Hook => renderHook(() => useSteps(), { wrapper });

describe('StepsProvider and useSteps', (): void => {
  it('starts the flow at the Upload step', (): void => {
    const { result } = renderSteps();

    expect(result.current.step).toBe('upload');
  });

  it('opens the step passed to goTo', (): void => {
    const { result } = renderSteps();

    act(() => {
      result.current.goTo('enhance');
    });
    expect(result.current.step).toBe('enhance');

    act(() => {
      result.current.goTo('crop');
    });
    expect(result.current.step).toBe('crop');
  });

  it('can jump to any step, forward or back', (): void => {
    const { result } = renderSteps();

    act(() => {
      result.current.goTo('export');
    });
    expect(result.current.step).toBe('export');

    act(() => {
      result.current.goTo('upload');
    });
    expect(result.current.step).toBe('upload');
  });

  it('keeps goTo stable between steps, so consumers do not re-run effects', (): void => {
    const { result } = renderSteps();
    const goTo: StepsContextValue['goTo'] = result.current.goTo;

    act(() => {
      result.current.goTo('crop');
    });

    expect(result.current.goTo).toBe(goTo);
  });

  it('shares the same step with every consumer', (): void => {
    const { result } = renderHook(
      (): [StepsContextValue, StepsContextValue] => [useSteps(), useSteps()],
      { wrapper },
    );

    act(() => {
      result.current[0].goTo('export');
    });

    expect(result.current[1].step).toBe('export');
  });

  it('throws when used outside StepsProvider', (): void => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useSteps())).toThrow(
      'useSteps must be used inside StepsProvider',
    );
  });
});
