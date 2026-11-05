import { type DragEvent, useState } from 'react';

interface Options {
  /** Called with the dropped files, in the order received. */
  onFiles(files: File[]): void;
  /** Keeps the drop from reaching drop zones further up the tree. */
  stopPropagation?: boolean;
}

/** Drag and drop handlers of a drop zone. */
export interface FileDropProps {
  onDragOver(e: DragEvent): void;
  onDragLeave(): void;
  onDrop(e: DragEvent): void;
}

export interface UseFileDropResult {
  /** Files are being dragged over the element. */
  over: boolean;
  /** Event handlers to spread on the element. */
  dropProps: FileDropProps;
}

/**
 * Turns an element into a drop zone for files.
 *
 * @returns
 * - `over`: files are being dragged over the element.
 * - `dropProps`: event handlers to spread on the element.
 */
export function useFileDrop({
  onFiles,
  stopPropagation = false,
}: Options): UseFileDropResult {
  const [over, setOver] = useState(false);

  const stop = (e: DragEvent): void => {
    e.preventDefault();
    if (stopPropagation) e.stopPropagation();
  };

  const dropProps: FileDropProps = {
    onDragOver: (e: DragEvent): void => {
      stop(e);
      setOver(true);
    },
    onDragLeave: (): void => {
      setOver(false);
    },
    onDrop: (e: DragEvent): void => {
      stop(e);
      setOver(false);
      if (e.dataTransfer.files.length)
        onFiles(Array.from(e.dataTransfer.files));
    },
  };

  return { over, dropProps };
}
