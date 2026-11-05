import { useContext } from 'react';

import {
  TranslateContext,
  type TranslateContextValue,
} from './TranslateContext';

/**
 * The current language, its translate function, and a way to change it.
 *
 * @throws When used outside `TranslateProvider`.
 */
export function useTranslate(): TranslateContextValue {
  const value: TranslateContextValue | null = useContext(TranslateContext);
  if (!value)
    throw new Error('useTranslate must be used inside TranslateProvider');
  return value;
}
