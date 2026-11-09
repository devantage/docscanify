import { type JSX, type ReactNode, useMemo, useState } from 'react';

import type { Step } from './steps';
import { StepsContext, type StepsContextValue } from './StepsContext';

/** Provides the step on display and the navigation between steps. The flow starts at Upload. */
export function StepsProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [step, setStep] = useState<Step>('upload');
  const value: StepsContextValue = useMemo(
    () => ({ step, goTo: setStep }),
    [step],
  );
  return (
    <StepsContext.Provider value={value}>{children}</StepsContext.Provider>
  );
}
