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

import { ProgressBar } from './ProgressBar';

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

function frames(count: number): void {
  for (let i: number = 0; i < count; i++) frame();
}

/** Runs frames until the bar shows 100%; returns how many it took. */
function framesUntilComplete(): number {
  for (let count: number = 1; count <= 1000; count++) {
    frames(1);
    if (document.querySelector('.progress.is-complete')) return count;
  }
  throw new Error('The bar never reached 100%');
}

const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};

const inLocale = (ui: JSX.Element): JSX.Element => (
  <TranslateProvider>{ui}</TranslateProvider>
);

const renderBar = (ui: JSX.Element): RenderResult => render(inLocale(ui));

/** Percentage shown above the bar. */
const shownText = (): string =>
  document.querySelector('.progress-value')?.textContent ?? '';

/** Width of the fill, as a number of percent. */
const fillWidth = (): number =>
  parseFloat(
    document.querySelector<HTMLElement>('.progress-fill')?.style.width ?? '',
  );

describe('ProgressBar', (): void => {
  it('exposes the real progress to screen readers, with the label as its name', (): void => {
    renderBar(<ProgressBar value={0.42} label="Preparing images" />);

    const bar: HTMLElement = screen.getByRole('progressbar', {
      name: 'Preparing images',
    });
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuenow', '42');
    expect(bar).toHaveAttribute('aria-valuetext', 'Preparing images 42%');
  });

  it.each([
    [1.7, '100'],
    [-0.3, '0'],
    [0.666, '67'],
  ])(
    'clamps and rounds the value %s to aria-valuenow %s',
    (value: number, now: string): void => {
      renderBar(<ProgressBar value={value} label="Work" />);
      expect(screen.getByRole('progressbar')).toHaveAttribute(
        'aria-valuenow',
        now,
      );
    },
  );

  it('formats the percentage in the current language', (): void => {
    localStorage.setItem('docscanify.locale', 'pt-BR');
    renderBar(<ProgressBar value={0.5} label="Preparando" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      expect.stringMatching(/^Preparando 50\s?%$/),
    );
  });

  it('uses the separators of the current language, not those of the browser', (): void => {
    // Spanish puts a no-break space before the percent sign; English and Portuguese do not
    localStorage.setItem('docscanify.locale', 'es');
    renderBar(<ProgressBar value={0.5} label="Preparando" />);

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      'Preparando 50 %',
    );
    expect(shownText()).toBe('0 %');
  });

  it('shows the label and an animated percentage above the bar', (): void => {
    renderBar(<ProgressBar value={0.5} label="Detecting" />);

    expect(
      screen.getByText('Detecting', { selector: '.progress-label' }),
    ).toBeInTheDocument();
    expect(shownText()).toBe('0%');
    expect(fillWidth()).toBe(0);

    frames(5);
    // 5 frames of 16 ms at 0.0015 per ms
    expect(fillWidth()).toBeCloseTo(12, 6);
    expect(shownText()).toBe('12%');

    // Reaches the real 50%, then only creeps slowly past it
    frames(40);
    expect(fillWidth()).toBeGreaterThanOrEqual(50);
    expect(fillWidth()).toBeLessThan(52);
    expect(shownText()).toMatch(/^5[01]%$/);
  });

  it('hides the label and percentage with showLabel false, keeping the bar', (): void => {
    renderBar(<ProgressBar value={0.5} label="Hidden" showLabel={false} />);

    expect(document.querySelector('.progress-head')).toBeNull();
    expect(
      screen.getByRole('progressbar', { name: 'Hidden' }),
    ).toBeInTheDocument();
  });

  it('passes its test id to the root element', (): void => {
    renderBar(<ProgressBar value={0} label="X" data-testid="my-progress" />);
    expect(screen.getByTestId('my-progress')).toHaveClass('progress');
  });

  it('is not complete, and never calls onComplete, while the work is not done', (): void => {
    const onComplete: Mock<() => void> = vi.fn();
    renderBar(
      <ProgressBar
        value={0.99}
        label="Work"
        onComplete={onComplete}
        data-testid="bar"
      />,
    );

    frames(2000);
    expect(screen.getByTestId('bar')).not.toHaveClass('is-complete');
    expect(fillWidth()).toBeLessThan(100);
    advance(10_000);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('reaches 100% when done and calls onComplete once, after the default 500 ms', (): void => {
    const onComplete: Mock<() => void> = vi.fn();
    const { rerender } = renderBar(
      <ProgressBar
        value={0.6}
        label="Work"
        onComplete={onComplete}
        data-testid="bar"
      />,
    );
    frames(30);

    rerender(
      inLocale(
        <ProgressBar
          value={1}
          label="Work"
          onComplete={onComplete}
          data-testid="bar"
        />,
      ),
    );
    // About 0.4 left, at 0.0128 to 0.024 per frame
    const took: number = framesUntilComplete();
    expect(took).toBeGreaterThanOrEqual(17);
    expect(took).toBeLessThanOrEqual(32);
    expect(screen.getByTestId('bar')).toHaveClass('is-complete');
    expect(shownText()).toBe('100%');
    expect(fillWidth()).toBe(100);

    advance(499);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    advance(5000);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('waits completeDelay before onComplete', (): void => {
    const onComplete: Mock<() => void> = vi.fn();
    renderBar(
      <ProgressBar
        value={1}
        label="Work"
        completeDelay={1200}
        onComplete={onComplete}
        data-testid="bar"
      />,
    );
    framesUntilComplete();

    advance(1199);
    expect(onComplete).not.toHaveBeenCalled();
    advance(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('does not restart the delay when onComplete changes, and calls the latest one', (): void => {
    const first: Mock<() => void> = vi.fn();
    const second: Mock<() => void> = vi.fn();
    const { rerender } = renderBar(
      <ProgressBar value={1} label="Work" onComplete={first} />,
    );
    framesUntilComplete();
    advance(300);

    rerender(
      inLocale(<ProgressBar value={1} label="Work" onComplete={second} />),
    );
    advance(300);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does not call onComplete if it unmounts during the delay', (): void => {
    const onComplete: Mock<() => void> = vi.fn();
    const { unmount } = renderBar(
      <ProgressBar value={1} label="Work" onComplete={onComplete} />,
    );
    framesUntilComplete();
    unmount();
    advance(1000);

    expect(onComplete).not.toHaveBeenCalled();
  });
});
