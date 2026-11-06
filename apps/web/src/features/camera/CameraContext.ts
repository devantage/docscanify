import { type Context, createContext } from 'react';

export interface CameraContextValue {
  /** The camera covers the workspace of the step on display. */
  isOpen: boolean;
  /** Opens the camera over the step on display. */
  open(): void;
  /** Closes the camera, back to the step on display. */
  close(): void;
}

export const CameraContext: Context<CameraContextValue | null> =
  createContext<CameraContextValue | null>(null);
