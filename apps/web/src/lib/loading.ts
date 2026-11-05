/** Delay, in ms, that lets the busy state reach the screen before heavy work starts. */
export const PAINT_DELAY: number = 30;

/** Minimum duration of any loading state, in ms: anything shorter just flickers. */
export const MIN_LOADING_MS: number = 1000;

const delay = async (ms: number): Promise<void> =>
  new Promise<void>((resolve: (value: void | PromiseLike<void>) => void) =>
    setTimeout(resolve, ms),
  );

/**
 * Waits for the screen to paint the current state. Use it before work that blocks the main
 * thread, such as OpenCV, so the loading state shows up first.
 */
export const waitForPaint = async (): Promise<void> => delay(PAINT_DELAY);

/**
 * Runs a task and only resolves after the minimum duration, whether it succeeds or not.
 *
 * @param work Task to run.
 * @param ms Minimum duration, in ms.
 * @returns The result of `work`. If `work` fails, the error is rethrown after the minimum duration.
 */
export async function withMinDuration<T>(
  work: () => Promise<T>,
  ms: number = MIN_LOADING_MS,
): Promise<T> {
  const minimum: Promise<void> = delay(ms);
  try {
    return await work();
  } finally {
    await minimum;
  }
}
