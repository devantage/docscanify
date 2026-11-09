import { type JSX, type ReactNode, useState } from 'react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import type { CameraContextValue } from '@/features/camera/CameraContext';
import { useCamera } from '@/features/camera/useCamera';
import {
  useDocuments,
  type UseDocumentsResult,
} from '@/features/documents/useDocuments';
import {
  describeImport,
  type ImportResult,
  useImportFiles,
} from '@/features/documents/useImportFiles';
import {
  type CurrentRender,
  type Preview,
  type PreviewMode,
  usePreviews,
} from '@/features/documents/usePreviews';
import { type Step, useSteps } from '@/features/steps';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import { DEFAULT_EXPORT_SETTINGS } from '@/lib/export';
import type { DocumentItem, ExportSettings } from '@/lib/types';

import { ScanContext, type ScanContextValue } from './ScanContext';

/** Id of the toast about the last import, so a new import replaces it. */
const IMPORT_TOAST: string = 'import';

const PREVIEW_MODES: Record<Step, PreviewMode | null> = {
  upload: null,
  crop: 'crop',
  enhance: 'enhance',
  export: 'enhance',
};

/**
 * Provides the scanning session to every step: the documents and their operations, the import of
 * new images, the thumbnails, and the export options. Operations that change the step, such as
 * adding images from a later step, follow the rules of the flow here, so steps only call them.
 */
export function ScanProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const { step, goTo } = useSteps();
  const camera: CameraContextValue = useCamera();
  const docs: UseDocumentsResult = useDocuments();
  const { progress, importFiles, dismissProgress } = useImportFiles();
  const [exportSettings, setExportSettings] = useState<ExportSettings>(
    DEFAULT_EXPORT_SETTINGS,
  );
  const [draggingCorner, setDraggingCorner] = useState(false);
  const [mainRender, setMainRender] = useState<CurrentRender | null>(null);
  const { documents, active } = docs;

  const addFiles = async (files: File[]): Promise<void> => {
    toast.dismiss(IMPORT_TOAST);
    const result: ImportResult | null = await importFiles(files);
    if (!result) return;
    const outcome: ReturnType<typeof describeImport> = describeImport(
      result,
      t,
    );
    if (outcome) toast[outcome.kind](outcome.message, { id: IMPORT_TOAST });
    if (!result.added.length) return;
    docs.add(result.added);
    if (step !== 'upload') goTo('crop');
  };

  const removeDocument = (id: string): void => {
    if (docs.remove(id) === 0) goTo('upload');
  };

  const restart = (): void => {
    docs.clear();
    setExportSettings(DEFAULT_EXPORT_SETTINGS);
    toast.dismiss();
    goTo('upload');
  };

  // The camera covers the step, so its thumbnails are not on screen
  const previewMode: PreviewMode | null = camera.isOpen
    ? null
    : PREVIEW_MODES[step];
  const previews: Record<string, Preview> = usePreviews(
    documents,
    previewMode,
    {
      activeId: active?.id ?? null,
      current: mainRender,
      // The main preview has priority in Enhance and Export; the corner drag, in Crop
      paused: previewMode === 'enhance' ? !mainRender : draggingCorner,
      holdId: draggingCorner ? (active?.id ?? null) : null,
    },
  );

  const value: ScanContextValue = {
    documents,
    active,
    invalidCount: documents.filter((d: DocumentItem) => !d.corners || !d.valid)
      .length,
    previews,
    importProgress: progress,
    exportSettings,
    addFiles,
    removeDocument,
    reorder: docs.reorder,
    select: docs.select,
    setCorners: docs.setCorners,
    redetect: (id: string) => {
      void docs.redetect(id);
    },
    setOptions: docs.setOptions,
    applyOptionsToAll: docs.applyOptionsToAll,
    setExportSettings,
    restart,
    dismissImportProgress: dismissProgress,
    setMainRender,
    setDraggingCorner,
  };

  return <ScanContext.Provider value={value}>{children}</ScanContext.Provider>;
}
