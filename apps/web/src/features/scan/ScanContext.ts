import type { Corners } from '@devantage/docscanify';
import { type Context, createContext } from 'react';

import type { ImportProgress } from '@/features/documents/useImportFiles';
import type { CurrentRender, Preview } from '@/features/documents/usePreviews';
import type { DocumentItem, EnhanceOptions, ExportSettings } from '@/lib/types';

export interface ScanContextValue {
  /** Documents in the list, in export order. */
  documents: DocumentItem[];
  /** Document on display; null without documents. */
  active: DocumentItem | null;
  /** How many documents have no corners or crossed corners. */
  invalidCount: number;
  /** Thumbnails of the documents as they look in the step on display, by id. */
  previews: Record<string, Preview>;
  /** Images being imported, or null. */
  importProgress: ImportProgress | null;
  /** Export options. */
  exportSettings: ExportSettings;

  /**
   * Imports images and appends them to the list. From the Upload step, it stays there; from Crop
   * onward, it goes to Crop with the first new document selected.
   */
  addFiles(files: File[]): Promise<void>;
  /** Removes a document; without any left, goes back to the Upload step. */
  removeDocument(id: string): void;
  /** Moves the document at `from` to `to`; the list order is the export order. */
  reorder(from: number, to: number): void;
  /** Puts a document on display. */
  select(id: string): void;
  /** Sets the crop corners of a document. Crossed corners are kept but marked invalid. */
  setCorners(id: string, corners: Corners): void;
  /** Detects the edges of a document again. */
  redetect(id: string): void;
  /** Sets the adjustments of a document. */
  setOptions(id: string, options: EnhanceOptions): void;
  /** Copies color, sharpness, and noise reduction from one document to all the others. */
  applyOptionsToAll(sourceId: string): void;
  /** Sets the export options. */
  setExportSettings(settings: ExportSettings): void;
  /** Discards every document and the export options, and starts over at the Upload step. */
  restart(): void;
  /** Hides the finished import progress. */
  dismissImportProgress(): void;

  /**
   * Shares the main preview result of the Enhance and Export steps, which becomes the thumbnail
   * of the document on display; null while it renders and when leaving these steps.
   */
  setMainRender(current: CurrentRender | null): void;
  /** Tells whether a crop corner is being dragged, to pause thumbnails in the background. */
  setDraggingCorner(dragging: boolean): void;
}

export const ScanContext: Context<ScanContextValue | null> =
  createContext<ScanContextValue | null>(null);
