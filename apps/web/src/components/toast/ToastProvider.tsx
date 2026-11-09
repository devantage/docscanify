import './Toast.css';

import {
  type JSX,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { useTranslate } from '@/i18n';

import { Toast } from './Toast';
import {
  type ToastAction,
  ToastContext,
  type ToastContextValue,
  type ToastKind,
  type ToastOptions,
} from './ToastContext';

/** How long a toast stays on screen by default, in ms. */
const DEFAULT_DURATION: number = 6000;
/**
 * Toasts on screen at once. Beyond it, the oldest one that would go away by itself is removed;
 * toasts that stay until closed are only removed when every toast stays until closed.
 */
const MAX_TOASTS: number = 3;

interface Item {
  id: string;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  onClose?(): void;
  /** Stays until closed. */
  persistent: boolean;
}

/** Keeps at most {@link MAX_TOASTS}, removing the oldest temporary ones first. */
function trim(list: Item[]): Item[] {
  const next: Item[] = [...list];
  while (next.length > MAX_TOASTS) {
    const temporary: number = next.findIndex(
      (toast: Item) => !toast.persistent,
    );
    next.splice(temporary >= 0 ? temporary : 0, 1);
  }
  return next;
}

/**
 * Shows toasts for the whole app: success, info, warning, and error messages stacked under the
 * top bar, each one going away by itself (unless it stays until closed) or when closed. A toast
 * may have an action button.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { t } = useTranslate();
  const [toasts, setToasts] = useState<Item[]>([]);
  const timers: RefObject<Map<string, number>> = useRef(
    new Map<string, number>(),
  );
  const nextId: RefObject<number> = useRef(0);

  const dismiss: (id?: string) => void = useCallback((id?: string) => {
    const ids: string[] = id === undefined ? [...timers.current.keys()] : [id];
    ids.forEach((key: string) => {
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
    });
    setToasts((list: Item[]) =>
      id === undefined ? [] : list.filter((toast: Item) => toast.id !== id),
    );
  }, []);

  const show: (
    kind: ToastKind,
    message: string,
    options?: ToastOptions,
  ) => string = useCallback(
    (
      kind: ToastKind,
      message: string,
      { id, duration = DEFAULT_DURATION, action, onClose }: ToastOptions = {},
    ) => {
      const key: string = id ?? `toast-${++nextId.current}`;
      const persistent: boolean = !Number.isFinite(duration);
      setToasts((list: Item[]) =>
        trim([
          ...list.filter((toast: Item) => toast.id !== key),
          { id: key, kind, message, action, onClose, persistent },
        ]),
      );
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      if (!persistent) {
        timers.current.set(
          key,
          window.setTimeout(() => {
            dismiss(key);
          }, duration),
        );
      }
      return key;
    },
    [dismiss],
  );

  useEffect(() => {
    const pending: Map<string, number> = timers.current;
    return (): void => {
      pending.forEach((timer: number) => {
        clearTimeout(timer);
      });
    };
  }, []);

  const value: ToastContextValue = useMemo(
    (): ToastContextValue => ({
      success: (message: string, options?: ToastOptions): string =>
        show('success', message, options),
      info: (message: string, options?: ToastOptions): string =>
        show('info', message, options),
      warning: (message: string, options?: ToastOptions): string =>
        show('warning', message, options),
      error: (message: string, options?: ToastOptions): string =>
        show('error', message, options),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section className="toasts" aria-label={t('common.notifications')}>
        {toasts.map((toast: Item) => {
          const action: ToastAction | undefined = toast.action;
          return (
            <Toast
              key={toast.id}
              kind={toast.kind}
              message={toast.message}
              action={
                action && {
                  label: action.label,
                  onClick: (): void => {
                    dismiss(toast.id);
                    action.onClick();
                  },
                }
              }
              onClose={() => {
                dismiss(toast.id);
                toast.onClose?.();
              }}
            />
          );
        })}
      </section>
    </ToastContext.Provider>
  );
}
