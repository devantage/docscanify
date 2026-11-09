import { render, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';

import { AddTile } from './AddTile';

interface Callbacks {
  onTakePhoto: Mock<() => void>;
  onChooseFiles: Mock<() => void>;
}

/** Renders the tile, not hovered and not compact unless given otherwise, with spy callbacks. */
function renderTile(
  props: { over?: boolean; compact?: boolean } = {},
): Callbacks & { container: HTMLElement } {
  const onTakePhoto: Mock<() => void> = vi.fn<() => void>();
  const onChooseFiles: Mock<() => void> = vi.fn<() => void>();
  const ui: JSX.Element = (
    <TranslateProvider>
      <AddTile
        over={props.over ?? false}
        compact={props.compact ?? false}
        onTakePhoto={onTakePhoto}
        onChooseFiles={onChooseFiles}
      />
    </TranslateProvider>
  );
  const { container } = render(ui);
  return { onTakePhoto, onChooseFiles, container };
}

describe('AddTile', (): void => {
  it('shows the add title, the two actions and the drop hint', (): void => {
    renderTile();

    expect(screen.getByText('Add')).toBeInTheDocument();
    expect(screen.getByTestId('add-camera')).toHaveAccessibleName('Take photo');
    expect(screen.getByTestId('add-camera')).toHaveTextContent('Take photo');
    // The visible label is short, the accessible name says what is uploaded
    expect(screen.getByTestId('add-upload')).toHaveAccessibleName(
      'Upload images',
    );
    expect(screen.getByTestId('add-upload')).toHaveTextContent(/^Upload$/);
    expect(screen.getByText('or drag the images here')).toBeInTheDocument();
  });

  it('calls onTakePhoto only from the take-photo button', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { onTakePhoto, onChooseFiles } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Take photo' }));

    expect(onTakePhoto).toHaveBeenCalledTimes(1);
    expect(onChooseFiles).not.toHaveBeenCalled();
  });

  it('calls onChooseFiles only from the upload button', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const { onTakePhoto, onChooseFiles } = renderTile();

    await user.click(screen.getByRole('button', { name: 'Upload images' }));

    expect(onChooseFiles).toHaveBeenCalledTimes(1);
    expect(onTakePhoto).not.toHaveBeenCalled();
  });

  it('adds tooltips to the buttons only when compact', (): void => {
    const { container } = renderTile({ compact: true });

    expect(screen.getByTestId('add-camera')).toHaveAttribute(
      'title',
      'Take photo',
    );
    expect(screen.getByTestId('add-upload')).toHaveAttribute(
      'title',
      'Upload images',
    );
    expect(container.querySelector('.add-tile')).not.toHaveClass('is-over');
  });

  it('has no tooltips when large', (): void => {
    renderTile({ compact: false });

    expect(screen.getByTestId('add-camera')).not.toHaveAttribute('title');
    expect(screen.getByTestId('add-upload')).not.toHaveAttribute('title');
  });

  it('highlights the tile while images are dragged over it', (): void => {
    const { container } = renderTile({ over: true });

    expect(container.querySelector('.add-tile')).toHaveClass('is-over');
  });
});
