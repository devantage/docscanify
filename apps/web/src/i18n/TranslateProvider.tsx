import type { JSX } from 'react';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { DEFAULT_LOCALE, type Locale, MESSAGES } from './config';
import { detectLocale, storeLocale } from './detectLocale';
import { createTranslate } from './translate';
import {
  TranslateContext,
  type TranslateContextValue,
} from './TranslateContext';

interface Props {
  children: ReactNode;
  /** Language used when no browser language is supported. Defaults to `DEFAULT_LOCALE`. */
  defaultLocale?: Locale;
}

/**
 * Provides the current language and its translate function to the app. The language starts as
 * the user's previous choice or the best browser match. `<html lang>`, the page description, and
 * the app manifest follow it.
 */
export function TranslateProvider({
  children,
  defaultLocale = DEFAULT_LOCALE,
}: Props): JSX.Element {
  const [locale, setLocaleState] = useState<Locale>(() =>
    detectLocale(defaultLocale),
  );

  const setLocale: (next: Locale) => void = useCallback((next: Locale) => {
    storeLocale(next);
    setLocaleState(next);
  }, []);

  const value: TranslateContextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t: createTranslate(locale, MESSAGES[locale], MESSAGES[defaultLocale]),
    }),
    [locale, setLocale, defaultLocale],
  );

  // The page language, its description, and the app manifest follow the current language. The
  // manifests are built per language by `plugins/webManifest.ts`.
  useEffect(() => {
    document.documentElement.lang = locale;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', value.t('app.description'));
    const manifest: HTMLLinkElement | null =
      document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (manifest)
      manifest.href = `${import.meta.env.BASE_URL}manifest.${locale}.webmanifest`;
  }, [locale, value]);

  return (
    <TranslateContext.Provider value={value}>
      {children}
    </TranslateContext.Provider>
  );
}
