import { useContext } from 'react';

import { StepsContext, type StepsContextValue } from './StepsContext';

/**
 * The step on display and the navigation between steps.
 *
 * @throws When used outside `StepsProvider`.
 */
export function useSteps(): StepsContextValue {
  const value: StepsContextValue | null = useContext(StepsContext);
  if (!value) throw new Error('useSteps must be used inside StepsProvider');
  return value;
}
