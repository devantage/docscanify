import type { Corners, ScannedDocument } from '@devantage/docscanify';
import {
  act,
  fireEvent,
  render,
  type RenderResult,
  screen,
  within,
} from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { TranslateProvider } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { DocumentCarousel } from './DocumentCarousel';
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
    options: { filter: 'none', turns: 0, sharpen: 'off' },
    ...overrides,
  };
}

/** A tiny PNG file, as chosen or dropped by the user. */
function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

interface Handlers {
  onFiles: Mock<(files: File[]) => void>;
  onCamera: Mock<() => void>;
  onRemove: Mock<(id: string) => void>;
  onReorder: Mock<(from: number, to: number) => void>;
  onSelect: Mock<(id: string) => void>;
}

interface CarouselProps {
  documents: DocumentItem[];
  size?: 'large' | 'compact';
  selectable?: boolean;
  activeId?: string | null;
  previews?: Record<string, Preview>;
}

/** A spy for each callback of the carousel. */
function makeHandlers(): Handlers {
  return {
    onFiles: vi.fn<(files: File[]) => void>(),
    onCamera: vi.fn<() => void>(),
    onRemove: vi.fn<(id: string) => void>(),
    onReorder: vi.fn<(from: number, to: number) => void>(),
    onSelect: vi.fn<(id: string) => void>(),
  };
}

/**
 * The carousel with the given props and handlers, `large` unless given otherwise and selectable
 * only with `selectable`. Passing new props to `rerender` keeps the same handlers.
 */
function carousel(props: CarouselProps, handlers: Handlers): JSX.Element {
  return (
    <TranslateProvider>
      <DocumentCarousel
        documents={props.documents}
        size={props.size ?? 'large'}
        onFiles={handlers.onFiles}
        onCamera={handlers.onCamera}
        onRemove={handlers.onRemove}
        onReorder={handlers.onReorder}
        activeId={props.activeId}
        onSelect={props.selectable ? handlers.onSelect : undefined}
        previews={props.previews}
      />
    </TranslateProvider>
  );
}

/** Renders the {@link carousel} with new spy handlers. */
function renderCarousel(
  props: CarouselProps,
): Handlers & { result: RenderResult } {
  const handlers: Handlers = makeHandlers();
  const result: RenderResult = render(carousel(props, handlers));
  return { ...handlers, result };
}

/** Labels of the document tiles, in the order shown. */
function tileLabels(): string[] {
  const list: HTMLElement = screen.getByRole('list', { name: 'Documents' });
  return Array.from(
    list.querySelectorAll<HTMLElement>('[data-testid^="doc-"]'),
  ).map((tile: HTMLElement) => tile.getAttribute('aria-label') ?? '');
}

const THREE: DocumentItem[] = [
  makeDocument('a'),
  makeDocument('b'),
  makeDocument('c'),
];

