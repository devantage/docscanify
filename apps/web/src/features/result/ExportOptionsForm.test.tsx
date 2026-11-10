import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { type JSX, useState } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';
import type { ExportSettings } from '@/lib/types';

import { ExportOptionsForm } from './ExportOptionsForm';

const PDF: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margins: 10,
  combine: true,
};

const PDF_ZIP_HINT: string = 'The PDFs are downloaded together, in a ZIP file.';
const IMAGE_ZIP_HINT: string = 'Each document becomes a file, all in a ZIP.';
const IMAGE_HINT: string =
  'PNG keeps every detail. JPG makes a smaller file, with some loss.';

type OnChange = Mock<(settings: ExportSettings) => void>;

/**
 * Renders the form in English and returns its `onChange` mock.
 *
 * @param count How many documents will be exported.
 */
function renderForm(settings: ExportSettings, count: number): OnChange {
  const onChange: OnChange = vi.fn();
  render(
    <TranslateProvider defaultLocale="en">
      <ExportOptionsForm
        settings={settings}
        onChange={onChange}
        count={count}
      />
    </TranslateProvider>,
  );
  return onChange;
}

/**
 * Renders the form in English for a single PDF without margins, keeping its settings in state like
 * the app does, so what is typed shows up in the fields.
 */
function renderLiveForm(): void {
  const Live = (): JSX.Element => {
    const [settings, setSettings] = useState<ExportSettings>({
      ...PDF,
      margins: 0,
    });
    return (
      <ExportOptionsForm settings={settings} onChange={setSettings} count={1} />
    );
  };
  render(
    <TranslateProvider defaultLocale="en">
      <Live />
    </TranslateProvider>,
  );
}

/** The fieldset whose legend is `legend`. */
const group = (legend: string): HTMLElement =>
  screen.getByRole('group', { name: legend });

/** The margins field, in centimeters. */
const marginsInput = (): HTMLInputElement => screen.getByTestId('margins');

