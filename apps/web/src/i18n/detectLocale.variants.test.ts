import { describe, expect, it, vi } from 'vitest';

import type * as Config from './config';
import type { Locale } from './config';
import { matchLocale } from './detectLocale';

// Two variants of Portuguese, as when the app adds pt-PT next to pt-BR: an exact tag must pick its
// own variant, not the first one with the same base language
vi.mock('./config', async (importOriginal: () => Promise<typeof Config>) => {
  const actual: typeof Config = await importOriginal();
  return {
    ...actual,
    LOCALES: [
      ...actual.LOCALES,
      {
        locale: 'pt-PT' as Locale,
        name: 'Português (Portugal)',
        short: 'PT',
        flag: 'br',
      },
    ],
  };
});

describe('matchLocale with several variants of a language', (): void => {
  it.each<[string, string]>([
    ['pt-PT', 'pt-PT'],
    ['pt-pt', 'pt-PT'],
    ['PT-PT', 'pt-PT'],
    ['pt-BR', 'pt-BR'],
    ['pt-br', 'pt-BR'],
  ])(
    'prefers the exact variant for %s over the first one of the same language',
    (tag: string, expected: string): void => {
      expect(matchLocale(tag)).toBe(expected);
    },
  );

  it.each<string>(['pt', 'pt-AO'])(
    'falls back from %s to the first listed variant of the language',
    (tag: string): void => {
      expect(matchLocale(tag)).toBe('pt-BR');
    },
  );
});
