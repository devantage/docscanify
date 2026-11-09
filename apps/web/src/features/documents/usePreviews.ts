import { type RefObject, useEffect, useRef, useState } from 'react';

import { thumbnailFrom, thumbnailFromPng } from '@/lib/image';
import { MIN_LOADING_MS, waitForPaint } from '@/lib/loading';
import { NO_ENHANCEMENTS } from '@/lib/scan';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { hasRender, renderDocument } from './renderCache';

/**
 * What a thumbnail shows: `crop`, the document only cropped (Crop step); `enhance`, cropped and
 * with its adjustments (Enhance and Export steps).
 */
export type PreviewMode = 'crop' | 'enhance';

/** Thumbnail of a document as it looks in the current step. */
export interface Preview {
  /** Data URL of the latest thumbnail; null before the first one or when the crop is invalid. */
  url: string | null;
  /** The thumbnail does not reflect the current crop and adjustments of the document yet. */
  pending: boolean;
}

/** Current result of the main preview, reused as the thumbnail of the document on display. */
export interface CurrentRender {
  /** Document on display. */
  id: string;
  /** Key of the crop and adjustments that produced the result (see {@link previewKey}). */
  key: string;
  /** Rendered preview; null when the render failed. */
  canvas: HTMLCanvasElement | null;
}

/** Latest thumbnail of each `mode:id` slot; slots without one yet are absent. */
type ThumbnailCache = Partial<
  Record<string, { key: string; url: string | null }>
>;

interface Options {
  /** Document on display: in `crop` mode, its thumbnail is generated first. */
  activeId: string | null;
  /**
   * `enhance` mode only: the main preview result, which becomes the thumbnail of the document on
   * display. That document is never rendered in the background.
   */
  current?: CurrentRender | null;
  /** Suspends background generation, such as while a corner is dragged. */
  paused: boolean;
  /**
   * Document being edited right now, such as the one whose corner is dragged. It does not show as
   * pending, and the minimum pending duration only starts when the edit ends.
   */
  holdId?: string | null;
}

/**
 * What changes how a document looks in the given mode: the crop and, in `enhance` mode, the
 * adjustments.
 *
 * @returns A key that changes whenever the thumbnail must be regenerated.
 */
export const previewKey = (mode: PreviewMode, doc: DocumentItem): string =>
  JSON.stringify(mode === 'crop' ? doc.corners : [doc.corners, doc.options]);

/**
 * Only a valid crop has a preview: with crossed corners, the document keeps the last valid
 * corners, and the thumbnail would show a crop that is not the current one.
 */
const canPreview = (doc: DocumentItem): boolean => !!doc.corners && doc.valid;

/**
 * Adjustments a thumbnail shows in the given mode: none in `crop` mode, the document's own in
 * `enhance` mode.
 */
const modeOptions = (mode: PreviewMode, doc: DocumentItem): EnhanceOptions =>
  mode === 'crop' ? NO_ENHANCEMENTS : doc.options;

/**
 * Thumbnails of the documents as they look in the current step. They render in the background,
 * one at a time, and only while nothing heavier is running. Each one is regenerated only when
 * the crop or (in `enhance` mode) the adjustments of its document change, and stays pending for
 * at least `MIN_LOADING_MS`. Results are cached per mode, so switching steps does not regenerate
 * thumbnails that did not change.
 *
 * @param mode What the thumbnails show; null stops generation and returns no thumbnails.
 * @returns The thumbnail of each document, by id.
 */
