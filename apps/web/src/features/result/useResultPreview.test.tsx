import type { Corners, ScannedDocument } from '@devantage/docscanify';
import {
  renderHook,
  type RenderHookResult,
  screen,
} from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import type { CurrentRender } from '@/features/documents/usePreviews';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import {
  useRenderedDocument,
  type UseRenderedDocumentResult,
} from './useRenderedDocument';
import { useResultPreview } from './useResultPreview';

// The render itself is covered by the tests of useRenderedDocument
vi.mock('./useRenderedDocument', (): Record<string, unknown> => ({
  useRenderedDocument: vi.fn(),
}));
// Keeps OpenCV out of the thumbnails module, which only lends its preview key here
vi.mock('@/lib/scan', (): Record<string, unknown> => ({
  NO_ENHANCEMENTS: {
    filter: 'none',
    turns: 0,
    sharpen: 'off',
    denoise: false,
  },
  renderWith: vi.fn(),
}));

const CORNERS: Corners = {
  topLeft: { x: 1, y: 2 },
  topRight: { x: 30, y: 2 },
  bottomRight: { x: 30, y: 40 },
  bottomLeft: { x: 1, y: 40 },
};

const OPTIONS: EnhanceOptions = {
  filter: 'grayscale',
  turns: 1,
  sharpen: 'soft',
  denoise: true,
};

const FAILED: string = 'These options could not be applied on this device.';

