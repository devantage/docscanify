import { useCallback, useState } from 'react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import { renderDocument } from '@/features/documents/renderCache';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import {
  downloadFile,
  exportDocuments,
  type ExportedFile,
  type ExportItem,
} from '@/lib/export';
import { withMinDuration } from '@/lib/loading';
import type { DocumentItem, ExportSettings } from '@/lib/types';

/** Export in progress. */
export interface ExportProgress {
  /** How many documents are encoded. */
  done: number;
  /** How many documents are exported. */
  total: number;
  /** The file is downloaded. */
  finished: boolean;
}

/** Id of the toast about the last export, so a new export replaces it. */
const EXPORT_TOAST: string = 'export';

export interface UseExportDocumentsResult {
  /** The export in progress, or null. */
  progress: ExportProgress | null;
  /** Exports the documents, in list order, with the given options. */
  start(documents: DocumentItem[], settings: ExportSettings): Promise<void>;
  /** Hides the finished progress. */
  dismissProgress(): void;
}

/**
 * Builds the export file from the documents and downloads it, reporting the outcome in a toast.
 * Renders already cached are reused, and the export lasts at least the minimum loading duration.
 *
 * @returns
 * - `progress`: the export in progress, or null. It stays `finished` after the download until
 *   `dismissProgress` is called, so the full bar can be shown for a moment.
 * - `start(documents, settings)`: exports the documents, in list order, with the given options.
 * - `dismissProgress()`: hides the finished progress.
 */
export function useExportDocuments(): UseExportDocumentsResult {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const [progress, setProgress] = useState<ExportProgress | null>(null);

  const start = async (
    documents: DocumentItem[],
    settings: ExportSettings,
  ): Promise<void> => {
    setProgress({ done: 0, total: documents.length, finished: false });
    toast.dismiss(EXPORT_TOAST);
    try {
      const file: ExportedFile = await withMinDuration(async () =>
        exportDocuments(
          documents.map((doc: DocumentItem): ExportItem => ({
            name: doc.source.name,
            render: async (): Promise<Uint8Array> => renderDocument(doc),
          })),
          settings,
          {
            batchName: t('files.documents'),
            onProgress: (done: number, total: number) => {
              setProgress({ done, total, finished: false });
            },
          },
        ),
      );
      downloadFile(file);
      toast.success(t('export.saved', { file: file.fileName }), {
        id: EXPORT_TOAST,
      });
      setProgress((p: ExportProgress | null) => p && { ...p, finished: true });
    } catch (e) {
      console.error(e);
      toast.error(t('export.saveFailed'), { id: EXPORT_TOAST });
      setProgress(null);
    }
  };

  const dismissProgress: () => void = useCallback(() => {
    setProgress(null);
  }, []);

  return { progress, start, dismissProgress };
}
