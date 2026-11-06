import { type Context, createContext } from 'react';

import type { Step } from './steps';

export interface StepsContextValue {
  /** Step on display. */
  step: Step;
  /** Opens a step. */
  goTo(step: Step): void;
}

export const StepsContext: Context<StepsContextValue | null> =
  createContext<StepsContextValue | null>(null);
