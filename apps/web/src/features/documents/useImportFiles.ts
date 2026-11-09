import { type RefObject, useCallback, useRef, useState } from 'react';

import { type TranslateFunction, useTranslate } from '@/i18n';
import { sourceFromFile } from '@/lib/image';
import { waitForPaint, withMinDuration } from '@/lib/loading';
import { NO_ENHANCEMENTS } from '@/lib/scan';
import type { DocumentItem, SourceImage } from '@/lib/types';

import { detectCrop } from './detectCrop';

export interface ImportResult {
  /** Documents created, in the order the files were received. */
  added: DocumentItem[];
  /** How many files could not be opened. */
  failed: number;
  /** How many files were received. */
  total: number;
}

export interface ImportProgress {
  /** What is happening to the current file. */
  phase: 'opening' | 'detecting';
  /** Position of the current file, from 1. */
  current: number;
  /** How many files are being imported. */
  total: number;
  /**
   * Overall progress, from 0 to 1. Each file counts two steps, opening and detecting, plus one
   * last step for the end of the import; 1 means the import is done.
   */
  value: number;
}

/**
 * User-facing description of the import in progress: what is happening to the current file and,
 * with more than one file, which one it is out of how many.
 */
export function describeProgress(
  { phase, current, total }: ImportProgress,
  t: TranslateFunction,
): string {
  if (total === 1)
    return t(phase === 'opening' ? 'import.opening' : 'import.detecting');
  return t(phase === 'opening' ? 'import.openingOf' : 'import.detectingOf', {
    current,
    total,
  });
}

/**
 * User-facing message about the files that could not be opened.
 *
 * @returns An error when nothing was imported, a warning when some files failed, or null.
 */
export function describeImport(
  { added, failed, total }: ImportResult,
  t: TranslateFunction,
): { kind: 'error' | 'warning'; message: string } | null {
  if (!added.length)
    return { kind: 'error', message: t('import.noneOpened', { count: total }) };
  if (!failed) return null;
  return {
    kind: 'warning',
    message: t('import.someFailed', { count: failed }),
  };
}

export interface UseImportFilesResult {
  progress: ImportProgress | null;
  importFiles(files: File[]): Promise<ImportResult | null>;
  dismissProgress(): void;
}

/**
 * Turns image files into documents: opens each one and detects its corners, in a single loading
 * state that lasts at least the minimum duration.
 *
 * @returns
 * - `progress`: the import in progress, or null. It stays at 1 after the import is done, until
 *   `dismissProgress` is called, so the full bar can be shown for a moment.
 * - `importFiles(files)`: imports the files; resolves when they are done, or to null when there
 *   are no files or an import is already running.
 */
export function useImportFiles(): UseImportFilesResult {
  const { t } = useTranslate();
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const busy: RefObject<boolean> = useRef(false);
  const nextId: RefObject<number> = useRef(0);

  const importFiles = async (files: File[]): Promise<ImportResult | null> => {
    if (busy.current || !files.length) return null;
    busy.current = true;
    const total: number = files.length;
    const steps: number = 2 * total + 1;
    try {
      // The bar is on screen before the minimum duration starts counting
      setProgress({ phase: 'opening', current: 1, total, value: 0 });
      await waitForPaint();
      const result: ImportResult = await withMinDuration(async () => {
        const added: DocumentItem[] = [];
        let failed: number = 0;
        for (const [i, file] of files.entries()) {
          const current: number = i + 1;
          setProgress({
            phase: 'opening',
            current,
            total,
            value: (2 * i) / steps,
          });
          await waitForPaint();
          let source: SourceImage;
          try {
            source = await sourceFromFile(file, t('files.document'));
          } catch (e) {
            console.error(e);
            failed++;
            continue;
          }
          setProgress({
            phase: 'detecting',
            current,
            total,
            value: (2 * i + 1) / steps,
          });
          await waitForPaint();
          added.push({
            id: String(++nextId.current),
            source,
            ...(await detectCrop(source)),
            options: NO_ENHANCEMENTS,
          });
        }
        setProgress(
          (p: ImportProgress | null) =>
            p && { ...p, value: (2 * total) / steps },
        );
        return { added, failed, total };
      });
      setProgress((p: ImportProgress | null) => p && { ...p, value: 1 });
      return result;
    } catch (e) {
      setProgress(null);
      throw e;
    } finally {
      busy.current = false;
    }
  };

  const dismissProgress: () => void = useCallback(() => {
    setProgress(null);
  }, []);

  return { progress, importFiles, dismissProgress };
}
