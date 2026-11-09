import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ResultPreview } from './ResultPreview';

type DrawImage = Mock<(image: CanvasImageSource, x: number, y: number) => void>;

let drawImage: DrawImage;
let getContext: Mock<(this: HTMLCanvasElement) => unknown>;

/** A rendered document of the given size, as `useRenderedDocument` returns it. */
function renderedCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas: HTMLCanvasElement = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

beforeEach((): void => {
  drawImage = vi.fn();
  getContext = vi.fn(function (this: HTMLCanvasElement): unknown {
    return { drawImage, canvas: this };
  });
  // jsdom has no canvas pixels: the drawing is recorded instead
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    getContext as unknown as HTMLCanvasElement['getContext'],
  );
});

describe('ResultPreview', (): void => {
  it('shows nothing before the first render', (): void => {
    render(
      <ResultPreview
        result={null}
        busy={false}
        rendering={false}
        label="Preview of document 1, cropped"
        filter="none"
      />,
    );

    expect(screen.queryByTestId('result')).not.toBeInTheDocument();
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('shows only the spinner while the first render runs', (): void => {
    render(
      <ResultPreview
        result={null}
        busy
        rendering
        label="Preview of document 1, cropped"
        filter="none"
      />,
    );

    expect(screen.queryByTestId('result')).not.toBeInTheDocument();
    expect(screen.getByTestId('loading')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('copies the rendered document, at its size, into an image with the given name', (): void => {
    const result: HTMLCanvasElement = renderedCanvas(640, 900);
    render(
      <ResultPreview
        result={result}
        busy={false}
        rendering={false}
        label="Preview of document 2, cropped"
        filter="bw"
      />,
    );

    const preview: HTMLCanvasElement = screen.getByRole('img', {
      name: 'Preview of document 2, cropped',
    });
    expect(preview).toBe(screen.getByTestId('result'));
    expect(preview).not.toBe(result);
    expect(preview.width).toBe(640);
    expect(preview.height).toBe(900);
    expect(preview).toHaveAttribute('data-filter', 'bw');
    expect(preview).toHaveClass('result');
    expect(preview).not.toHaveClass('is-busy');
    expect(drawImage).toHaveBeenCalledExactlyOnceWith(result, 0, 0);
    expect(getContext.mock.contexts.at(-1)).toBe(preview);
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('fades an out-of-date render and shows the spinner while the new one runs', (): void => {
    render(
      <ResultPreview
        result={renderedCanvas(10, 10)}
        busy
        rendering
        label="Preview of document 1, cropped"
        filter="grayscale"
      />,
    );

    expect(screen.getByTestId('result')).toHaveClass('result', 'is-busy');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('shows the spinner while some render runs, even over an up-to-date preview', (): void => {
    render(
      <ResultPreview
        result={renderedCanvas(10, 10)}
        busy={false}
        rendering
        label="Preview of document 1, cropped"
        filter="none"
      />,
    );

    expect(screen.getByTestId('result')).not.toHaveClass('is-busy');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('fades an out-of-date render without a spinner when no render runs', (): void => {
    render(
      <ResultPreview
        result={renderedCanvas(10, 10)}
        busy
        rendering={false}
        label="Preview of document 1, cropped"
        filter="none"
      />,
    );

    expect(screen.getByTestId('result')).toHaveClass('is-busy');
    expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
  });

  it('draws the new render when it arrives', (): void => {
    const first: HTMLCanvasElement = renderedCanvas(100, 200);
    const { rerender } = render(
      <ResultPreview
        result={first}
        busy={false}
        rendering={false}
        label="Preview"
        filter="none"
      />,
    );
    const second: HTMLCanvasElement = renderedCanvas(300, 150);

    rerender(
      <ResultPreview
        result={second}
        busy={false}
        rendering={false}
        label="Preview"
        filter="none"
      />,
    );

    const preview: HTMLCanvasElement = screen.getByTestId('result');
    expect(preview.width).toBe(300);
    expect(preview.height).toBe(150);
    expect(drawImage.mock.calls).toEqual([
      [first, 0, 0],
      [second, 0, 0],
    ]);
  });

  it('does not draw again when only the busy state changes', (): void => {
    const result: HTMLCanvasElement = renderedCanvas(100, 200);
    const { rerender } = render(
      <ResultPreview
        result={result}
        busy={false}
        rendering={false}
        label="Preview"
        filter="none"
      />,
    );

    rerender(
      <ResultPreview
        result={result}
        busy
        rendering
        label="Preview"
        filter="none"
      />,
    );

    expect(drawImage).toHaveBeenCalledTimes(1);
  });
});
