import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from './config';
import {
  detectLocale,
  matchLocale,
  readStoredLocale,
  storeLocale,
} from './detectLocale';

/** Where the app keeps the language choice: changing it would forget every user's choice. */
const STORAGE_KEY: string = 'docscanify.locale';

/** Makes the browser report these languages, in this order of preference. */
const browserLanguages = (languages: string[], language: string = ''): void => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(language);
};

/** Makes localStorage throw, as in some private browsing modes. */
const storageUnavailable = (): void => {
  const fail = (): never => {
    throw new DOMException('The operation is insecure.', 'SecurityError');
  };
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(fail);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(fail);
};

describe('matchLocale', (): void => {
  it.each<[string, Locale]>([
    ['pt-BR', 'pt-BR'],
    ['en', 'en'],
    ['es', 'es'],
  ])(
    'matches the supported language %s exactly',
    (tag: string, expected: Locale): void => {
      expect(matchLocale(tag)).toBe(expected);
    },
  );

  it.each<[string, Locale]>([
    ['PT-br', 'pt-BR'],
    ['pt-br', 'pt-BR'],
    ['EN', 'en'],
    ['Es', 'es'],
    ['EN-GB', 'en'],
    ['PT-pt', 'pt-BR'],
    ['ES-MX', 'es'],
  ])('ignores the letter case of %s', (tag: string, expected: Locale): void => {
    expect(matchLocale(tag)).toBe(expected);
  });

  it.each<[string, Locale]>([
    ['pt-PT', 'pt-BR'],
    ['pt', 'pt-BR'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['en-GB', 'en'],
    ['en-US', 'en'],
    ['en-Latn-US', 'en'],
  ])(
    'falls back from the regional variant %s to the same language (%s)',
    (tag: string, expected: Locale): void => {
      expect(matchLocale(tag)).toBe(expected);
    },
  );

  it.each<string>(['fr-FR', 'de', 'it-IT', 'ja', 'portuguese', 'e', ''])(
    'returns null for the unsupported language "%s"',
    (tag: string): void => {
      expect(matchLocale(tag)).toBeNull();
    },
  );
});

describe('detectLocale', (): void => {
  afterEach((): void => {
    localStorage.clear();
  });

  it('prefers the language the user chose before over the browser languages', (): void => {
    browserLanguages(['es-MX', 'en-US']);
    localStorage.setItem(STORAGE_KEY, 'pt-BR');

    expect(detectLocale('en')).toBe('pt-BR');
  });

  it('ignores a stored value that is not a supported language', (): void => {
    browserLanguages(['es-MX']);
    localStorage.setItem(STORAGE_KEY, 'fr');

    expect(detectLocale('en')).toBe('es');
  });

  it('ignores a stored value with another letter case, since it is not a supported tag', (): void => {
    browserLanguages(['es']);
    localStorage.setItem(STORAGE_KEY, 'PT-BR');

    expect(detectLocale('en')).toBe('es');
  });

  it('picks the first supported browser language, in the order of preference', (): void => {
    browserLanguages(['fr-FR', 'de', 'es-MX', 'en-US', 'pt-BR']);

    expect(detectLocale('pt-BR')).toBe('es');
  });

  it('keeps the browser order even when a later language matches exactly', (): void => {
    browserLanguages(['pt-PT', 'en', 'pt-BR']);

    expect(detectLocale('es')).toBe('pt-BR');
    browserLanguages(['en-GB', 'pt-BR']);

    expect(detectLocale('es')).toBe('en');
  });

  it('falls back to the given language when no browser language is supported', (): void => {
    browserLanguages(['fr-FR', 'de-DE', 'ja']);

    expect(detectLocale('pt-BR')).toBe('pt-BR');
    expect(detectLocale('es')).toBe('es');
  });

  it('uses navigator.language when navigator.languages is empty', (): void => {
    browserLanguages([], 'es-AR');

    expect(detectLocale('en')).toBe('es');
  });

  it('uses navigator.language when the browser does not implement navigator.languages', (): void => {
    vi.stubGlobal('navigator', { language: 'pt-PT' });

    expect(detectLocale('en')).toBe('pt-BR');
  });

  it('falls back when navigator.language is empty too', (): void => {
    browserLanguages([], '');

    expect(detectLocale('es')).toBe('es');
  });

  it('skips empty browser language tags', (): void => {
    browserLanguages(['', 'pt-BR']);

    expect(detectLocale('en')).toBe('pt-BR');
  });

  it('uses the browser languages when storage is unavailable', (): void => {
    browserLanguages(['es-ES']);
    storageUnavailable();

    expect(detectLocale('en')).toBe('es');
  });
});

describe('storeLocale and readStoredLocale', (): void => {
  it('has no stored language before the user picks one', (): void => {
    expect(readStoredLocale()).toBeNull();
  });

  it('remembers the chosen language under the app key', (): void => {
    storeLocale('es');

    expect(localStorage.getItem(STORAGE_KEY)).toBe('es');
    expect(readStoredLocale()).toBe('es');
  });

  it('replaces the previous choice', (): void => {
    storeLocale('es');
    storeLocale('pt-BR');

    expect(readStoredLocale()).toBe('pt-BR');
  });

  it('makes the stored choice win on the next detection', (): void => {
    browserLanguages(['en-US']);
    storeLocale('pt-BR');

    expect(detectLocale('en')).toBe('pt-BR');
  });

  it('does not throw when storage is unavailable, and reads nothing back', (): void => {
    storageUnavailable();

    expect((): void => {
      storeLocale('es');
    }).not.toThrow();
    expect(readStoredLocale()).toBeNull();
  });
});
