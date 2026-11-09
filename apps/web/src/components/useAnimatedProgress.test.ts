import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAnimatedProgress } from './useAnimatedProgress';

/**
 * Animation frames driven by the test: each `frames(n)` runs n frames, 16 ms apart, with the
 * fake clock (and so `performance.now()`) moving along.
 */
let queue: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach((): void => {
  vi.useFakeTimers({ toFake: ['performance', 'setTimeout', 'Date'] });
  queue = new Map<number, FrameRequestCallback>();
  nextFrame = 0;
  vi.stubGlobal(
    'requestAnimationFrame',
    (callback: FrameRequestCallback): number => {
      nextFrame += 1;
      queue.set(nextFrame, callback);
      return nextFrame;
    },
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number): void => {
    queue.delete(id);
  });
});

afterEach((): void => {
  vi.useRealTimers();
});

/** Runs one animation frame, `ms` after the previous one. */
function frame(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
    const pending: FrameRequestCallback[] = [...queue.values()];
    queue.clear();
    pending.forEach((callback: FrameRequestCallback) => {
      callback(performance.now());
    });
  });
}

/** Runs `count` animation frames, `ms` apart. */
function frames(count: number, ms: number = 16): void {
  for (let i: number = 0; i < count; i++) frame(ms);
}

type Hook = RenderHookResult<number, { value: number }>;

const renderProgress = (value: number): Hook =>
  renderHook(
    ({ value: real }: { value: number }) => useAnimatedProgress(real),
    {
      initialProps: { value },
    },
  );

describe('useAnimatedProgress', (): void => {
  it('starts at 0', (): void => {
    const { result } = renderProgress(0.5);
    expect(result.current).toBe(0);
  });

  it('glides toward the real progress instead of jumping, at most 0.0015 per ms', (): void => {
    const { result } = renderProgress(0.5);

    frames(1);
    // 16 ms at the maximum catch-up speed
    expect(result.current).toBeCloseTo(0.024, 6);
    frames(1);
    expect(result.current).toBeCloseTo(0.048, 6);
  });

  it('counts a late frame as about two, so a blocked main thread does not make it leap', (): void => {
    const { result } = renderProgress(0.5);

    frames(1, 1000);
    expect(result.current).toBeCloseTo(34 * 0.0015, 6);
  });

  it('reaches the real progress and never passes the next step', (): void => {
    const { result } = renderProgress(0.4);

    frames(40);
    expect(result.current).toBeGreaterThanOrEqual(0.4);
    // The creep heads to 0.4 + 0.6 * 0.35 = 0.61
    frames(2000);
    expect(result.current).toBeGreaterThan(0.6);
    expect(result.current).toBeLessThan(0.61);
  });

  it('creeps slowly while no progress arrives', (): void => {
    const { result } = renderProgress(0);

    // About one creep time constant (2500 ms) toward 0.35
    frames(156);
    expect(result.current).toBeGreaterThan(0.2);
    expect(result.current).toBeLessThan(0.24);
  });

  it('never goes back when the real progress drops', (): void => {
    const { result, rerender } = renderProgress(0.8);
    frames(60);
    const before: number = result.current;
    expect(before).toBeGreaterThanOrEqual(0.8);

    rerender({ value: 0.2 });
    frames(200);
    expect(result.current).toBe(before);
  });

  it('only reaches 1 when the real progress does, then stops animating', (): void => {
    const { result, rerender } = renderProgress(0.9);
    frames(5000);
    expect(result.current).toBeLessThan(1);

    rerender({ value: 1 });
    frames(100);
    expect(result.current).toBe(1);
    expect(queue.size).toBe(0);
  });

  it('cancels its animation frame on unmount', (): void => {
    const { unmount } = renderProgress(0.5);
    frames(2);
    expect(queue.size).toBe(1);

    unmount();
    expect(queue.size).toBe(0);
  });
});