/** A document with valid corners and adjustments, named after its id. */
function makeDocument(id: string = 'doc-1'): DocumentItem {
  return {
    id,
    source: {
      image: document.createElement('img'),
      url: `blob:${id}`,
      name: id,
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: OPTIONS,
  };
}

/** The key of the thumbnails of the Enhance and Export steps: crop and adjustments. */
const enhanceKey = (doc: DocumentItem): string =>
  JSON.stringify([doc.corners, doc.options]);

/** What the mocked {@link useRenderedDocument} returns: a first render in progress by default. */
function rendered(
  overrides: Partial<UseRenderedDocumentResult> = {},
): UseRenderedDocumentResult {
  return {
    result: null,
    ready: false,
    busy: true,
    failed: false,
    rendering: true,
    ...overrides,
  };
}

let setMainRender: Mock<(current: CurrentRender | null) => void>;

/** The language (English), toast, and session providers; the session records `setMainRender`. */
function Providers({ children }: { children: ReactNode }): JSX.Element {
  const scan: ScanContextValue = {
    documents: [],
    active: null,
    invalidCount: 0,
    previews: {},
    importProgress: null,
    exportSettings: {
      format: 'pdf',
      pageFormat: 'a4',
      margin: 0,
      combine: true,
    },
    addFiles: vi.fn(async (): Promise<void> => {
      // Not used by this hook
    }),
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
    setMainRender,
    setDraggingCorner: vi.fn(),
  };
  return (
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <ScanContext.Provider value={scan}>{children}</ScanContext.Provider>
      </ToastProvider>
    </TranslateProvider>
  );
}

type Hook = RenderHookResult<UseRenderedDocumentResult, { doc: DocumentItem }>;

/** Renders the hook for `doc`; `rerender({ doc })` puts another document on display. */
function renderPreview(doc: DocumentItem): Hook {
  return renderHook(
    ({ doc: current }: { doc: DocumentItem }): UseRenderedDocumentResult =>
      useResultPreview(current),
    { initialProps: { doc }, wrapper: Providers },
  );
}

/** An empty canvas `width` px wide, standing in for a render. */
const canvas = (width: number): HTMLCanvasElement => {
  const element: HTMLCanvasElement = document.createElement('canvas');
  element.width = width;
  return element;
};

/** The toasts on screen, in order, as `kind: text`. */
const toasts = (): string[] =>
  screen
    .queryAllByTestId('toast')
    .map(
      (toast: HTMLElement) =>
        `${toast.dataset.kind ?? ''}: ${toast.textContent}`,
    );

beforeEach((): void => {
  vi.mocked(useRenderedDocument).mockReset();
  setMainRender = vi.fn();
});

describe('useResultPreview', (): void => {
  it('returns the render of the document on display as it is', (): void => {
    const value: UseRenderedDocumentResult = rendered({
      result: canvas(10),
      ready: true,
      busy: false,
      rendering: false,
    });
    vi.mocked(useRenderedDocument).mockReturnValue(value);
    const doc: DocumentItem = makeDocument();

    const hook: Hook = renderPreview(doc);

    expect(hook.result.current).toBe(value);
    expect(useRenderedDocument).toHaveBeenLastCalledWith(doc);
  });

  it('shares nothing as the thumbnail while the render is not ready', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: canvas(10), ready: false }),
    );

    renderPreview(makeDocument());

    expect(setMainRender.mock.calls).toEqual([[null]]);
  });

  it('shares the ready render as the thumbnail of the document, with its key', (): void => {
    const result: HTMLCanvasElement = canvas(300);
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result, ready: true, busy: false, rendering: false }),
    );
    const doc: DocumentItem = makeDocument('doc-9');

    renderPreview(doc);

    expect(setMainRender).toHaveBeenLastCalledWith({
      id: 'doc-9',
      key: enhanceKey(doc),
      canvas: result,
    });
  });

  it('shares a failed render as a thumbnail without an image', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: canvas(300), ready: true, failed: true }),
    );
    const doc: DocumentItem = makeDocument();

    renderPreview(doc);

    expect(setMainRender).toHaveBeenLastCalledWith({
      id: 'doc-1',
      key: enhanceKey(doc),
      canvas: null,
    });
  });

  it('updates the shared thumbnail when a new render becomes ready', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(rendered());
    const hook: Hook = renderPreview(makeDocument());
    const next: HTMLCanvasElement = canvas(500);

    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: next, ready: true }),
    );
    const doc: DocumentItem = makeDocument();
    hook.rerender({ doc });

    expect(setMainRender.mock.calls).toEqual([
      [null],
      [{ id: 'doc-1', key: enhanceKey(doc), canvas: next }],
    ]);
  });

  it('shares the new canvas whenever the result changes, even while it stays ready', (): void => {
    const first: HTMLCanvasElement = canvas(300);
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: first, ready: true }),
    );
    const doc: DocumentItem = makeDocument();
    const hook: Hook = renderPreview(doc);
    const second: HTMLCanvasElement = canvas(600);

    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: second, ready: true }),
    );
    hook.rerender({ doc });

    expect(setMainRender.mock.calls).toEqual([
      [{ id: 'doc-1', key: enhanceKey(doc), canvas: first }],
      [{ id: 'doc-1', key: enhanceKey(doc), canvas: second }],
    ]);
  });

  it('stops sharing the thumbnail when it unmounts', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: canvas(300), ready: true }),
    );
    const hook: Hook = renderPreview(makeDocument());

    hook.unmount();

    expect(setMainRender).toHaveBeenLastCalledWith(null);
  });

  it('reports a failed render in an error toast', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ ready: true, failed: true }),
    );

    renderPreview(makeDocument());

    expect(toasts()).toEqual([`error: ${FAILED}`]);
    expect(screen.getByRole('alert')).toHaveTextContent(FAILED);
  });

  it('shows the failure once, not again on every render', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ ready: true, failed: true }),
    );
    const hook: Hook = renderPreview(makeDocument());

    hook.rerender({ doc: makeDocument() });
    hook.rerender({ doc: makeDocument() });

    expect(toasts()).toEqual([`error: ${FAILED}`]);
  });

  it('removes the failure toast once a render succeeds', (): void => {
    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ ready: true, failed: true }),
    );
    const hook: Hook = renderPreview(makeDocument());

    vi.mocked(useRenderedDocument).mockReturnValue(
      rendered({ result: canvas(10), ready: true, failed: false }),
    );
    hook.rerender({ doc: makeDocument() });

    expect(toasts()).toEqual([]);
  });
});
