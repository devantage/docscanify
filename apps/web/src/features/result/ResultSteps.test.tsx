import type { ScannedDocument } from '@devantage/docscanify';
import { render, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import type { Step } from '@/features/steps';
import { StepsContext } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem, Filter } from '@/lib/types';

import { ResultSteps } from './ResultSteps';
import type { UseRenderedDocumentResult } from './useRenderedDocument';
import { useResultPreview } from './useResultPreview';

// The render and the panels have their own tests: here they show what the steps give them
vi.mock('./useResultPreview', (): Record<string, unknown> => ({
  useResultPreview: vi.fn(),
}));
vi.mock('./EnhancePanel', (): Record<string, unknown> => ({
  EnhancePanel: ({ status }: { status: string }): JSX.Element => (
    <div data-testid="enhance-panel">{status}</div>
  ),
}));
vi.mock('./ExportPanel', (): Record<string, unknown> => ({
  ExportPanel: ({
    status,
    ready,
  }: {
    status: string;
    ready: boolean;
  }): JSX.Element => (
    <div data-testid="export-panel" data-ready={String(ready)}>
      {status}
    </div>
  ),
}));
vi.mock('@/features/scan/DocumentStrip', (): Record<string, unknown> => ({
  DocumentStrip: (): JSX.Element => <div data-testid="document-strip" />,
}));

function makeDocument(id: string, filter: Filter = 'none'): DocumentItem {
  return {
    id,
    source: {
      image: document.createElement('img'),
      url: `blob:${id}`,
      name: id,
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: 10, y: 0 },
      bottomRight: { x: 10, y: 10 },
      bottomLeft: { x: 0, y: 10 },
    },
    valid: true,
    detectorFailed: false,
    options: { filter, turns: 0, sharpen: 'off', denoise: false },
  };
}

function canvas(width: number, height: number): HTMLCanvasElement {
  const element: HTMLCanvasElement = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

function preview(
  overrides: Partial<UseRenderedDocumentResult> = {},
): UseRenderedDocumentResult {
  return {
    result: canvas(600, 800),
    ready: true,
    busy: false,
    failed: false,
    rendering: false,
    ...overrides,
  };
}

function renderSteps(
  step: Step,
  documents: DocumentItem[],
  active: DocumentItem = documents[0],
): void {
  const scan: ScanContextValue = {
    documents,
    active,
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
      // Not used by these steps
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
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
  render(
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <StepsContext.Provider value={{ step, goTo: vi.fn() }}>
          <ScanContext.Provider value={scan}>
            <ResultSteps />
          </ScanContext.Provider>
        </StepsContext.Provider>
      </ToastProvider>
    </TranslateProvider>,
  );
}

beforeEach((): void => {
  vi.mocked(useResultPreview).mockReset();
  // jsdom has no canvas pixels: the preview copies the render through a stand-in context
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
});

describe('ResultSteps', (): void => {
  it('shows the Adjust panel on the Enhance step', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    renderSteps('enhance', [makeDocument('a')]);

    expect(screen.getByTestId('enhance-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('export-panel')).not.toBeInTheDocument();
  });

  it('shows the Export panel on the Export step', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    renderSteps('export', [makeDocument('a')]);

    expect(screen.getByTestId('export-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('enhance-panel')).not.toBeInTheDocument();
  });

  it('renders the preview of the document on display', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    const docs: DocumentItem[] = [makeDocument('a'), makeDocument('b')];
    renderSteps('enhance', docs, docs[1]);

    expect(useResultPreview).toHaveBeenLastCalledWith(docs[1]);
  });

  it('gives the size of the rendered document as the status of a single document', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(
      preview({ result: canvas(1240, 1754) }),
    );
    renderSteps('enhance', [makeDocument('a')]);

    expect(screen.getByTestId('enhance-panel')).toHaveTextContent(
      /^1240 × 1754 px$/,
    );
  });

  it('says the options are being applied while the render is not ready', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(
      preview({ result: canvas(1240, 1754), ready: false, busy: true }),
    );
    renderSteps('enhance', [makeDocument('a')]);

    expect(screen.getByTestId('enhance-panel')).toHaveTextContent(
      /^Applying…$/,
    );
  });

  it('says the options are being applied before the first render', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(
      preview({ result: null, ready: true }),
    );
    renderSteps('export', [makeDocument('a')]);

    expect(screen.getByTestId('export-panel')).toHaveTextContent(/^Applying…$/);
  });

  it('adds the position of the document on display when there are several', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    const docs: DocumentItem[] = [
      makeDocument('a'),
      makeDocument('b'),
      makeDocument('c'),
    ];
    renderSteps('export', docs, docs[1]);

    expect(screen.getByTestId('export-panel')).toHaveTextContent(
      /^Document 2 of 3 · 600 × 800 px$/,
    );
  });

  it('adds the position to the applying status too', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview({ ready: false }));
    const docs: DocumentItem[] = [makeDocument('a'), makeDocument('b')];
    renderSteps('enhance', docs, docs[0]);

    expect(screen.getByTestId('enhance-panel')).toHaveTextContent(
      /^Document 1 of 2 · Applying…$/,
    );
  });

  it('enables the export only with a ready, successful render', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    renderSteps('export', [makeDocument('a')]);

    expect(screen.getByTestId('export-panel')).toHaveAttribute(
      'data-ready',
      'true',
    );
  });

  it.each([
    ['still rendering', { ready: false }],
    ['failed', { failed: true }],
    ['without a result', { result: null }],
  ])(
    'disables the export when the render is %s',
    (_case: string, overrides: Partial<UseRenderedDocumentResult>): void => {
      vi.mocked(useResultPreview).mockReturnValue(preview(overrides));
      renderSteps('export', [makeDocument('a')]);

      expect(screen.getByTestId('export-panel')).toHaveAttribute(
        'data-ready',
        'false',
      );
    },
  );

  it('names the preview after the position of the document and exposes its filter', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    const docs: DocumentItem[] = [
      makeDocument('a'),
      makeDocument('b'),
      makeDocument('c', 'bw'),
    ];
    renderSteps('enhance', docs, docs[2]);

    const image: HTMLElement = screen.getByRole('img', {
      name: 'Preview of document 3, cropped',
    });
    expect(image).toHaveAttribute('data-filter', 'bw');
    expect(image).not.toHaveClass('is-busy');
  });

  it('fades the preview and shows the spinner while a new render runs', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(
      preview({ ready: false, busy: true, rendering: true }),
    );
    renderSteps('enhance', [makeDocument('a')]);

    expect(screen.getByTestId('result')).toHaveClass('is-busy');
    expect(screen.getByTestId('loading')).toBeInTheDocument();
  });

  it('lays out the preview stage with the carousel under it', (): void => {
    vi.mocked(useResultPreview).mockReturnValue(preview());
    renderSteps('enhance', [makeDocument('a')]);

    const stage: HTMLElement = screen.getByRole('region', {
      name: 'Document preview',
    });
    expect(stage.querySelector('.stage-main.stage-result')).toContainElement(
      screen.getByTestId('result'),
    );
    expect(stage).toContainElement(screen.getByTestId('document-strip'));
  });
});
