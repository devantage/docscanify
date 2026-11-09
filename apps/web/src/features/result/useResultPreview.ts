import { useEffect } from 'react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import { previewKey } from '@/features/documents/usePreviews';
import { useScan } from '@/features/scan/useScan';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import {
  useRenderedDocument,
  type UseRenderedDocumentResult,
} from './useRenderedDocument';

/** Id of the toast about a failed render, so it shows up once and goes away on success. */
const FAILED_TOAST: string = 'render-failed';

/**
 * The main preview of the Enhance and Export steps: renders the document on display (see
 * {@link useRenderedDocument}), shares the result as that document's thumbnail, and reports a
 * failed render in a toast.
 *
 * @param doc Document on display, with its crop corners set.
 */
export function useResultPreview(doc: DocumentItem): UseRenderedDocumentResult {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const { setMainRender } = useScan();
  const rendered: UseRenderedDocumentResult = useRenderedDocument(doc);
  const { ready, failed, result } = rendered;
  const key: string = previewKey('enhance', doc);

  useEffect(() => {
    setMainRender(
      ready ? { id: doc.id, key, canvas: failed ? null : result } : null,
    );
  }, [ready, failed, result, doc.id, key, setMainRender]);

  useEffect(
    () => (): void => {
      setMainRender(null);
    },
    [setMainRender],
  );

  useEffect(() => {
    if (failed) toast.error(t('result.failed'), { id: FAILED_TOAST });
    else toast.dismiss(FAILED_TOAST);
  }, [failed, toast, t]);

  return rendered;
}
