import './ProgressOverlay.css';

import type { DragEvent, JSX } from 'react';

import { ProgressBar } from './ProgressBar';

interface Props {
  /** What is in progress, shown above the bar and announced to screen readers. */
  label: string;
  /** Progress from 0 to 1; 1 when the work is done. */
  value: number;
  /** Called once the full bar has been shown for a moment, so the overlay can go away. */
  onComplete(): void;
}

/**
 * Progress that covers the workspace while images are prepared. It blocks clicks and keeps a
 * file dropped on it from being opened by the browser.
 */
export function ProgressOverlay({
  label,
  value,
  onComplete,
}: Props): JSX.Element {
  const block = (e: DragEvent): void => {
    e.preventDefault();
  };
  return (
    <div
      className="loading"
      role="status"
      onDragOver={block}
      onDrop={block}
      data-testid="loading-overlay"
    >
      <div className="loading-card">
        <ProgressBar
          label={label}
          value={value}
          onComplete={onComplete}
          data-testid="import-progress"
        />
      </div>
    </div>
  );
}
