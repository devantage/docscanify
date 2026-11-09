import { render, type RenderResult, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import type * as Config from './config';
import { type Locale } from './config';
import type { TranslateContextValue } from './TranslateContext';
import { TranslateProvider } from './TranslateProvider';
import { useTranslate } from './useTranslate';

// Spanish without `common.back`, as a language that has not translated a new message yet
vi.mock('./config', async (importOriginal: () => Promise<typeof Config>) => {
  const actual: typeof Config = await importOriginal();
  const es: Record<string, unknown> = structuredClone(actual.MESSAGES.es);
  const common: Record<string, unknown> = es.common as Record<string, unknown>;
  common.back = undefined;
  return { ...actual, MESSAGES: { ...actual.MESSAGES, es } };
});

function Probe(): JSX.Element {
  const { t }: TranslateContextValue = useTranslate();
  return (
    <>
      <p data-testid="back">{t('common.back')}</p>
      <p data-testid="continue">{t('common.continue')}</p>
    </>
  );
}

const renderInSpanish = (defaultLocale?: Locale): void => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es']);
  render(
    <TranslateProvider defaultLocale={defaultLocale}>
      <Probe />
    </TranslateProvider>,
  );
};

describe('TranslateProvider fallback messages', (): void => {
  it('shows a message missing in the current language in the defaultLocale language', (): void => {
    renderInSpanish('pt-BR');

    expect(screen.getByTestId('back')).toHaveTextContent(/^Voltar$/);
    expect(screen.getByTestId('continue')).toHaveTextContent(/^Continuar$/);
  });

  it('follows the defaultLocale prop for the fallback', (): void => {
    renderInSpanish('en');

    expect(screen.getByTestId('back')).toHaveTextContent(/^Back$/);
  });

  it('follows a change of the defaultLocale prop after the first render', (): void => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es']);
    const { rerender }: RenderResult = render(
      <TranslateProvider defaultLocale="pt-BR">
        <Probe />
      </TranslateProvider>,
    );

    expect(screen.getByTestId('back')).toHaveTextContent(/^Voltar$/);

    rerender(
      <TranslateProvider defaultLocale="en">
        <Probe />
      </TranslateProvider>,
    );

    expect(screen.getByTestId('back')).toHaveTextContent(/^Back$/);
    expect(screen.getByTestId('continue')).toHaveTextContent(/^Continuar$/);
  });
});
