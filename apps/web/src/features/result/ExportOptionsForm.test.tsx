import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';
import type { ExportSettings } from '@/lib/types';

import { ExportOptionsForm } from './ExportOptionsForm';

const PDF: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margin: 10,
  combine: true,
};

const PDF_ZIP_HINT: string = 'The PDFs are downloaded together, in a ZIP file.';
const IMAGE_ZIP_HINT: string = 'Each document becomes a file, all in a ZIP.';
const IMAGE_HINT: string =
  'PNG keeps every detail. JPG makes a smaller file, with some loss.';

type OnChange = Mock<(settings: ExportSettings) => void>;

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

const group = (legend: string): HTMLElement =>
  screen.getByRole('group', { name: legend });

const marginInput = (): HTMLInputElement => screen.getByTestId('margin');

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

    it('shows the margin in millimeters, between 0 and 100', (): void => {
      renderForm({ ...PDF, margin: 15 }, 1);

      const margin: HTMLInputElement = screen.getByRole('spinbutton', {
        name: 'Margin (mm)',
      });
      expect(margin).toBe(marginInput());
      expect(margin).toHaveValue(15);
      expect(margin).toHaveAttribute('min', '0');
      expect(margin).toHaveAttribute('max', '100');
    });

    it('changes the margin to the number typed', (): void => {
      const onChange: OnChange = renderForm(PDF, 1);

      fireEvent.change(marginInput(), { target: { value: '25' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margin: 25 });
    });

    it('accepts a fractional margin', (): void => {
      const onChange: OnChange = renderForm(PDF, 1);

      fireEvent.change(marginInput(), { target: { value: '2.5' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margin: 2.5 });
    });

    it('limits the margin to 100 mm', (): void => {
      const onChange: OnChange = renderForm(PDF, 1);

      fireEvent.change(marginInput(), { target: { value: '250' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margin: 100 });
    });

    it('turns a negative margin into 0', (): void => {
      const onChange: OnChange = renderForm(PDF, 1);

      fireEvent.change(marginInput(), { target: { value: '-4' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margin: 0 });
    });

    it('turns an empty margin into 0', (): void => {
      const onChange: OnChange = renderForm(PDF, 1);

      fireEvent.change(marginInput(), { target: { value: '' } });

      expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...PDF, margin: 0 });
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
    it('hides the page, margin and file options', (): void => {
      renderForm({ ...PDF, format: 'jpg' }, 3);

      expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
      expect(screen.queryByTestId('margin')).not.toBeInTheDocument();
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
