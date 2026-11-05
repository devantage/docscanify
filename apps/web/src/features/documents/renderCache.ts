import type { Corners } from '@devantage/docscanify';

import { renderWith } from '@/lib/scan';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

/** Renders kept per document: enough for the crop-only and the enhanced versions, plus one more. */
const MAX_RENDERS_PER_DOCUMENT: number = 3;

interface Entry {
  png: Promise<Uint8Array>;
  done: boolean;
}

// Document id → render key → render, oldest first. Module-level: there is a single document list
const renders: Map<string, Map<string, Entry>> = new Map<
  string,
  Map<string, Entry>
>();

/** What a render depends on besides the document: its crop corners and adjustments. */
const renderKey = (corners: Corners | null, options: EnhanceOptions): string =>
  JSON.stringify([corners, options]);

/**
 * Renders a document, reusing an earlier render with the same corners and adjustments. Concurrent
 * requests for the same render share it, so it runs once.
 *
 * @param doc Document from the list, with its crop corners set.
 * @param options Adjustments to apply; defaults to the document's own.
 * @returns The rendered document, as PNG.
 */
export async function renderDocument(
  doc: DocumentItem,
  options: EnhanceOptions = doc.options,
): Promise<Uint8Array> {
  const key: string = renderKey(doc.corners, options);
  let documentRenders: Map<string, Entry> | undefined = renders.get(doc.id);
  if (!documentRenders)
    renders.set(doc.id, (documentRenders = new Map<string, Entry>()));

  const cached: Entry | undefined = documentRenders.get(key);
  if (cached) {
    // Most recently used goes last, so the oldest is evicted first
    documentRenders.delete(key);
    documentRenders.set(key, cached);
    return cached.png;
  }

  const entry: Entry = {
    png: renderWith(doc.source.scannedDocument, options),
    done: false,
  };
  const owner: Map<string, Entry> = documentRenders;
  entry.png.then(
    () => (entry.done = true),
    // A failed render is not kept, so the next request tries again
    () => owner.get(key) === entry && owner.delete(key),
  );
  documentRenders.set(key, entry);
  while (documentRenders.size > MAX_RENDERS_PER_DOCUMENT) {
    const oldest: string | undefined = documentRenders.keys().next().value;
    if (oldest === undefined) break;
    documentRenders.delete(oldest);
  }
  return entry.png;
}

/**
 * Whether a finished render with these corners and adjustments is available, so showing it needs
 * no loading state.
 */
export function hasRender(
  doc: DocumentItem,
  options: EnhanceOptions = doc.options,
): boolean {
  return !!renders.get(doc.id)?.get(renderKey(doc.corners, options))?.done;
}

/**
 * Drops the renders of a document, such as when it is removed.
 *
 * @param id Document id; without it, every render is dropped.
 */
export function forgetRenders(id?: string): void {
  if (id === undefined) renders.clear();
  else renders.delete(id);
}
