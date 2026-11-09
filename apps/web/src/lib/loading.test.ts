import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  MIN_LOADING_MS,
  PAINT_DELAY,
  waitForPaint,
  withMinDuration,
} from './loading';

/** How a promise settled, or `pending` while it has not. */
type Outcome<T> =
  | { status: 'pending' }
  | { status: 'fulfilled'; value: T }
  | { status: 'rejected'; reason: unknown };

/** Tracks a promise, so a test can check whether it settled without awaiting it. */
function track<T>(promise: Promise<T>): { current: Outcome<T> } {
  const outcome: { current: Outcome<T> } = { current: { status: 'pending' } };
  promise.then(
    (value: T): void => {
      outcome.current = { status: 'fulfilled', value };
    },
    (reason: unknown): void => {
      outcome.current = { status: 'rejected', reason };
    },
  );
  return outcome;
}

/** A task that settles after `ms`, with fake timers. */
const after = async <T>(ms: number, value: T): Promise<T> =>
  new Promise<T>((resolve: (result: T) => void): void => {
    setTimeout((): void => {
      resolve(value);
    }, ms);
  });

describe('loading', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers();
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('uses a paint delay of 30 ms and a minimum loading time of 1 s', (): void => {
    expect(PAINT_DELAY).toBe(30);
    expect(MIN_LOADING_MS).toBe(1000);
  });

  describe('waitForPaint', (): void => {
    it('resolves only after the paint delay', async (): Promise<void> => {
      const outcome: { current: Outcome<void> } = track(waitForPaint());

      await vi.advanceTimersByTimeAsync(PAINT_DELAY - 1);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({
        status: 'fulfilled',
        value: undefined,
      });
    });
  });

  describe('withMinDuration', (): void => {
    it('starts the task right away', (): void => {
      const work: () => Promise<string> = vi.fn(async (): Promise<string> =>
        Promise.resolve('done'),
      );

      void withMinDuration(work, 500);

      expect(work).toHaveBeenCalledTimes(1);
    });

    it('waits for the minimum duration when the task finishes sooner', async (): Promise<void> => {
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(
          async (): Promise<string> => Promise.resolve('done'),
          500,
        ),
      );

      await vi.advanceTimersByTimeAsync(499);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'fulfilled', value: 'done' });
    });

    it('uses MIN_LOADING_MS as the minimum duration by default', async (): Promise<void> => {
      const outcome: { current: Outcome<number> } = track(
        withMinDuration(async (): Promise<number> => Promise.resolve(42)),
      );

      await vi.advanceTimersByTimeAsync(MIN_LOADING_MS - 1);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'fulfilled', value: 42 });
    });

    it('resolves as soon as a task longer than the minimum finishes, without adding the minimum', async (): Promise<void> => {
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(async (): Promise<string> => after(1500, 'slow'), 1000),
      );

      await vi.advanceTimersByTimeAsync(1499);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'fulfilled', value: 'slow' });
    });

    it('counts the minimum from the start, not from the end of the task', async (): Promise<void> => {
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(async (): Promise<string> => after(600, 'mid'), 1000),
      );

      await vi.advanceTimersByTimeAsync(999);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'fulfilled', value: 'mid' });
    });

    it('rethrows the error of a failed task only after the minimum duration', async (): Promise<void> => {
      const error: Error = new Error('detection failed');
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(
          async (): Promise<string> => Promise.reject(error),
          800,
        ),
      );

      await vi.advanceTimersByTimeAsync(799);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'rejected', reason: error });
      if (outcome.current.status === 'rejected')
        expect(outcome.current.reason).toBe(error);
    });

    it('rethrows the error of a task that fails after the minimum, as soon as it fails', async (): Promise<void> => {
      const error: Error = new Error('late failure');
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(async (): Promise<string> => {
          await after(1200, undefined);
          throw error;
        }, 1000),
      );

      await vi.advanceTimersByTimeAsync(1199);

      expect(outcome.current.status).toBe('pending');

      await vi.advanceTimersByTimeAsync(1);

      expect(outcome.current).toEqual({ status: 'rejected', reason: error });
    });

    it('resolves on the next tick with a minimum of 0 ms', async (): Promise<void> => {
      const outcome: { current: Outcome<string> } = track(
        withMinDuration(async (): Promise<string> => Promise.resolve('now'), 0),
      );

      await vi.advanceTimersByTimeAsync(0);

      expect(outcome.current).toEqual({ status: 'fulfilled', value: 'now' });
    });
  });
});
