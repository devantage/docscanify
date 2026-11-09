import { type Context, createContext } from 'react';

import type { Step } from './steps';

export interface StepsContextValue {
  step: Step;
  goTo(step: Step): void;
}

export const StepsContext: Context<StepsContextValue | null> =
  createContext<StepsContextValue | null>(null);
