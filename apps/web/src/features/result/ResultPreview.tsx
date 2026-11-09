import { type JSX, type RefObject, useLayoutEffect, useRef } from 'react';

import { Spinner } from '@/components/Spinner';

interface Props {
  /** Rendered document; nothing shows up before the first one. */
  result: HTMLCanvasElement | null;
  /** `result` is out of date and a new render is on its way: it shows faded. */
  busy: boolean;
  /** Shows the loading spinner. */
  rendering: boolean;
  /** Accessible name of the preview. */
  label: string;
  /** Color filter of the document, exposed as `data-filter`. */
  filter: string;
}

/** The rendered document, centered in the stage, with a spinner while a render runs. */
export function ResultPreview({
  result,
  busy,
  rendering,
  label,
  filter,
}: Props): JSX.Element {
  const canvasRef: RefObject<HTMLCanvasElement | null> =
    useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas: HTMLCanvasElement | null = canvasRef.current;
    if (!canvas || !result) return;
    canvas.width = result.width;
    canvas.height = result.height;
    const context: CanvasRenderingContext2D | null = canvas.getContext('2d');
    if (!context) throw new Error('Could not get a 2D canvas context');
    context.drawImage(result, 0, 0);
  }, [result]);

  return (
    <>
      {result && (
        <canvas
          ref={canvasRef}
          className={`result${busy ? ' is-busy' : ''}`}
          role="img"
          aria-label={label}
          data-testid="result"
          data-filter={filter}
        />
      )}
      {rendering && <Spinner data-testid="loading" />}
    </>
  );
}
