import type { JSX } from 'react';

import { ProgressOverlay } from '@/components/ProgressOverlay';
import { describeProgress } from '@/features/documents/useImportFiles';
import { useTranslate } from '@/i18n';

import { useScan } from './useScan';

/** Progress of the images being imported, over the workspace; nothing when no import runs. */
export function ImportProgress(): JSX.Element | null {
  const { t } = useTranslate();
  const { importProgress, dismissImportProgress } = useScan();
  if (!importProgress) return null;

  return (
    <ProgressOverlay
      label={describeProgress(importProgress, t)}
      value={importProgress.value}
      onComplete={dismissImportProgress}
    />
  );
}
