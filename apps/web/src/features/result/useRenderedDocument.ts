import { type RefObject, useEffect, useRef, useState } from 'react';

import { hasRender, renderDocument } from '@/features/documents/renderCache';
import { canvasFromPng } from '@/lib/image';
import { waitForPaint, withMinDuration } from '@/lib/loading';
import type { DocumentItem } from '@/lib/types';

interface Shown {
  /** Document and render key the canvas belongs to. */
  key: string;
  canvas: HTMLCanvasElement | null;
  failed: boolean;
}

export interface UseRenderedDocumentResult {
  /** Canvas with the rendered document, or null before the first one. */
  result: HTMLCanvasElement | null;
  /** `result` belongs to the current document, corners, and adjustments. */
  ready: boolean;
  /** A new render is needed and `result` still shows an older one. */
  busy: boolean;
  /** The render for the current options failed; `result` keeps the previous one. */
  failed: boolean;
  /** Some render is in progress, to show the loading state. */
  rendering: boolean;
}

/**
 * The final document with its adjustments applied, for the main preview. A render that is already
 * cached (same document, corners, and adjustments) shows up without a loading state; a new render
 * lasts at least the minimum loading duration ({@link MIN_LOADING_MS}).
 *
 * @param doc Document on display, with its crop corners set.
 */
export function useRenderedDocument(
  doc: DocumentItem,
): UseRenderedDocumentResult {
  const key: string = `${doc.id}:${JSON.stringify([doc.corners, doc.options])}`;
  const [shown, setShown] = useState<Shown | null>(null);
  // A counter: after an option changes, the previous render may finish after the new one starts
  const [activeRenders, setActiveRenders] = useState(0);
  // Read through a ref: `key` already captures everything the render depends on
  const docRef: RefObject<DocumentItem> = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  });

  useEffect(() => {
    let cancelled: boolean = false;
    const current: DocumentItem = docRef.current;
    const cached: boolean = hasRender(current);

    void (async (): Promise<void> => {
      if (!cached) setActiveRenders((count: number) => count + 1);
      try {
        const png: Uint8Array = cached
          ? await renderDocument(current)
          : await withMinDuration(async () => {
              // OpenCV blocks the main thread: the loading state must show up before it starts
              await waitForPaint();
              return renderDocument(current);
            });
        const canvas: HTMLCanvasElement = await canvasFromPng(png);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set by the effect cleanup while the render awaits
        if (!cancelled) setShown({ key, canvas, failed: false });
      } catch (e) {
        console.error(e);
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- set by the effect cleanup while the render awaits
        if (!cancelled)
          setShown((prev: Shown | null) => ({
            key,
            canvas: prev?.canvas ?? null,
            failed: true,
          }));
      } finally {
        if (!cached) setActiveRenders((count: number) => count - 1);
      }
    })();

    return (): void => {
      cancelled = true;
    };
  }, [key]);

  // With the annotation TypeScript no longer narrows `shown` through `ready`, hence the null check
  const ready: boolean = shown?.key === key;
  return {
    result: shown?.canvas ?? null,
    ready,
    busy: !ready && !hasRender(doc),
    failed: ready && shown !== null && shown.failed,
    rendering: activeRenders > 0,
  };
}
