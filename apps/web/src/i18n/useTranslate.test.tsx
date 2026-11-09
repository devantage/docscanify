import { renderHook, type RenderHookResult } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MESSAGES } from './config';
import type { TranslateContextValue } from './TranslateContext';
import { TranslateProvider } from './TranslateProvider';
import { useTranslate } from './useTranslate';

/** Wraps the hook in a provider whose default language is pt-BR. */
const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TranslateProvider defaultLocale="pt-BR">{children}</TranslateProvider>
);

describe('useTranslate', (): void => {
  afterEach((): void => {
    document.documentElement.removeAttribute('lang');
  });

  it('throws a clear error when used outside TranslateProvider', (): void => {
    // React logs the error thrown while rendering; keep the test output clean
    vi.spyOn(console, 'error').mockImplementation((): void => undefined);

    expect((): void => {
      renderHook((): TranslateContextValue => useTranslate());
    }).toThrow('useTranslate must be used inside TranslateProvider');
  });

  it('gives the current language, its translate function and setLocale inside the provider', (): void => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['fr-FR']);

    const { result }: RenderHookResult<TranslateContextValue, unknown> =
      renderHook((): TranslateContextValue => useTranslate(), { wrapper });

    expect(result.current.locale).toBe('pt-BR');
    expect(result.current.t('app.description')).toBe(
      MESSAGES['pt-BR'].app.description,
    );
    expect(typeof result.current.setLocale).toBe('function');
  });
});
