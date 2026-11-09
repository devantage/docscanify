import './ProgressBar.css';

import { type JSX, type RefObject, useEffect, useRef } from 'react';

import { useTranslate } from '@/i18n';

import { useAnimatedProgress } from './useAnimatedProgress';

interface Props {
  /** Real progress, from 0 to 1. Reach 1 only when the work is done. */
  value: number;
  /** What is in progress; the accessible name of the bar. */
  label: string;
  /** Shows the label and the percentage above the bar. */
  showLabel?: boolean;
  /** How long the bar stays at 100% before `onComplete`, in ms. */
  completeDelay?: number;
  /** Called once the bar has shown 100% for `completeDelay`, so the parent can hide it. */
  onComplete?(): void;
  'data-testid'?: string;
}

/**
 * Determinate progress bar. The fill glides between progress updates and creeps while waiting
 * for one, and a sheen keeps moving across it, so it never looks stuck. Screen readers get the
 * real percentage.
 */
export function ProgressBar({
  value,
  label,
  showLabel = true,
  completeDelay = 500,
  onComplete,
  'data-testid': testId,
}: Props): JSX.Element {
  const { locale } = useTranslate();
  const real: number = Math.min(1, Math.max(0, value));
  const shown: number = useAnimatedProgress(real);
  const complete: boolean = shown >= 1;
  const format = (fraction: number): string =>
    new Intl.NumberFormat(locale, { style: 'percent' }).format(fraction);

  // Read through a ref: a new callback identity must not restart the delay
  const onCompleteRef: RefObject<(() => void) | undefined> = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });

  useEffect(() => {
    if (!complete) return;
    const id: ReturnType<typeof setTimeout> = setTimeout(
      () => onCompleteRef.current?.(),
      completeDelay,
    );
    return (): void => {
      clearTimeout(id);
    };
  }, [complete, completeDelay]);

  return (
    <div
      className={`progress${complete ? ' is-complete' : ''}`}
      data-testid={testId}
    >
      {showLabel && (
        <div className="progress-head" aria-hidden>
          <span className="progress-label">{label}</span>
          <span className="progress-value">
            {format(Math.floor(shown * 100) / 100)}
          </span>
        </div>
      )}
      <div
        className="progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(real * 100)}
        aria-valuetext={`${label} ${format(real)}`}
      >
        <div className="progress-fill" style={{ width: `${shown * 100}%` }} />
      </div>
    </div>
  );
}
