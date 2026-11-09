import { useContext } from 'react';

import {
  ToastContext,
  type ToastContextValue,
} from '@/components/toast/ToastContext';

/**
 * Shows success, info, warning, and error toasts, and dismisses them, through the nearest
 * `ToastProvider`.
 *
 * @throws When used outside `ToastProvider`.
 */
export function useToast(): ToastContextValue {
  const value: ToastContextValue | null = useContext(ToastContext);
  if (!value) throw new Error('useToast must be used inside ToastProvider');
  return value;
}
