import './DocumentCarousel.css';

import { type JSX, type RefObject, useEffect, useRef } from 'react';

import { useFileDrop } from '@/hooks/useFileDrop';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useSortable } from '@/hooks/useSortable';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { AddTile } from './AddTile';
import { DocumentTile } from './DocumentTile';
import type { Preview } from './usePreviews';

interface Props {
  /** Documents, in export order. */
  documents: DocumentItem[];
  /** `large`: carousel of the Upload step. `compact`: bar under the preview in later steps. */
  size: 'large' | 'compact';
  /** Called with the chosen or dropped images, in the order received. */
  onFiles(files: File[]): void;
  /** Called on the take-photo button when the browser gives access to the camera. */
  onCamera(): void;
  onRemove(id: string): void;
  /** Called when a document is dragged to another position, with source and target indexes. */
  onReorder(from: number, to: number): void;
  /** Selected document; only with `onSelect`. */
  activeId?: string | null;
  /** Called when a document is tapped. Without it, documents are not selectable. */
  onSelect?(id: string): void;
  /**
   * Thumbnails with the crop and adjustments applied, by id. Without them, or until the first one
   * is ready, the carousel shows the original image.
   */
  previews?: Record<string, Preview>;
}

/**
 * Carousel of the documents, the same in the Upload step (`large`) and in the bar of the later
 * steps (`compact`). In every step it adds (take photos, choose or drop images), removes, and
 * reorders by drag and drop (or Alt + ← / → on the focused item). With `onSelect`, it also
 * selects the document on display and flags the ones with invalid corners.
 */
export function DocumentCarousel({
  documents,
  size,
  onFiles,
  onCamera,
  onRemove,
  onReorder,
  activeId = null,
  onSelect,
  previews,
}: Props): JSX.Element {
  const { t } = useTranslate();
  const { takePhoto, chooseFiles, fileInput } = useImagePicker({
    onFiles,
    onCamera,
  });
  // stopPropagation: in the Upload step, the screen behind also accepts dropped images
  const { over, dropProps } = useFileDrop({ onFiles, stopPropagation: true });
  const { containerRef, itemProps } = useSortable<HTMLDivElement>({
    onReorder,
    ignore: '.doc-tile-remove',
  });
  const compact: boolean = size === 'compact';
  const count: number = documents.length;
  const lastCount: RefObject<number> = useRef(count);

  // New documents go to the end: scroll there to show them next to the add card
  useEffect(() => {
    if (count > lastCount.current && !onSelect) {
      const carousel: HTMLDivElement | null = containerRef.current;
      carousel?.scrollTo({ left: carousel.scrollWidth, behavior: 'smooth' });
    }
    lastCount.current = count;
  }, [count, onSelect, containerRef]);

  // With selection, the selected document always stays in view
  useEffect(() => {
    if (!onSelect || !activeId) return;
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-id="${activeId}"]`)
      ?.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
  }, [activeId, onSelect, containerRef]);

  return (
    <div
      ref={containerRef}
      className={`doc-carousel is-${size}`}
      {...dropProps}
    >
      <ol aria-label={t('carousel.label')}>
        {documents.map((doc: DocumentItem, i: number) => (
          <li
            key={doc.id}
            className="doc-item"
            data-id={doc.id}
            {...itemProps(i)}
          >
            <DocumentTile
              document={doc}
              index={i}
              preview={previews?.[doc.id]}
              active={!!onSelect && doc.id === activeId}
              onSelect={onSelect}
              onRemove={onRemove}
            />
          </li>
        ))}
        <li className="doc-item doc-item-add">
          <AddTile
            over={over}
            compact={compact}
            onTakePhoto={takePhoto}
            onChooseFiles={chooseFiles}
          />
        </li>
      </ol>
      {fileInput}
    </div>
  );
}
