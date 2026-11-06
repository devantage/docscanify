import type { Corners } from '@devantage/docscanify';
import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useRef,
  useState,
} from 'react';

import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { type CropState, detectCrop } from './detectCrop';
import { forgetRenders } from './renderCache';

/** The document list returned by {@link useDocuments}, with its operations. */
export interface UseDocumentsResult {
  documents: DocumentItem[];
  active: DocumentItem | null;
  select: Dispatch<SetStateAction<string | null>>;
  add(items: DocumentItem[]): void;
  remove(id: string): number;
  reorder(from: number, to: number): void;
  setCorners(id: string, corners: Corners): void;
  setOptions(id: string, options: EnhanceOptions): void;
  applyOptionsToAll(sourceId: string): void;
  redetect(id: string): Promise<void>;
  clear(): void;
}

/**
 * The list of documents being scanned, in export order, and the one on display.
 *
 * @returns The list, the active document, and the operations on them.
 */
export function useDocuments(): UseDocumentsResult {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Only the latest detection of each document counts: an earlier one may finish later
  const detectionRuns: RefObject<Map<string, number>> = useRef(
    new Map<string, number>(),
  );

  const active: DocumentItem | null =
    documents.find((d: DocumentItem) => d.id === activeId) ??
    documents.at(0) ??
    null;

  const update = (id: string, patch: Partial<DocumentItem>): void => {
    setDocuments((list: DocumentItem[]) =>
      list.map((d: DocumentItem) => (d.id === id ? { ...d, ...patch } : d)),
    );
  };

  /** Appends documents to the end of the list and selects the first of them. */
  const add = (items: DocumentItem[]): void => {
    if (!items.length) return;
    setDocuments((list: DocumentItem[]) => [...list, ...items]);
    setActiveId(items[0].id);
  };

  /**
   * Removes a document. When it was the active one, its neighbor becomes active.
   *
   * @returns How many documents are left.
   */
  const remove = (id: string): number => {
    const index: number = documents.findIndex((d: DocumentItem) => d.id === id);
    if (index < 0) return documents.length;
    const rest: DocumentItem[] = documents.filter(
      (d: DocumentItem) => d.id !== id,
    );
    URL.revokeObjectURL(documents[index].source.url);
    detectionRuns.current.delete(id);
    forgetRenders(id);
    setDocuments(rest);
    if (!rest.length) setActiveId(null);
    else if (id === active?.id)
      setActiveId(rest[Math.min(index, rest.length - 1)].id);
    return rest.length;
  };

  /** Moves the document at `from` to `to`; the list order is the export order. */
  const reorder = (from: number, to: number): void => {
    setDocuments((list: DocumentItem[]) => {
      const next: DocumentItem[] = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  /** Sets the crop corners. Crossed corners are kept on screen but marked invalid. */
  const setCorners = (id: string, corners: Corners): void => {
    const doc: DocumentItem | undefined = documents.find(
      (d: DocumentItem) => d.id === id,
    );
    if (!doc) return;
    let valid: boolean = true;
    try {
      // The document validates the corners and, when it rejects them, keeps the last valid ones
      doc.source.scannedDocument.corners = corners;
    } catch {
      valid = false;
    }
    update(id, { corners, valid });
  };

  const setOptions = (id: string, options: EnhanceOptions): void => {
    update(id, { options });
  };

  /** Copies color, sharpness, and noise reduction from one document to all the others. */
  const applyOptionsToAll = (sourceId: string): void => {
    const source: DocumentItem | undefined = documents.find(
      (d: DocumentItem) => d.id === sourceId,
    );
    if (!source) return;
    const { filter, sharpen, denoise } = source.options;
    setDocuments((list: DocumentItem[]) =>
      list.map((d: DocumentItem) =>
        // The source keeps its object identity, so its panel does not reset
        d.id === sourceId
          ? d
          : { ...d, options: { ...d.options, filter, sharpen, denoise } },
      ),
    );
  };

  /**
   * Detects the document edges again and puts the corners on them or, when no document is
   * found, on the image corners.
   */
  const redetect = async (id: string): Promise<void> => {
    const doc: DocumentItem | undefined = documents.find(
      (d: DocumentItem) => d.id === id,
    );
    if (!doc) return;
    const run: number = (detectionRuns.current.get(id) ?? 0) + 1;
    detectionRuns.current.set(id, run);
    const crop: CropState = await detectCrop(doc.source);
    if (detectionRuns.current.get(id) === run) update(id, crop);
  };

  /** Discards every document. */
  const clear = (): void => {
    documents.forEach((d: DocumentItem) => {
      URL.revokeObjectURL(d.source.url);
    });
    detectionRuns.current.clear();
    forgetRenders();
    setDocuments([]);
    setActiveId(null);
  };

  return {
    documents,
    active,
    select: setActiveId,
    add,
    remove,
    reorder,
    setCorners,
    setOptions,
    applyOptionsToAll,
    redetect,
    clear,
  };
}