describe('DocumentCarousel', (): void => {
  let scrollTo: Mock<(options?: ScrollToOptions) => void>;
  let scrollIntoView: Mock<(options?: ScrollIntoViewOptions) => void>;

  beforeEach((): void => {
    // jsdom does not implement scrolling
    scrollTo = vi.fn<(options?: ScrollToOptions) => void>();
    scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: scrollTo,
    });
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
  });

  afterEach((): void => {
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  describe('list', (): void => {
    it('shows one tile per document, in export order, then the add tile', (): void => {
      renderCarousel({
        documents: [makeDocument('z'), makeDocument('y'), makeDocument('x')],
      });

      const list: HTMLElement = screen.getByRole('list', {
        name: 'Documents',
      });
      const items: HTMLElement[] = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(4);
      expect(
        items.slice(0, 3).map((item: HTMLElement) => item.dataset.id),
      ).toEqual(['z', 'y', 'x']);
      expect(tileLabels()).toEqual(['Document 1', 'Document 2', 'Document 3']);
      expect(items[3]).toHaveClass('doc-item-add');
      expect(within(items[3]).getByText('Add')).toBeInTheDocument();
    });

    it('shows only the add tile without documents', (): void => {
      renderCarousel({ documents: [] });

      const list: HTMLElement = screen.getByRole('list', {
        name: 'Documents',
      });
      expect(within(list).getAllByRole('listitem')).toHaveLength(1);
      expect(tileLabels()).toEqual([]);
    });

    it('applies the size class and gives compact buttons tooltips', (): void => {
      const { result } = renderCarousel({ documents: THREE, size: 'compact' });

      expect(result.container.querySelector('.doc-carousel')).toHaveClass(
        'is-compact',
      );
      expect(screen.getByTestId('add-camera')).toHaveAttribute(
        'title',
        'Take photo',
      );
    });

    it('large carousel has no tooltips on the add buttons', (): void => {
      const { result } = renderCarousel({ documents: THREE, size: 'large' });

      expect(result.container.querySelector('.doc-carousel')).toHaveClass(
        'is-large',
      );
      expect(screen.getByTestId('add-camera')).not.toHaveAttribute('title');
    });

    it('passes each document its own preview', (): void => {
      renderCarousel({
        documents: THREE,
        previews: {
          b: { url: 'data:image/png;base64,B', pending: false },
        },
      });

      const images: string[] = Array.from(
        screen.getByRole('list', { name: 'Documents' }).querySelectorAll('img'),
      ).map((img: HTMLImageElement) => img.getAttribute('src') ?? '');
      expect(images).toEqual([
        'blob:source-a',
        'data:image/png;base64,B',
        'blob:source-c',
      ]);
    });
  });

  describe('selection', (): void => {
    it('without onSelect, tiles are not buttons and nothing is current', (): void => {
      renderCarousel({ documents: THREE, activeId: 'b' });

      expect(
        screen.queryByRole('button', { name: /^Document/ }),
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('doc-1')).not.toHaveAttribute('aria-current');
      expect(screen.getByTestId('doc-1').closest('.doc-tile')).not.toHaveClass(
        'is-active',
      );
    });

    it('without onSelect, does not scroll to activeId', (): void => {
      const handlers: Handlers = makeHandlers();
      const { rerender } = render(
        carousel({ documents: THREE, activeId: 'a' }, handlers),
      );

      rerender(carousel({ documents: THREE, activeId: 'c' }, handlers));

      expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('with onSelect, marks the active document and selects a tapped one', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onSelect } = renderCarousel({
        documents: THREE,
        selectable: true,
        activeId: 'b',
      });

      expect(screen.getByTestId('doc-0')).not.toHaveAttribute('aria-current');
      expect(screen.getByTestId('doc-1')).toHaveAttribute(
        'aria-current',
        'true',
      );
      expect(screen.getByTestId('doc-2')).not.toHaveAttribute('aria-current');

      await user.click(screen.getByRole('button', { name: 'Document 3' }));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('c');
    });

    it('flags only the documents that need a crop fix', (): void => {
      renderCarousel({
        documents: [
          makeDocument('a'),
          makeDocument('b', { valid: false }),
          makeDocument('c', { corners: null }),
        ],
        selectable: true,
      });

      expect(tileLabels()).toEqual([
        'Document 1',
        'Document 2, needs a crop fix',
        'Document 3, needs a crop fix',
      ]);
    });

    it('scrolls the active document into view when it changes', (): void => {
      const handlers: Handlers = makeHandlers();
      const { rerender } = render(
        carousel(
          { documents: THREE, selectable: true, activeId: 'a' },
          handlers,
        ),
      );
      scrollIntoView.mockClear();

      rerender(
        carousel(
          { documents: THREE, selectable: true, activeId: 'c' },
          handlers,
        ),
      );

      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(
        screen.getByTestId('doc-2').closest('li'),
      );
      expect(scrollIntoView).toHaveBeenCalledWith({
        block: 'nearest',
        inline: 'nearest',
        behavior: 'smooth',
      });
    });
  });

  describe('remove', (): void => {
    it('removes the document of the pressed button', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onRemove, onReorder } = renderCarousel({ documents: THREE });

      await user.click(
        screen.getByRole('button', { name: 'Remove document 2' }),
      );

      expect(onRemove).toHaveBeenCalledTimes(1);
      expect(onRemove).toHaveBeenCalledWith('b');
      expect(onReorder).not.toHaveBeenCalled();
    });
  });

  describe('dragging', (): void => {
    /** Presses the mouse on `target` and moves it past the drag threshold. */
    function pressAndMove(target: HTMLElement): void {
      fireEvent.pointerDown(target, {
        pointerId: 1,
        pointerType: 'mouse',
        button: 0,
        clientX: 50,
        clientY: 50,
      });
      act((): void => {
        window.dispatchEvent(
          new PointerEvent('pointermove', {
            pointerId: 1,
            pointerType: 'mouse',
            clientX: 300,
            clientY: 50,
            bubbles: true,
          }),
        );
      });
    }

    function cancelPointer(): void {
      act((): void => {
        window.dispatchEvent(
          new PointerEvent('pointercancel', { pointerId: 1, bubbles: true }),
        );
      });
    }

    it('drags a document from its tile', (): void => {
      renderCarousel({ documents: THREE });

      pressAndMove(screen.getByTestId('doc-0'));

      expect(screen.getByTestId('doc-0').closest('li')).toHaveClass(
        'is-dragging',
      );
      cancelPointer();
    });

    it('does not start a drag from the remove button', (): void => {
      renderCarousel({ documents: THREE });

      pressAndMove(screen.getByRole('button', { name: 'Remove document 1' }));

      expect(screen.getByTestId('doc-0').closest('li')).not.toHaveClass(
        'is-dragging',
      );
      cancelPointer();
    });
  });

  describe('keyboard reordering', (): void => {
    it('moves a document right with Alt + →', (): void => {
      const { onReorder } = renderCarousel({ documents: THREE });

      fireEvent.keyDown(screen.getByTestId('doc-0'), {
        key: 'ArrowRight',
        altKey: true,
      });

      expect(onReorder).toHaveBeenCalledTimes(1);
      expect(onReorder).toHaveBeenCalledWith(0, 1);
    });

    it('moves a document left with Alt + ←', (): void => {
      const { onReorder } = renderCarousel({ documents: THREE });

      fireEvent.keyDown(screen.getByTestId('doc-2'), {
        key: 'ArrowLeft',
        altKey: true,
      });

      expect(onReorder).toHaveBeenCalledWith(2, 1);
    });

    it('does not move past either end of the list', (): void => {
      const { onReorder } = renderCarousel({ documents: THREE });

      fireEvent.keyDown(screen.getByTestId('doc-0'), {
        key: 'ArrowLeft',
        altKey: true,
      });
      fireEvent.keyDown(screen.getByTestId('doc-2'), {
        key: 'ArrowRight',
        altKey: true,
      });

      expect(onReorder).not.toHaveBeenCalled();
    });

    it('ignores arrows without Alt', (): void => {
      const { onReorder } = renderCarousel({ documents: THREE });

      fireEvent.keyDown(screen.getByTestId('doc-0'), { key: 'ArrowRight' });

      expect(onReorder).not.toHaveBeenCalled();
    });
  });

  describe('adding images', (): void => {
    it('passes chosen files, in order, after Upload opens the file picker', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onFiles, onCamera } = renderCarousel({ documents: THREE });
      const input: HTMLInputElement = screen.getByTestId('file-input');
      const click: Mock<() => void> = vi.fn<() => void>();
      input.addEventListener('click', click);

      await user.click(screen.getByRole('button', { name: 'Upload images' }));
      expect(click).toHaveBeenCalledTimes(1);

      const files: File[] = [imageFile('one.png'), imageFile('two.png')];
      await user.upload(input, files);

      expect(onFiles).toHaveBeenCalledTimes(1);
      expect(onFiles).toHaveBeenCalledWith(files);
      expect(onCamera).not.toHaveBeenCalled();
    });

    it('opens the in-app camera when the browser gives camera access', async (): Promise<void> => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn() },
      });
      const user: UserEvent = userEvent.setup();
      const { onCamera } = renderCarousel({ documents: THREE });

      await user.click(screen.getByRole('button', { name: 'Take photo' }));

      expect(onCamera).toHaveBeenCalledTimes(1);
    });

    it('falls back to the file picker for photos without camera access', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      const { onCamera } = renderCarousel({ documents: THREE });
      const input: HTMLInputElement = screen.getByTestId('file-input');
      const click: Mock<() => void> = vi.fn<() => void>();
      input.addEventListener('click', click);

      await user.click(screen.getByRole('button', { name: 'Take photo' }));

      expect(onCamera).not.toHaveBeenCalled();
      expect(click).toHaveBeenCalledTimes(1);
      expect(input).toHaveAttribute('capture', 'environment');
    });

    it('accepts dropped images without letting the drop reach the page behind', (): void => {
      const handlers: Handlers = makeHandlers();
      const pageDrop: Mock<() => void> = vi.fn<() => void>();
      render(
        <div onDrop={pageDrop}>{carousel({ documents: THREE }, handlers)}</div>,
      );
      const files: File[] = [imageFile('a.png'), imageFile('b.png')];

      fireEvent.drop(screen.getByRole('list', { name: 'Documents' }), {
        dataTransfer: { files },
      });

      expect(handlers.onFiles).toHaveBeenCalledWith(files);
      expect(pageDrop).not.toHaveBeenCalled();
    });

    it('highlights the add tile while images are dragged over the carousel', (): void => {
      const { result } = renderCarousel({ documents: THREE });
      const list: HTMLElement = screen.getByRole('list', {
        name: 'Documents',
      });
      const tile: Element | null = result.container.querySelector('.add-tile');

      fireEvent.dragOver(list);
      expect(tile).toHaveClass('is-over');

      fireEvent.dragLeave(list);
      expect(tile).not.toHaveClass('is-over');
    });
  });

  describe('scrolling to new documents', (): void => {
    it('scrolls to the end when a document is added, without selection', (): void => {
      const handlers: Handlers = makeHandlers();
      const { container, rerender } = render(
        carousel({ documents: THREE.slice(0, 2) }, handlers),
      );
      expect(scrollTo).not.toHaveBeenCalled();
      const strip: Element | null = container.querySelector('.doc-carousel');
      if (!strip) throw new Error('no carousel');
      // jsdom has no layout: the carousel is as wide as its content says
      Object.defineProperty(strip, 'scrollWidth', {
        configurable: true,
        value: 840,
      });

      rerender(carousel({ documents: THREE }, handlers));

      expect(scrollTo).toHaveBeenCalledTimes(1);
      expect(scrollTo.mock.contexts[0]).toBe(strip);
      expect(scrollTo).toHaveBeenCalledWith({ left: 840, behavior: 'smooth' });
    });

    it('compares with the latest count: adding then removing scrolls only for the addition', (): void => {
      const handlers: Handlers = makeHandlers();
      const { rerender } = render(
        carousel({ documents: THREE.slice(0, 1) }, handlers),
      );

      rerender(carousel({ documents: THREE }, handlers));
      expect(scrollTo).toHaveBeenCalledTimes(1);

      // Still more than at the start, but one fewer than just before
      rerender(carousel({ documents: THREE.slice(0, 2) }, handlers));
      expect(scrollTo).toHaveBeenCalledTimes(1);

      rerender(carousel({ documents: THREE }, handlers));
      expect(scrollTo).toHaveBeenCalledTimes(2);
    });

    it('does not scroll when a document is removed', (): void => {
      const handlers: Handlers = makeHandlers();
      const { rerender } = render(carousel({ documents: THREE }, handlers));

      rerender(carousel({ documents: THREE.slice(0, 2) }, handlers));

      expect(scrollTo).not.toHaveBeenCalled();
    });

    it('does not scroll to the end with selection, which follows the active one', (): void => {
      const handlers: Handlers = makeHandlers();
      const { rerender } = render(
        carousel(
          { documents: THREE.slice(0, 2), selectable: true, activeId: 'a' },
          handlers,
        ),
      );

      rerender(
        carousel(
          { documents: THREE, selectable: true, activeId: 'a' },
          handlers,
        ),
      );

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });
});
