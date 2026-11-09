import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';
import type { EnhanceOptions } from '@/lib/types';

import { EnhanceOptionsForm } from './EnhanceOptionsForm';

const OPTIONS: EnhanceOptions = {
  filter: 'none',
  turns: 1,
  sharpen: 'soft',
  denoise: false,
};

type OnChange = Mock<(options: EnhanceOptions) => void>;

/** Renders the form in English with the given options, and returns its `onChange` mock. */
function renderForm(options: EnhanceOptions = OPTIONS): OnChange {
  const onChange: OnChange = vi.fn();
  render(
    <TranslateProvider defaultLocale="en">
      <EnhanceOptionsForm options={options} onChange={onChange} />
    </TranslateProvider>,
  );
  return onChange;
}

/** The fieldset whose legend is `legend`. */
const group = (legend: string): HTMLElement =>
  screen.getByRole('group', { name: legend });

/** Labels of the radio buttons of a fieldset, in order. */
const radioNames = (legend: string): string[] =>
  within(group(legend))
    .getAllByRole('radio')
    .map((radio: HTMLElement) => radio.parentElement?.textContent ?? '');

describe('EnhanceOptionsForm', (): void => {
  it('offers the three color filters, in order, with the current one selected', (): void => {
    renderForm({ ...OPTIONS, filter: 'grayscale' });

    expect(radioNames('Color')).toEqual([
      'Color',
      'Grayscale',
      'Black and white',
    ]);
    const colors: HTMLElement = group('Color');
    expect(
      within(colors).getByRole('radio', { name: 'Grayscale' }),
    ).toBeChecked();
    expect(
      within(colors).getByRole('radio', { name: 'Color' }),
    ).not.toBeChecked();
    expect(
      within(colors).getByRole('radio', { name: 'Black and white' }),
    ).not.toBeChecked();
  });

  it('offers the three sharpness levels, in order, with the current one selected', (): void => {
    renderForm({ ...OPTIONS, sharpen: 'strong' });

    expect(radioNames('Sharpness')).toEqual(['None', 'Soft', 'Strong']);
    expect(
      within(group('Sharpness')).getByRole('radio', { name: 'Strong' }),
    ).toBeChecked();
  });

  it('shows whether noise reduction is on', (): void => {
    renderForm({ ...OPTIONS, denoise: true });

    expect(
      screen.getByRole('checkbox', { name: 'Reduce noise' }),
    ).toBeChecked();
  });

  it('changes the filter and keeps the other adjustments', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm();

    await user.click(
      within(group('Color')).getByRole('radio', { name: 'Black and white' }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...OPTIONS,
      filter: 'bw',
    });
  });

  it('turns the document a quarter to the left', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm({ ...OPTIONS, turns: 0 });

    await user.click(screen.getByRole('button', { name: 'Left' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...OPTIONS, turns: -1 });
  });

  it('turns the document a quarter to the right from its current rotation', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm({ ...OPTIONS, turns: 2 });

    await user.click(screen.getByRole('button', { name: 'Right' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ...OPTIONS, turns: 3 });
  });

  it('groups the rotation buttons under "Rotate"', (): void => {
    renderForm();

    const rotate: HTMLElement = group('Rotate');
    expect(
      within(rotate)
        .getAllByRole('button')
        .map((button: HTMLElement) => button.textContent),
    ).toEqual(['Left', 'Right']);
  });

  it('changes the sharpness and keeps the other adjustments', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm();

    await user.click(
      within(group('Sharpness')).getByRole('radio', { name: 'None' }),
    );

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...OPTIONS,
      sharpen: 'off',
    });
  });

  it('turns noise reduction on and off', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm({ ...OPTIONS, denoise: false });

    await user.click(screen.getByTestId('denoise'));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...OPTIONS,
      denoise: true,
    });
  });

  it('turns noise reduction off when it is on', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm({ ...OPTIONS, denoise: true });

    await user.click(screen.getByRole('checkbox', { name: 'Reduce noise' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith({
      ...OPTIONS,
      denoise: false,
    });
  });

  it('does not report choosing the option that is already selected', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: OnChange = renderForm();

    await user.click(
      within(group('Color')).getByRole('radio', { name: 'Color' }),
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it('shows the labels in the current language', (): void => {
    localStorage.setItem('docscanify.locale', 'pt-BR');
    renderForm();

    expect(
      screen.getByRole('button', { name: 'Esquerda' }),
    ).toBeInTheDocument();
  });
});
