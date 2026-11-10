import type { ScannedDocument } from '@devantage/docscanify';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { JSX, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { CameraContextValue } from '@/features/camera/CameraContext';
import { useCamera } from '@/features/camera/useCamera';
import type { Preview } from '@/features/documents/usePreviews';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { DocumentStrip } from './DocumentStrip';
import type { ScanContextValue } from './ScanContext';
import { useScan } from './useScan';

vi.mock('./useScan', () => ({ useScan: vi.fn() }));
vi.mock('@/features/camera/useCamera', () => ({ useCamera: vi.fn() }));

/** A document with valid corners and no adjustments, named after its id, changed by `patch`. */
function makeDoc(id: string, patch: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id,
    source: {
      image: new Image(),
      url: `blob:${id}`,
      name: id,
      scannedDocument: {} as ScannedDocument,
    },
    corners: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 10, y: 0 },
      bottomRight: { x: 10, y: 10 },
      bottomLeft: { x: 0, y: 10 },
    },
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off' },
    ...patch,
  };
}

/**
 * A session with the given documents and thumbnails, whose operations are mocks.
 *
 * @param activeId Id of the document on display; null, or an id not in `documents`, for none.
 */
function fakeScan(
  documents: DocumentItem[],
  activeId: string | null,
  previews: Record<string, Preview> = {},
): ScanContextValue {
  return {
    documents,
    active: documents.find((d: DocumentItem) => d.id === activeId) ?? null,
    invalidCount: 0,
    previews,
    importProgress: null,
    exportSettings: {
      format: 'pdf',
      pageFormat: 'a4',
      margins: 0,
      combine: true,
    },
    addFiles: vi.fn(async (): Promise<void> => Promise.resolve()),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners: vi.fn(),
    redetect: vi.fn(),
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
    setExportSettings: vi.fn(),
    restart: vi.fn(),
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
}

const camera: CameraContextValue = {
  isOpen: false,
  open: vi.fn(),
  close: vi.fn(),
};

/** The language provider the strip needs. */
const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TranslateProvider>{children}</TranslateProvider>
);

/** Renders the strip with {@link useScan} returning `scan`, and returns `scan` for its mocks. */
function renderStrip(scan: ScanContextValue): ScanContextValue {
  vi.mocked(useScan).mockReturnValue(scan);
  render(<DocumentStrip />, { wrapper });
  return scan;
}

describe('DocumentStrip', (): void => {
  beforeEach((): void => {
    vi.mocked(useCamera).mockReturnValue(camera);
    // jsdom does not scroll
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.scrollTo = vi.fn();
  });

  afterEach((): void => {
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('shows nothing without a document on display', (): void => {
    vi.mocked(useScan).mockReturnValue(fakeScan([], null));

    const { container } = render(<DocumentStrip />, { wrapper });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the documents in export order, with the one on display marked', (): void => {
    renderStrip(
      fakeScan(
        [makeDoc('a'), makeDoc('b', { valid: false }), makeDoc('c')],
        'c',
      ),
    );

    const list: HTMLElement = screen.getByRole('list', { name: 'Documents' });
    expect(
      within(list)
        .getAllByRole('button', { name: /^Document \d/ })
        .map((b: HTMLElement) => b.getAttribute('aria-label')),
    ).toEqual(['Document 1', 'Document 2, needs a crop fix', 'Document 3']);
    expect(screen.getByTestId('doc-2')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('doc-0')).not.toHaveAttribute('aria-current');
  });

  it('is the compact carousel', (): void => {
    renderStrip(fakeScan([makeDoc('a')], 'a'));

    expect(document.querySelector('.doc-carousel')).toHaveClass('is-compact');
  });

  it('shows the thumbnail of each document as it looks in the step', (): void => {
    renderStrip(
      fakeScan([makeDoc('a'), makeDoc('b')], 'a', {
        a: { url: 'data:a', pending: false },
        b: { url: null, pending: true },
      }),
    );

    expect(screen.getByTestId('doc-0').querySelector('img')).toHaveAttribute(
      'src',
      'data:a',
    );
    // Without a thumbnail yet, the original image shows up, marked busy
    expect(screen.getByTestId('doc-1').querySelector('img')).toHaveAttribute(
      'src',
      'blob:b',
    );
    expect(screen.getByTestId('doc-1')).toHaveAttribute('aria-busy', 'true');
  });

  it('puts a tapped document on display', async (): Promise<void> => {
    const scan: ScanContextValue = renderStrip(
      fakeScan([makeDoc('a'), makeDoc('b')], 'a'),
    );

    await userEvent.click(screen.getByTestId('doc-1'));

    expect(scan.select).toHaveBeenCalledTimes(1);
    expect(scan.select).toHaveBeenCalledWith('b');
  });

  it('removes a document from the session', async (): Promise<void> => {
    const scan: ScanContextValue = renderStrip(
      fakeScan([makeDoc('a'), makeDoc('b')], 'a'),
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Remove document 2' }),
    );

    expect(scan.removeDocument).toHaveBeenCalledWith('b');
    expect(scan.select).not.toHaveBeenCalled();
  });

  it('reorders the documents with Alt + arrow keys', (): void => {
    const scan: ScanContextValue = renderStrip(
      fakeScan([makeDoc('a'), makeDoc('b'), makeDoc('c')], 'a'),
    );
    const items: HTMLElement[] = Array.from(
      document.querySelectorAll<HTMLElement>('[data-sortable]'),
    );

    fireEvent.keyDown(items[0], { key: 'ArrowRight', altKey: true });
    fireEvent.keyDown(items[2], { key: 'ArrowLeft', altKey: true });

    expect(vi.mocked(scan.reorder).mock.calls).toEqual([
      [0, 1],
      [2, 1],
    ]);
  });

  it('imports the chosen images into the session, in order', async (): Promise<void> => {
    const scan: ScanContextValue = renderStrip(fakeScan([makeDoc('a')], 'a'));
    const files: File[] = [
      new File(['1'], 'one.png', { type: 'image/png' }),
      new File(['2'], 'two.png', { type: 'image/png' }),
    ];

    await userEvent.upload(screen.getByTestId('file-input'), files);

    expect(scan.addFiles).toHaveBeenCalledTimes(1);
    expect(scan.addFiles).toHaveBeenCalledWith(files);
  });

  it('opens the in-app camera from the take photo button when the browser allows it', async (): Promise<void> => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn() },
      configurable: true,
    });
    renderStrip(fakeScan([makeDoc('a')], 'a'));

    await userEvent.click(screen.getByTestId('add-camera'));

    expect(camera.open).toHaveBeenCalledTimes(1);
  });

  it('falls back to the file picker with the native camera without camera access', async (): Promise<void> => {
    renderStrip(fakeScan([makeDoc('a')], 'a'));
    const input: HTMLInputElement = screen.getByTestId('file-input');
    const click: () => void = vi.fn();
    input.addEventListener('click', click);

    await userEvent.click(screen.getByTestId('add-camera'));

    expect(camera.open).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute('capture', 'environment');
  });
});
