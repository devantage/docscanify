import { fireEvent, render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { useFileDrop } from './useFileDrop';

/** A drop zone inside a parent that also listens to drops. */
function DropZone({
  onFiles,
  stopPropagation,
  onParentDrop,
}: {
  onFiles(files: File[]): void;
  stopPropagation?: boolean;
  onParentDrop?(): void;
}): JSX.Element {
  const { over, dropProps } = useFileDrop({ onFiles, stopPropagation });
  return (
    <div data-testid="parent" onDrop={onParentDrop} onDragOver={onParentDrop}>
      <div data-testid="zone" data-over={over} {...dropProps} />
    </div>
  );
}

const image = (name: string): File =>
  new File(['x'], name, { type: 'image/png' });

const zone = (): HTMLElement => screen.getByTestId('zone');

describe('useFileDrop', (): void => {
  it('is not in the drag over state at first', (): void => {
    render(<DropZone onFiles={vi.fn()} />);
    expect(zone()).toHaveAttribute('data-over', 'false');
  });

  it('enters the drag over state on drag over, allowing the drop', (): void => {
    render(<DropZone onFiles={vi.fn()} />);

    expect(fireEvent.dragOver(zone())).toBe(false);
    expect(zone()).toHaveAttribute('data-over', 'true');
  });

  it('leaves the drag over state on drag leave', (): void => {
    render(<DropZone onFiles={vi.fn()} />);
    fireEvent.dragOver(zone());

    fireEvent.dragLeave(zone());
    expect(zone()).toHaveAttribute('data-over', 'false');
  });

  it('passes the dropped files in the order received and leaves the drag over state', (): void => {
    const onFiles: Mock<(files: File[]) => void> = vi.fn();
    render(<DropZone onFiles={onFiles} />);
    const files: File[] = [image('b.png'), image('a.png'), image('c.png')];
    fireEvent.dragOver(zone());

    const notPrevented: boolean = fireEvent.drop(zone(), {
      dataTransfer: { files },
    });

    expect(notPrevented).toBe(false);
    expect(onFiles).toHaveBeenCalledTimes(1);
    expect(onFiles.mock.calls[0][0]).toEqual(files);
    expect(onFiles.mock.calls[0][0].map((f: File) => f.name)).toEqual([
      'b.png',
      'a.png',
      'c.png',
    ]);
    expect(zone()).toHaveAttribute('data-over', 'false');
  });

  it('does not call onFiles when the drop has no files, such as dragged text', (): void => {
    const onFiles: Mock<(files: File[]) => void> = vi.fn();
    render(<DropZone onFiles={onFiles} />);
    fireEvent.dragOver(zone());

    expect(fireEvent.drop(zone(), { dataTransfer: { files: [] } })).toBe(false);
    expect(onFiles).not.toHaveBeenCalled();
    expect(zone()).toHaveAttribute('data-over', 'false');
  });

  it('lets the drop reach drop zones further up by default', (): void => {
    const onParentDrop: Mock<() => void> = vi.fn();
    render(<DropZone onFiles={vi.fn()} onParentDrop={onParentDrop} />);

    fireEvent.dragOver(zone());
    fireEvent.drop(zone(), { dataTransfer: { files: [image('a.png')] } });
    expect(onParentDrop).toHaveBeenCalledTimes(2);
  });

  it('keeps the drop from reaching drop zones further up with stopPropagation', (): void => {
    const onFiles: Mock<(files: File[]) => void> = vi.fn();
    const onParentDrop: Mock<() => void> = vi.fn();
    render(
      <DropZone
        onFiles={onFiles}
        stopPropagation
        onParentDrop={onParentDrop}
      />,
    );

    fireEvent.dragOver(zone());
    fireEvent.drop(zone(), { dataTransfer: { files: [image('a.png')] } });
    expect(onParentDrop).not.toHaveBeenCalled();
    expect(onFiles).toHaveBeenCalledTimes(1);
  });
});
