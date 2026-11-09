import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { DocumentTile } from './DocumentTile';
import type { Preview } from './usePreviews';

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomLeft: { x: 0, y: 100 },
  bottomRight: { x: 100, y: 100 },
};

/** A document with valid corners and no adjustments, changed by `overrides`. */
function makeDocument(
  id: string,
  overrides: Partial<DocumentItem> = {},
): DocumentItem {
  return {
    id,
    source: {
      image: new Image(),
      url: `blob:source-${id}`,
      name: id,
      scannedDocument: {} as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
    ...overrides,
  };
}

interface TileProps {
  document?: DocumentItem;
  index?: number;
  preview?: Preview;
  active?: boolean;
  selectable?: boolean;
}

interface Rendered {
  onSelect: Mock<(id: string) => void>;
  onRemove: Mock<(id: string) => void>;
  container: HTMLElement;
}

/**
 * Renders the first tile of the list for a document that is not on display, with spy callbacks.
 * It is selectable only with `selectable`.
 */
function renderTile(props: TileProps = {}): Rendered {
  const onSelect: Mock<(id: string) => void> = vi.fn<(id: string) => void>();
  const onRemove: Mock<(id: string) => void> = vi.fn<(id: string) => void>();
  const { container } = render(
    <TranslateProvider>
      <DocumentTile
        document={props.document ?? makeDocument('doc-a')}
        index={props.index ?? 0}
        preview={props.preview}
        active={props.active ?? false}
        onSelect={props.selectable ? onSelect : undefined}
        onRemove={onRemove}
      />
    </TranslateProvider>,
  );
  return { onSelect, onRemove, container };
}

describe('DocumentTile', (): void => {
  describe('without selection (Upload step)', (): void => {
    it('is an image labeled with its 1-based position, not a button', (): void => {
      renderTile({ index: 2 });

      const body: HTMLElement = screen.getByTestId('doc-2');
      expect(body).toHaveAttribute('role', 'img');
      expect(body).toHaveAccessibleName('Document 3');
      expect(body.tagName).toBe('DIV');
      expect(
        screen.queryByRole('button', { name: 'Document 3' }),
      ).not.toBeInTheDocument();
    });

    it('shows the position number', (): void => {
      const { container } = renderTile({ index: 4 });

      expect(container.querySelector('.doc-tile-n')).toHaveTextContent(/^5$/);
    });

    it('never flags invalid corners, since they cannot be fixed here', (): void => {
      const { container } = renderTile({
        document: makeDocument('doc-a', { valid: false }),
      });

      expect(container.querySelector('.doc-tile-alert')).toBeNull();
      expect(screen.getByTestId('doc-0')).toHaveAccessibleName('Document 1');
    });
  });

  describe('with selection (later steps)', (): void => {
    it('is a button that selects the document by id', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onSelect, onRemove } = renderTile({
        document: makeDocument('doc-xyz'),
        index: 1,
        selectable: true,
      });

      const body: HTMLElement = screen.getByRole('button', {
        name: 'Document 2',
      });
      expect(body).toHaveAttribute(
        'title',
        'Tap to open, drag to change the order',
      );
      await user.click(body);

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('doc-xyz');
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('marks the active document as current', (): void => {
      const { container } = renderTile({ selectable: true, active: true });

      expect(screen.getByTestId('doc-0')).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(container.querySelector('.doc-tile')).toHaveClass('is-active');
    });

    it('does not mark an inactive document as current', (): void => {
      const { container } = renderTile({ selectable: true, active: false });

      expect(screen.getByTestId('doc-0')).not.toHaveAttribute('aria-current');
      expect(container.querySelector('.doc-tile')).not.toHaveClass('is-active');
    });

    it('flags crossed corners with "!" and says it needs a crop fix', (): void => {
      const { container } = renderTile({
        document: makeDocument('doc-a', { valid: false }),
        index: 1,
        selectable: true,
      });

      const alert: Element | null = container.querySelector('.doc-tile-alert');
      expect(alert).toHaveTextContent(/^!$/);
      expect(alert).toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('doc-1')).toHaveAccessibleName(
        'Document 2, needs a crop fix',
      );
    });

    it('flags a document without corners', (): void => {
      const { container } = renderTile({
        document: makeDocument('doc-a', { corners: null }),
        selectable: true,
      });

      expect(container.querySelector('.doc-tile-alert')).toHaveTextContent('!');
      expect(screen.getByTestId('doc-0')).toHaveAccessibleName(
        'Document 1, needs a crop fix',
      );
    });

    it('does not flag a document with valid corners', (): void => {
      const { container } = renderTile({ selectable: true });

      expect(container.querySelector('.doc-tile-alert')).toBeNull();
      expect(screen.getByTestId('doc-0')).toHaveAccessibleName('Document 1');
    });

    it('is busy while its thumbnail is pending', (): void => {
      const { container } = renderTile({
        selectable: true,
        preview: { url: null, pending: true },
      });

      expect(screen.getByTestId('doc-0')).toHaveAttribute('aria-busy', 'true');
      expect(container.querySelector('.doc-tile')).toHaveClass('is-pending');
      expect(container.querySelector('.doc-tile-spinner')).not.toBeNull();
    });

    it('is not busy when the thumbnail is up to date', (): void => {
      const { container } = renderTile({
        selectable: true,
        preview: { url: 'data:image/png;base64,AAA', pending: false },
      });

      expect(screen.getByTestId('doc-0')).not.toHaveAttribute('aria-busy');
      expect(container.querySelector('.doc-tile')).not.toHaveClass(
        'is-pending',
      );
      expect(container.querySelector('.doc-tile-spinner')).toBeNull();
    });
  });

  describe('thumbnail', (): void => {
    it('shows the original image without a preview', (): void => {
      const { container } = renderTile({ document: makeDocument('doc-a') });

      const img: HTMLImageElement | null = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'blob:source-doc-a');
      expect(img).not.toHaveClass('is-preview');
      expect(img).toHaveAttribute('alt', '');
      expect(img).toHaveAttribute('draggable', 'false');
    });

    it('shows the original image while the first preview has no url', (): void => {
      const { container } = renderTile({
        document: makeDocument('doc-a'),
        preview: { url: null, pending: true },
      });

      const img: HTMLImageElement | null = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'blob:source-doc-a');
      expect(img).not.toHaveClass('is-preview');
    });

    it('shows the preview with the crop and adjustments once ready', (): void => {
      const { container } = renderTile({
        preview: { url: 'data:image/png;base64,PREVIEW', pending: false },
      });

      const img: HTMLImageElement | null = container.querySelector('img');
      expect(img).toHaveAttribute('src', 'data:image/png;base64,PREVIEW');
      expect(img).toHaveClass('is-preview');
    });
  });

  describe('remove button', (): void => {
    it('removes the document by id, with a position-specific label', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onRemove, onSelect } = renderTile({
        document: makeDocument('doc-42'),
        index: 3,
        selectable: true,
      });

      const remove: HTMLElement = screen.getByTestId('remove-3');
      expect(remove).toHaveAccessibleName('Remove document 4');
      expect(remove).toHaveAttribute('title', 'Remove');
      await user.click(remove);

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('doc-42');
      expect(onSelect).not.toHaveBeenCalled();
    });

    it('is offered without selection too', (): void => {
      const { container } = renderTile({ index: 0 });

      expect(
        within(container).getByRole('button', { name: 'Remove document 1' }),
      ).toBeInTheDocument();
    });
  });
});
