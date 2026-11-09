import { isLocale, type Locale, LOCALES } from './config';

/** Where the user's explicit language choice is kept between visits. */
const STORAGE_KEY: string = 'docscanify.locale';

/** Base language of a tag, lowercased: `pt-BR` → `pt`. */
const language = (tag: string): string => tag.toLowerCase().split('-')[0];

/**
 * Picks the supported language that best matches a browser language tag, ignoring case: an exact
 * match first (`pt-BR`), then the same base language (`pt-PT` → `pt-BR`, `es-MX` → `es`,
 * `en-GB` → `en`).
 *
 * @returns The matching language, or null when none is supported.
 */
export function matchLocale(tag: string): Locale | null {
  const exact: (typeof LOCALES)[number] | undefined = LOCALES.find(
    (l: (typeof LOCALES)[number]) =>
      l.locale.toLowerCase() === tag.toLowerCase(),
  );
  if (exact) return exact.locale;
  return (
    LOCALES.find(
      (l: (typeof LOCALES)[number]) => language(l.locale) === language(tag),
    )?.locale ?? null
  );
}

/**
 * The language to start with: the one the user chose before, else the first browser language
 * (in the user's order of preference) that is supported, else the default.
 *
 * @param fallback Language used when nothing else matches.
 */
export function detectLocale(fallback: Locale): Locale {
  const stored: Locale | null = readStoredLocale();
  if (stored) return stored;
  // Typed as possibly missing: some browsers do not implement it
  const browser: Partial<Pick<Navigator, 'languages'>> = navigator;
  const tags: readonly string[] = browser.languages?.length
    ? browser.languages
    : [navigator.language];
  for (const tag of tags) {
    const match: '' | Locale | null = tag && matchLocale(tag);
    if (match) return match;
  }
  return fallback;
}

/**
 * The language the user chose before, if any.
 *
 * @returns The stored language, or null when there is none, it is not a supported tag, or storage
 * is unavailable.
 */
export function readStoredLocale(): Locale | null {
  try {
    const stored: string | null = localStorage.getItem(STORAGE_KEY);
    return isLocale(stored) ? stored : null;
  } catch {
    // Storage may be unavailable, such as in some private browsing modes
    return null;
  }
}

/** Remembers the user's language choice for the next visits, when storage is available. */
export function storeLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Without storage the choice only lasts for this visit
  }
}
