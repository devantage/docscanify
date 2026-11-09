import { type RefObject, useEffect, useRef } from 'react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

/** Toast ids: each one is about a single ongoing condition, so showing it again replaces it. */
const CROSSED_TOAST: string = 'crop-crossed';
const INVALID_TOAST: string = 'crop-invalid';
const DETECTOR_TOAST: string = 'crop-detector';

export interface UseCropAlertsResult {
  /** Reported on drag end, not on every move, so the toast does not flicker. */
  dragEnded(): void;
}

/**
 * Toasts about the crop of the Crop step:
 * - crossed corners of the document on display, an error reported when a drag ends and when the
 *   document opens, and cleared once the corners are fixed;
 * - other documents that still need a crop fix, a warning shown again whenever their count
 *   changes (while the document on display has crossed corners, the error covers it);
 * - edges the detector could not find.
 *
 * @param doc Document on display.
 * @param invalidCount How many documents in the list have invalid corners.
 */
export function useCropAlerts(
  doc: DocumentItem,
  invalidCount: number,
): UseCropAlertsResult {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const crossed: boolean = !!doc.corners && !doc.valid;

  // Read through a ref: the drag end must see the corners of its last move
  const crossedRef: RefObject<boolean> = useRef(crossed);
  useEffect(() => {
    crossedRef.current = crossed;
  });

  const showCrossed = (): string =>
    toast.error(t('crop.crossed'), { id: CROSSED_TOAST });

  useEffect(() => {
    if (crossedRef.current) showCrossed();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when another document opens
  }, [doc.id]);

  useEffect(() => {
    if (!crossed) toast.dismiss(CROSSED_TOAST);
  }, [crossed, toast]);

  useEffect(() => {
    if (invalidCount === 0) toast.dismiss(INVALID_TOAST);
    else if (!crossed) {
      toast.warning(t('crop.invalid', { count: invalidCount }), {
        id: INVALID_TOAST,
      });
    }
  }, [invalidCount, crossed, toast, t]);

  useEffect(() => {
    if (doc.detectorFailed)
      toast.error(t('crop.detectorError'), { id: DETECTOR_TOAST });
  }, [doc.id, doc.detectorFailed, toast, t]);

  return {
    dragEnded: (): void => {
      if (crossedRef.current) showCrossed();
    },
  };
}
