import { act, render, type RenderResult, screen } from '@testing-library/react';
import type { JSX } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { TranslateProvider } from '@/i18n';

import { ProgressOverlay } from './ProgressOverlay';

let queue: Map<number, FrameRequestCallback>;
let nextFrame: number;

beforeEach((): void => {
  vi.useFakeTimers({
    toFake: ['performance', 'setTimeout', 'clearTimeout', 'Date'],
  });
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

/** Runs one animation frame, 16 ms after the previous one, along with the timers due meanwhile. */
function frame(): void {
  act(() => {
    vi.advanceTimersByTime(16);
    const pending: FrameRequestCallback[] = [...queue.values()];
    queue.clear();
    pending.forEach((callback: FrameRequestCallback) => {
      callback(performance.now());
    });
  });
}

/** Runs `count` animation frames, 16 ms apart. */
function frames(count: number): void {
  for (let i: number = 0; i < count; i++) frame();
}

/** Runs frames until the bar shows 100%, up to 1000; returns how many it took. */
function framesUntilComplete(): number {
  for (let count: number = 1; count <= 1000; count++) {
    frames(1);
    if (document.querySelector('.progress.is-complete')) return count;
  }
  throw new Error('The bar never reached 100%');
}

/** Moves the fake clock by `ms` without running animation frames. */
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

/** Wraps `ui` in the translations, which format the percentage in the current language. */
const inLocale = (ui: JSX.Element): JSX.Element => (
  <TranslateProvider>{ui}</TranslateProvider>
);

/** Renders `ui` inside the translations. */
const renderBar = (ui: JSX.Element): RenderResult => render(inLocale(ui));

describe('ProgressOverlay', (): void => {
  it('covers the workspace with a status region holding the import progress', (): void => {
    renderBar(
      <ProgressOverlay
        label="Opening 3 images"
        value={0.25}
        onComplete={vi.fn()}
      />,
    );

    const overlay: HTMLElement = screen.getByTestId('loading-overlay');
    expect(overlay).toHaveAttribute('role', 'status');
    const bar: HTMLElement = screen.getByRole('progressbar', {
      name: 'Opening 3 images',
    });
    expect(overlay).toContainElement(bar);
    expect(bar).toHaveAttribute('aria-valuenow', '25');
    expect(screen.getByTestId('import-progress')).toContainElement(bar);
    expect(
      screen.getByText('Opening 3 images', { selector: '.progress-label' }),
    ).toBeInTheDocument();
  });

  it('calls onComplete once the full bar has been shown for a moment', (): void => {
    const onComplete: Mock<() => void> = vi.fn();
    renderBar(
      <ProgressOverlay label="Done" value={1} onComplete={onComplete} />,
    );

    framesUntilComplete();
    expect(onComplete).not.toHaveBeenCalled();
    advance(500);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('keeps dragged files from being opened by the browser', (): void => {
    renderBar(
      <ProgressOverlay label="Busy" value={0.5} onComplete={vi.fn()} />,
    );
    const overlay: HTMLElement = screen.getByTestId('loading-overlay');

    const dragOver: Event = new Event('dragover', {
      bubbles: true,
      cancelable: true,
    });
    const drop: Event = new Event('drop', { bubbles: true, cancelable: true });
    overlay.dispatchEvent(dragOver);
    overlay.dispatchEvent(drop);

    expect(dragOver.defaultPrevented).toBe(true);
    expect(drop.defaultPrevented).toBe(true);
  });
});
