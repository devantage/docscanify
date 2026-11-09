import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { type JSX, useState } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { Segmented, type SegmentedItem } from './Segmented';

type Format = 'pdf' | 'png' | 'jpg';

const FORMATS: SegmentedItem<Format>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
];

/** Segmented control that keeps its own selection, as a parent would. */
function Controlled({
  onChange,
  initial = 'pdf',
}: {
  onChange(value: Format): void;
  initial?: Format;
}): JSX.Element {
  const [value, setValue] = useState<Format>(initial);
  return (
    <Segmented
      legend="Format"
      name="format"
      items={FORMATS}
      value={value}
      onChange={(next: Format) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

const radio = (name: string): HTMLInputElement =>
  screen.getByRole<HTMLInputElement>('radio', { name });

describe('Segmented', (): void => {
  it('shows a group named by the legend with one radio per item, in order', (): void => {
    render(
      <Segmented
        legend="Format"
        name="format"
        items={FORMATS}
        value="png"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('group', { name: 'Format' })).toBeInTheDocument();
    const radios: HTMLInputElement[] = screen.getAllByRole('radio');
    expect(radios.map((r: HTMLInputElement) => r.value)).toEqual([
      'pdf',
      'png',
      'jpg',
    ]);
    radios.forEach((r: HTMLInputElement) => {
      expect(r).toHaveAttribute('name', 'format');
    });
    expect(
      (document.querySelector('.segmented') as HTMLElement).style
        .gridTemplateColumns,
    ).toBe('repeat(3, 1fr)');
  });

  it('checks and highlights only the selected item', (): void => {
    render(
      <Segmented
        legend="Format"
        name="format"
        items={FORMATS}
        value="png"
        onChange={vi.fn()}
      />,
    );

    expect(radio('PDF')).not.toBeChecked();
    expect(radio('PNG')).toBeChecked();
    expect(radio('JPG')).not.toBeChecked();
    expect(radio('PNG').closest('label')).toHaveClass('is-on');
    expect(radio('PDF').closest('label')).not.toHaveClass('is-on');
    expect(radio('JPG').closest('label')).not.toHaveClass('is-on');
  });

  it('calls onChange with the value of the clicked item', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: Mock<(value: Format) => void> = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(screen.getByText('JPG'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('jpg');
    expect(radio('JPG')).toBeChecked();
    expect(radio('PDF')).not.toBeChecked();
  });

  it('does not call onChange when the selected item is clicked again', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: Mock<(value: Format) => void> = vi.fn();
    render(<Controlled onChange={onChange} />);

    await user.click(radio('PDF'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('keeps the selection controlled by the value prop', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: Mock<(value: Format) => void> = vi.fn();
    render(
      <Segmented
        legend="Format"
        name="format"
        items={FORMATS}
        value="pdf"
        onChange={onChange}
      />,
    );

    await user.click(radio('PNG'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith('png');
    expect(radio('PDF')).toBeChecked();
    expect(radio('PNG')).not.toBeChecked();
  });

  it('moves the selection with the arrow keys', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: Mock<(value: Format) => void> = vi.fn();
    render(<Controlled onChange={onChange} initial="png" />);

    await user.tab();
    expect(radio('PNG')).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expect(radio('JPG')).toBeChecked();
    expect(radio('JPG')).toHaveFocus();

    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(radio('PDF')).toBeChecked();
    expect(onChange.mock.calls).toEqual([['jpg'], ['png'], ['pdf']]);
  });

  it('keeps number values as numbers', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const onChange: Mock<(value: number) => void> = vi.fn();
    render(
      <Segmented
        legend="Rotation"
        name="rotation"
        items={[
          { value: 0, label: '0°' },
          { value: 90, label: '90°' },
        ]}
        value={0}
        onChange={onChange}
      />,
    );

    await user.click(radio('90°'));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(90);
  });
});