export function usePreviews(
  documents: DocumentItem[],
  mode: PreviewMode | null,
  { activeId, current = null, paused, holdId = null }: Options,
): Record<string, Preview> {
  // Keyed by `mode:id`: each mode has its own thumbnails
  const [cache, setCache] = useState<ThumbnailCache>({});
  // When each thumbnail became stale, for the minimum pending duration
  const staleSince: RefObject<Map<string, { key: string; at: number }>> =
    useRef(new Map<string, { key: string; at: number }>());
  // Last key rendered for each thumbnail: results only reach the cache after the minimum duration
  const rendered: RefObject<Map<string, string>> = useRef(
    new Map<string, string>(),
  );
  const running: RefObject<boolean> = useRef(false);
  // Thumbnails waiting on a real render: only these show as pending for the minimum duration
  const realRenders: RefObject<Set<string>> = useRef(new Set<string>());
  const alive: RefObject<boolean> = useRef(true);
  const [queueTick, setQueueTick] = useState(0);

  useEffect(() => {
    alive.current = true;
    return (): void => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mode) return;
    for (const doc of documents) {
      if (!canPreview(doc) || doc.id === holdId) continue;
      const slot: string = `${mode}:${doc.id}`;
      const key: string = previewKey(mode, doc);
      if (
        cache[slot]?.key !== key &&
        staleSince.current.get(slot)?.key !== key
      ) {
        staleSince.current.set(slot, { key, at: performance.now() });
        // Stale without a cached render: a real render follows, here or in the main preview
        if (hasRender(doc, modeOptions(mode, doc)))
          realRenders.current.delete(slot);
        else realRenders.current.add(slot);
      }
    }
  }, [documents, cache, mode, holdId]);

  /**
   * Stores the thumbnail, after the minimum pending duration when it took a real render. Without
   * `url`, keeps the previous one.
   */
  const commit = (slot: string, key: string, url: string | null): void => {
    const since: { key: string; at: number } | undefined =
      staleSince.current.get(slot);
    const at: number =
      since?.key === key && realRenders.current.has(slot) ? since.at : 0;
    const wait: number = Math.max(0, at + MIN_LOADING_MS - performance.now());
    setTimeout(() => {
      realRenders.current.delete(slot);
      if (!alive.current) return;
      setCache((c: ThumbnailCache) => ({
        ...c,
        [slot]: { key, url: url ?? c[slot]?.url ?? null },
      }));
    }, wait);
  };

  useEffect(() => {
    if (mode !== 'enhance' || !current) return;
    const slot: string = `enhance:${current.id}`;
    if (cache[slot]?.key === current.key) return;
    let cancelled: boolean = false;
    rendered.current.set(slot, current.key);
    (current.canvas
      ? thumbnailFrom(current.canvas)
      : Promise.resolve(null)
    ).then(
      (url: string | null) => {
        if (!cancelled) commit(slot, current.key, url);
      },
      (e: unknown) => {
        console.error(e);
        if (!cancelled) commit(slot, current.key, null);
      },
    );
    return (): void => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, current?.id, current?.key, current?.canvas]);

  useEffect(() => {
    if (!mode || paused || running.current) return;
    // In `enhance` mode, the document on display comes from the main preview
    const skip: string | null = mode === 'enhance' ? activeId : null;
    const stale: DocumentItem[] = documents.filter(
      (d: DocumentItem) =>
        d.id !== skip &&
        canPreview(d) &&
        rendered.current.get(`${mode}:${d.id}`) !== previewKey(mode, d),
    );
    const doc: DocumentItem | undefined =
      stale.find((d: DocumentItem) => d.id === activeId) ?? stale.at(0);
    if (!doc) return;
    const slot: string = `${mode}:${doc.id}`;
    const key: string = previewKey(mode, doc);
    running.current = true;
    rendered.current.set(slot, key);
    const options: EnhanceOptions = modeOptions(mode, doc);
    const cached: boolean = hasRender(doc, options);
    if (!cached) realRenders.current.add(slot);
    void (async (): Promise<void> => {
      let url: string | null = null;
      try {
        // A cached render only needs scaling down; a new one blocks the main thread
        if (!cached) await waitForPaint();
        if (!alive.current) return;
        url = await thumbnailFromPng(await renderDocument(doc, options));
      } catch (e) {
        console.error(e);
      } finally {
        running.current = false;
        if (alive.current) {
          commit(slot, key, url);
          setQueueTick((t: number) => t + 1);
        }
      }
    })();
  }, [documents, mode, activeId, paused, queueTick]);

  if (!mode) return {};
  return Object.fromEntries(
    documents.map((doc: DocumentItem) => {
      if (!canPreview(doc)) return [doc.id, { url: null, pending: false }];
      const slot: string = `${mode}:${doc.id}`;
      const entry: { key: string; url: string | null } | undefined =
        cache[slot];
      // A thumbnail whose render is cached is only being scaled down: no loading state for it
      const needsRender: boolean =
        realRenders.current.has(slot) ||
        !hasRender(doc, modeOptions(mode, doc));
      const pending: boolean =
        doc.id !== holdId &&
        entry?.key !== previewKey(mode, doc) &&
        needsRender;
      return [doc.id, { url: entry?.url ?? null, pending }];
    }),
  );
}