describe('ExportOptionsForm', (): void => {
  it('offers PDF, PNG and JPG, in order, with the current format selected', (): void => {
    renderForm({ ...PDF, format: 'png' }, 1);

    const formats: HTMLElement[] = within(group('Format')).getAllByRole(
      'radio',
    );
    expect(
      formats.map((radio: HTMLElement) => radio.getAttribute('value')),
    ).toEqual(['pdf', 'png', 'jpg']);
    expect(
      within(group('Format')).getByRole('radio', { name: 'PNG' }),
    ).toBeChecked();
  });

  it('changes the format and keeps the other options', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm(PDF, 1);

    await user.click(screen.getByRole('radio', { name: 'JPG' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, format: 'jpg' });
  });

  describe('as PDF', (): void => {
    it('shows the page format, in order, with the current one selected', (): void => {
      renderForm({ ...PDF, pageFormat: 'letter' }, 1);

      const select: HTMLSelectElement = screen.getByRole('combobox', {
        name: 'PDF page',
      });
      expect(select.value).toBe('letter');
      expect(
        within(select)
          .getAllByRole('option')
          .map((option: HTMLElement) => [
            option.getAttribute('value'),
            option.textContent,
          ]),
      ).toEqual([
        ['a4', 'A4'],
        ['letter', 'Letter'],
        ['image', 'Document size'],
      ]);
    });

    it('changes the page format', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onChange: OnChange = renderForm(PDF, 1);

      await user.selectOptions(
        screen.getByRole('combobox', { name: 'PDF page' }),
        'image',
      );

      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        ...PDF,
        pageFormat: 'image',
      });
    });

    it('shows the margins in centimeters with 2 decimal places, stepping by 0.01 up to 10', (): void => {
      renderForm({ ...PDF, margins: 1.5 }, 1);

      const margins: HTMLInputElement = screen.getByRole('spinbutton', {
        name: 'Margins (In centimeters)',
      });
      expect(margins).toBe(marginsInput());
      expect(margins.value).toBe('1.50');
      expect(margins).toHaveAttribute('min', '0');
      expect(margins).toHaveAttribute('max', '10');
      expect(margins).toHaveAttribute('step', '0.01');
      expect(margins).toHaveAttribute('inputmode', 'numeric');
      expect(margins).toHaveAttribute('lang', 'en');
    });

    it('fills the margins from the right as digits are typed, and shifts them back on delete', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderLiveForm();
      expect(marginsInput().value).toBe('0.00');

      await user.click(marginsInput());
      await user.keyboard('1');
      expect(marginsInput().value).toBe('0.01');
      await user.keyboard('2');
      expect(marginsInput().value).toBe('0.12');
      await user.keyboard('5');
      expect(marginsInput().value).toBe('1.25');

      await user.keyboard('{Backspace}');
      expect(marginsInput().value).toBe('0.12');
    });

    it('selects the margins on focus, so typing starts them over', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderLiveForm();
      await user.click(marginsInput());
      await user.keyboard('125');
      await user.tab();

      await user.click(marginsInput());
      await user.keyboard('7');

      expect(marginsInput().value).toBe('0.07');
    });

    it('ignores keys that are not digits', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderLiveForm();

      await user.click(marginsInput());
      await user.keyboard('e+-.,a5');

      expect(marginsInput().value).toBe('0.05');
    });

    it('limits the typed margins to 10 cm', (): void => {
      const onChange: OnChange = renderForm({ ...PDF, margins: 1.23 }, 1);

      // A digit typed after 1.23: the browser hands the field over as "1.234"
      fireEvent.input(marginsInput(), {
        target: { value: '1.234' },
        inputType: 'insertText',
      });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margins: 10 });
    });

    it('reads a step of the arrows as a whole number and shows it with 2 decimal places', (): void => {
      renderLiveForm();

      // Stepping up from 1.29 gives "1.3": the step arrows send a plain Event, with no inputType
      fireEvent.change(marginsInput(), { target: { value: '1.3' } });

      expect(marginsInput().value).toBe('1.30');
    });

    it('changes the margins to those stepped to', (): void => {
      const onChange: OnChange = renderForm({ ...PDF, margins: 1.29 }, 1);

      fireEvent.change(marginsInput(), { target: { value: '1.3' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        ...PDF,
        margins: 1.3,
      });
    });
    it('has no file option nor hint for a single document', (): void => {
      renderForm({ ...PDF, combine: false }, 1);

      expect(
        screen.queryByRole('group', { name: 'File' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(PDF_ZIP_HINT)).not.toBeInTheDocument();
      expect(screen.queryByText(IMAGE_HINT)).not.toBeInTheDocument();
    });

    it('offers one PDF with everything or one PDF per document with several documents', (): void => {
      renderForm({ ...PDF, combine: true }, 3);

      const file: HTMLElement = group('File');
      expect(
        within(file)
          .getAllByRole('radio')
          .map((radio: HTMLElement) => radio.parentElement?.textContent),
      ).toEqual(['One PDF with everything', 'One PDF per document']);
      expect(
        within(file).getByRole('radio', { name: 'One PDF with everything' }),
      ).toBeChecked();
      // A single PDF is a single file: no ZIP
      expect(screen.queryByText(PDF_ZIP_HINT)).not.toBeInTheDocument();
    });

    it('switches to one PDF per document', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onChange: OnChange = renderForm({ ...PDF, combine: true }, 2);

      await user.click(
        screen.getByRole('radio', { name: 'One PDF per document' }),
      );

      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        ...PDF,
        combine: false,
      });
    });

    it('switches back to a single PDF', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const onChange: OnChange = renderForm({ ...PDF, combine: false }, 2);

      await user.click(
        screen.getByRole('radio', { name: 'One PDF with everything' }),
      );

      expect(onChange).toHaveBeenCalledExactlyOnceWith({
        ...PDF,
        combine: true,
      });
    });

    it('tells that one PDF per document comes in a ZIP', (): void => {
      renderForm({ ...PDF, combine: false }, 2);

      expect(
        within(group('File')).getByRole('radio', {
          name: 'One PDF per document',
        }),
      ).toBeChecked();
      expect(screen.getByText(PDF_ZIP_HINT)).toHaveClass('panel-hint');
    });
  });

  describe('as an image', (): void => {
    it('hides the page, margins and file options', (): void => {
      renderForm({ ...PDF, format: 'jpg' }, 3);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('margins')).not.toBeInTheDocument();
      expect(
        screen.queryByRole('group', { name: 'File' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText(PDF_ZIP_HINT)).not.toBeInTheDocument();
    });

    it('explains PNG and JPG for a single document, without a ZIP', (): void => {
      renderForm({ ...PDF, format: 'png' }, 1);

      const hint: HTMLElement = screen.getByText(IMAGE_HINT);
      expect(hint).toHaveClass('panel-hint');
      expect(hint.textContent).toBe(IMAGE_HINT);
    });

    it('tells that several documents come as one file each, in a ZIP', (): void => {
      renderForm({ ...PDF, format: 'png' }, 2);

      expect(screen.getByText(`${IMAGE_ZIP_HINT} ${IMAGE_HINT}`)).toHaveClass(
        'panel-hint',
      );
    });
  });
});
