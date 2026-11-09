import { type Context, createContext } from 'react';

/** Kind of toast: sets its color, its icon, and how urgently screen readers announce it. */
export type ToastKind = 'success' | 'info' | 'warning' | 'error';

/** Button of a toast, next to its message. */
export interface ToastAction {
  label: string;
  /** Called on the button; the toast closes. */
  onClick(): void;
}

export interface ToastOptions {
  /**
   * Identifies a toast about one ongoing condition, such as crossed corners. Showing a toast with
   * the id of one on screen replaces it instead of stacking, and `dismiss(id)` removes it.
   */
  id?: string;
  /** How long the toast stays on screen, in ms; `Infinity` keeps it until it is closed. */
  duration?: number;
  /** Button next to the message, such as "Update". */
  action?: ToastAction;
  /** Called when the user closes the toast with its close button. */
  onClose?(): void;
}

export interface ToastContextValue {
  /** Shows a success message. Returns the toast id. */
  success(message: string, options?: ToastOptions): string;
  /** Shows a neutral notice, such as a new version of the app. Returns the toast id. */
  info(message: string, options?: ToastOptions): string;
  /** Shows a warning: something needs attention, but nothing failed. Returns the toast id. */
  warning(message: string, options?: ToastOptions): string;
  /** Shows an error. Returns the toast id. */
  error(message: string, options?: ToastOptions): string;
  /** Removes a toast; without an id, removes every toast. */
  dismiss(id?: string): void;
}

export const ToastContext: Context<ToastContextValue | null> =
  createContext<ToastContextValue | null>(null);
