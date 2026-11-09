import { type DragEvent, useState } from 'react';

interface Options {
  onFiles(files: File[]): void;
  stopPropagation?: boolean;
}

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

/** Turns an element into a drop zone for files. */
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
