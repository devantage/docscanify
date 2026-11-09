import { act, render, screen } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ImportProgress as Progress } from '@/features/documents/useImportFiles';
import { TranslateProvider } from '@/i18n';

import { ImportProgress } from './ImportProgress';
import type { ScanContextValue } from './ScanContext';
import { useScan } from './useScan';

vi.mock('./useScan', () => ({ useScan: vi.fn() }));

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TranslateProvider>{children}</TranslateProvider>
);

function renderProgress(
  importProgress: Progress | null,
): ScanContextValue['dismissImportProgress'] {
  const dismissImportProgress: ScanContextValue['dismissImportProgress'] =
    vi.fn();
  vi.mocked(useScan).mockReturnValue({
    importProgress,
    dismissImportProgress,
  } as unknown as ScanContextValue);
  render(<ImportProgress />, { wrapper });
  return dismissImportProgress;
}

/** Advances the clock in small steps, so the bar animation renders along the way. */
async function advance(ms: number): Promise<void> {
  for (let elapsed: number = 0; elapsed < ms; elapsed += 50) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(Math.min(50, ms - elapsed));
    });
  }
}

describe('ImportProgress', (): void => {
  beforeEach((): void => {
    vi.useFakeTimers({
      toFake: [
        'setTimeout',
        'clearTimeout',
        'requestAnimationFrame',
        'cancelAnimationFrame',
        'performance',
      ],
    });
  });

  afterEach((): void => {
    vi.useRealTimers();
  });

  it('shows nothing when no import runs', (): void => {
    renderProgress(null);

    expect(screen.queryByTestId('loading-overlay')).not.toBeInTheDocument();
  });

  it('covers the workspace with the progress of the image being opened', (): void => {
    renderProgress({ phase: 'opening', current: 2, total: 3, value: 2 / 7 });

    expect(screen.getByTestId('loading-overlay')).toBeInTheDocument();
    const bar: HTMLElement = screen.getByRole('progressbar', {
      name: 'Uploading image 2 of 3…',
    });
    expect(bar).toHaveAttribute('aria-valuenow', '29');
  });

  it('describes the detection of a single image', (): void => {
    renderProgress({ phase: 'detecting', current: 1, total: 1, value: 1 / 3 });

    expect(
      screen.getByRole('progressbar', {
        name: 'Finding the document in the image…',
      }),
    ).toHaveAttribute('aria-valuenow', '33');
  });

  it('is dismissed once the full bar has been shown for a moment', async (): Promise<void> => {
    const dismiss: ScanContextValue['dismissImportProgress'] = renderProgress({
      phase: 'detecting',
      current: 1,
      total: 1,
      value: 1,
    });

    await advance(300);
    expect(dismiss).not.toHaveBeenCalled();

    await advance(3000);
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('is not dismissed while the import is still running', async (): Promise<void> => {
    const dismiss: ScanContextValue['dismissImportProgress'] = renderProgress({
      phase: 'detecting',
      current: 2,
      total: 2,
      value: 4 / 5,
    });

    await advance(10_000);

    expect(dismiss).not.toHaveBeenCalled();
  });
});
