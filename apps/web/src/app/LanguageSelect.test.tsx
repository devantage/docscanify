import { fireEvent, render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it } from 'vitest';

import { TranslateProvider, useTranslate } from '@/i18n';

import { LanguageSelect } from './LanguageSelect';

const STORAGE_KEY: string = 'docscanify.locale';

/** A text of the app, to see the language switch outside the picker. */
function Sample(): JSX.Element {
  const { t } = useTranslate();
  return <p data-testid="sample">{t('upload.emptyTitle')}</p>;
}

function renderSelect(): void {
  render(
    <TranslateProvider>
      <button type="button">Outside</button>
      <LanguageSelect />
      <Sample />
    </TranslateProvider>,
  );
}

function button(): HTMLElement {
  return screen.getByTestId('language');
}

function listbox(): HTMLElement {
  return screen.getByRole('listbox');
}

function activeOption(): HTMLElement {
  const id: string | null = listbox().getAttribute('aria-activedescendant');
  const option: HTMLElement | null = id ? document.getElementById(id) : null;
  if (!option) throw new Error('no active option');
  return option;
}

describe('LanguageSelect', (): void => {
  describe('button', (): void => {
    it('shows the current language as flag and short code, closed', (): void => {
      renderSelect();

      const languageButton: HTMLElement = button();
      expect(languageButton).toHaveAccessibleName('Language: English');
      expect(languageButton).toHaveAttribute('title', 'Language');
      expect(languageButton).toHaveAttribute('aria-haspopup', 'listbox');
      expect(languageButton).toHaveAttribute('aria-expanded', 'false');
      expect(languageButton).toHaveTextContent(/^EN$/);
      expect(languageButton.querySelector('svg.flag')).not.toBeNull();
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('starts with the language chosen before', (): void => {
      localStorage.setItem(STORAGE_KEY, 'es');
      renderSelect();

      expect(button()).toHaveAccessibleName('Idioma: Español');
      expect(button()).toHaveTextContent(/^ES$/);
    });
  });

  describe('list', (): void => {
    it('opens on click with every language, by native name and flag, in order', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());

      expect(button()).toHaveAttribute('aria-expanded', 'true');
      expect(button()).toHaveAttribute('aria-controls', listbox().id);
      expect(listbox()).toHaveAccessibleName('Language');
      const options: HTMLElement[] = within(listbox()).getAllByRole('option');
      expect(options.map((o: HTMLElement) => o.textContent)).toEqual([
        'English',
        'Español',
        'Português (Brasil)',
      ]);
      expect(options.map((o: HTMLElement) => o.getAttribute('lang'))).toEqual([
        'en',
        'es',
        'pt-BR',
      ]);
      options.forEach((option: HTMLElement): void => {
        expect(option.querySelector('svg.flag')).not.toBeNull();
      });
    });

    it('marks the current language as selected, with a check', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());

      const options: HTMLElement[] = within(listbox()).getAllByRole('option');
      expect(
        options.map((o: HTMLElement) => o.getAttribute('aria-selected')),
      ).toEqual(['true', 'false', 'false']);
      expect(options[0].querySelector('.language-check')).not.toBeNull();
      expect(options[1].querySelector('.language-check')).toBeNull();
      expect(options[2].querySelector('.language-check')).toBeNull();
    });

    it('keeps the current language selected while the keyboard moves to another', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{End}');

      const options: HTMLElement[] = within(listbox()).getAllByRole('option');
      expect(activeOption()).toBe(options[2]);
      expect(
        options.map((o: HTMLElement) => o.getAttribute('aria-selected')),
      ).toEqual(['true', 'false', 'false']);
      expect(options[0].querySelector('.language-check')).not.toBeNull();
      expect(options[2].querySelector('.language-check')).toBeNull();
    });

    it('takes focus when it opens, starting on the current language', async (): Promise<void> => {
      localStorage.setItem(STORAGE_KEY, 'pt-BR');
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());

      expect(listbox()).toHaveFocus();
      expect(activeOption()).toHaveTextContent('Português (Brasil)');
      expect(activeOption()).toHaveClass('is-active');
    });

    it('closes when the button is clicked again', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());
      await user.click(button());

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button()).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('choosing a language', (): void => {
    it('switches the texts of the app, the page language and the button', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      expect(screen.getByTestId('sample')).toHaveTextContent(
        'Take photos or upload images of your documents',
      );

      await user.click(button());
      await user.click(screen.getByRole('option', { name: 'Español' }));

      expect(screen.getByTestId('sample')).toHaveTextContent(
        'Fotografía o sube imágenes de tus documentos',
      );
      expect(document.documentElement.lang).toBe('es');
      expect(button()).toHaveAccessibleName('Idioma: Español');
      expect(button()).toHaveTextContent(/^ES$/);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
    });

    it('remembers the choice for the next visits', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());
      await user.click(
        screen.getByRole('option', { name: 'Português (Brasil)' }),
      );

      expect(localStorage.getItem(STORAGE_KEY)).toBe('pt-BR');
    });

    it('follows the pointer over the options', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      await user.click(button());
      fireEvent.pointerMove(screen.getByRole('option', { name: 'Español' }));

      expect(activeOption()).toHaveTextContent('Español');
    });
  });

  describe('keyboard', (): void => {
    it('opens with ArrowDown or ArrowUp on the button', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();

      button().focus();
      await user.keyboard('{ArrowDown}');
      expect(listbox()).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

      await user.keyboard('{ArrowUp}');
      expect(listbox()).toBeInTheDocument();
    });

    it('moves with the arrows, stopping at both ends', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());
      expect(activeOption()).toHaveTextContent('English');

      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Español');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Português (Brasil)');
      await user.keyboard('{ArrowDown}');
      expect(activeOption()).toHaveTextContent('Português (Brasil)');

      await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
      expect(activeOption()).toHaveTextContent('English');
    });

    it('jumps to the first and last language with Home and End', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{End}');
      expect(activeOption()).toHaveTextContent('Português (Brasil)');

      await user.keyboard('{Home}');
      expect(activeOption()).toHaveTextContent('English');
    });

    it('picks the active language with Enter', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{End}{Enter}');

      expect(screen.getByTestId('sample')).toHaveTextContent(
        'Fotografe ou envie imagens dos documentos',
      );
      expect(localStorage.getItem(STORAGE_KEY)).toBe('pt-BR');
      expect(button()).toHaveFocus();
    });

    it('picks the active language with Space', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{ArrowDown}[Space]');

      expect(localStorage.getItem(STORAGE_KEY)).toBe('es');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('closes with Escape without changing the language, back on the button', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{ArrowDown}{Escape}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button()).toHaveFocus();
      expect(button()).toHaveAccessibleName('Language: English');
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('closes with Tab without changing the language', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.keyboard('{ArrowDown}{Tab}');

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('leaves Tab to move focus on, without pulling it back to the button', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      // Only the key press: moving focus to the next element is the browser's default action
      fireEvent.keyDown(listbox(), { key: 'Tab' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button()).not.toHaveFocus();
    });

    it('opens again on the current language, not where the keyboard was left', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());
      await user.keyboard('{End}{Escape}');

      await user.click(button());

      expect(activeOption()).toHaveTextContent('English');
    });
  });

  describe('closing from outside', (): void => {
    it('closes on a press outside, without taking focus from what was pressed', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      await user.click(screen.getByRole('button', { name: 'Outside' }));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('does not move focus to the button on a press outside', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      // A press on text, which does not take focus itself
      fireEvent.pointerDown(screen.getByTestId('sample'));

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(button()).not.toHaveFocus();
    });

    it('stays open on a press inside the list', (): void => {
      renderSelect();
      fireEvent.click(button());

      fireEvent.pointerDown(listbox());

      expect(listbox()).toBeInTheDocument();
    });

    it('closes when focus leaves the picker', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderSelect();
      await user.click(button());

      fireEvent.blur(listbox(), {
        relatedTarget: screen.getByRole('button', { name: 'Outside' }),
      });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // Focus is going elsewhere: it is not pulled back to the button
      expect(button()).not.toHaveFocus();
    });
  });
});
