import { type RefObject, useEffect, useRef, useState } from 'react';

/** Time constant of the catch-up toward the real progress, in ms. */
const CATCH_UP_MS: number = 160;
/** Minimum catch-up speed, as progress per ms, so the end of each step does not drag. */
const MIN_SPEED: number = 0.0008;
/** Maximum catch-up speed, as progress per ms, so a late frame does not turn into a leap. */
const MAX_SPEED: number = 0.0015;
/** Share of the remaining progress the bar may creep into while no real progress arrives. */
const CREEP_SHARE: number = 0.35;
/** Time constant of the creep, in ms: slow, so it reads as activity rather than progress. */
const CREEP_MS: number = 2500;

/**
 * Progress to show on screen, from 0 to 1. It glides toward the real progress instead of jumping.
 * Once it catches up and no new progress arrives, it keeps creeping slowly into
 * {@link CREEP_SHARE} (35%) of what is left, so a long step still shows activity. It never goes
 * back and only reaches 1 when the real progress does.
 *
 * @param value Real progress, from 0 to 1.
 */
export function useAnimatedProgress(value: number): number {
  const [shown, setShown] = useState(0);
  const target: RefObject<number> = useRef(value);
  useEffect(() => {
    target.current = value;
  }, [value]);

  useEffect(() => {
    let frame: number = 0;
    let last: number = performance.now();
    const tick = (now: number): void => {
      // A late frame (a blocked main thread) counts as about two, so the bar does not leap
      const dt: number = Math.min(34, now - last);
      last = now;
      let done: boolean = false;
      setShown((prev: number) => {
        const goal: number = target.current;
        if (prev >= 1) {
          done = true;
          return 1;
        }
        if (prev < goal) {
          const eased: number =
            (goal - prev) * (1 - Math.exp(-dt / CATCH_UP_MS));
          const step: number = Math.min(
            Math.max(eased, MIN_SPEED * dt),
            MAX_SPEED * dt,
          );
          return Math.min(goal, prev + step);
        }
        if (goal >= 1) return 1;
        const cap: number = goal + (1 - goal) * CREEP_SHARE;
        return prev < cap
          ? prev + (cap - prev) * (1 - Math.exp(-dt / CREEP_MS))
          : prev;
      });
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- `done` is set inside the setShown updater, which TypeScript cannot see
      if (!done) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return (): void => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return shown;
}
