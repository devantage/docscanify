import { type Context, createContext } from 'react';

import type { Locale } from './config';
import type { TranslateFunction } from './translate';

export interface TranslateContextValue {
  /** Current language. */
  locale: Locale;
  /** Changes the language and remembers the choice. */
  setLocale(locale: Locale): void;
  /** Translates a key in the current language. */
  t: TranslateFunction;
}

export const TranslateContext: Context<TranslateContextValue | null> =
  createContext<TranslateContextValue | null>(null);
