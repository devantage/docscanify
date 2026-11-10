import type { ScannedDocument } from '@devantage/docscanify';
import { render, type RenderResult, screen } from '@testing-library/react';
import type { JSX } from 'react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import type { Step } from '@/features/steps';
import { StepsContext } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem, ExportSettings, Filter } from '@/lib/types';

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

/** A document with valid corners and the given color filter, named after its id. */
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
    options: { filter, turns: 0, sharpen: 'off' },
  };
}

/** An empty canvas of the given size in px, standing in for a render. */
function canvas(width: number, height: number): HTMLCanvasElement {
  const element: HTMLCanvasElement = document.createElement('canvas');
  element.width = width;
  element.height = height;
  return element;
}

/** What the mocked {@link useResultPreview} returns: a ready 600 × 800 px render by default. */
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

/** The export settings of a new scan: an A4 PDF without margins. */
const PDF_A4: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margins: 0,
  combine: true,
};

/**
 * The steps in English at the given step, with a session of the given documents, `active` on
 * display (the first one by default) and the given export settings.
 */
function steps(
  step: Step,
  documents: DocumentItem[],
  active: DocumentItem = documents[0],
  exportSettings: ExportSettings = PDF_A4,
): JSX.Element {
  const scan: ScanContextValue = {
    documents,
    active,
    invalidCount: 0,
    previews: {},
    importProgress: null,
    exportSettings,
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
  return (
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <StepsContext.Provider value={{ step, goTo: vi.fn() }}>
          <ScanContext.Provider value={scan}>
            <ResultSteps />
          </ScanContext.Provider>
        </StepsContext.Provider>
      </ToastProvider>
    </TranslateProvider>
  );
}

/** Renders {@link steps}. */
function renderSteps(
  step: Step,
  documents: DocumentItem[],
  active: DocumentItem = documents[0],
  exportSettings: ExportSettings = PDF_A4,
): RenderResult {
  return render(steps(step, documents, active, exportSettings));
}

let drawImage: Mock;

beforeEach((): void => {
  vi.mocked(useResultPreview).mockReset();
  // jsdom has no canvas pixels: the preview copies the render through a stand-in context
  drawImage = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    drawImage,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
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

  describe('PDF page preview', (): void => {
    it('shows the render on the A4 page of the PDF in the Export step', (): void => {
      vi.mocked(useResultPreview).mockReturnValue(preview());
      renderSteps('export', [makeDocument('a')]);

      const image: HTMLCanvasElement = screen.getByRole('img', {
        name: 'Preview of document 1 as a PDF (A4)',
      });
      expect(image).toHaveAttribute('data-page-format', 'a4');
      // A portrait A4 page, 800 px tall like the render
      expect(image.height).toBe(800);
      expect(image.width).toBe(Math.round((595.28 * 800) / 841.89));
      // The status keeps the size of the render, which is what the PDF embeds
      expect(screen.getByTestId('export-panel')).toHaveTextContent(
        /^600 × 800 px$/,
      );
    });

    it.each([
      ['letter', 'Letter', { pageFormat: 'letter' }],
      ['image', 'Document size', { pageFormat: 'image', margins: 2 }],
    ] as const)(
      'names the page format in the preview: %s',
      (
        pageFormat: string,
        label: string,
        overrides: Partial<ExportSettings>,
      ): void => {
        vi.mocked(useResultPreview).mockReturnValue(preview());
        const docs: DocumentItem[] = [makeDocument('a'), makeDocument('b')];
        renderSteps('export', docs, docs[1], { ...PDF_A4, ...overrides });

        expect(
          screen.getByRole('img', {
            name: `Preview of document 2 as a PDF (${label})`,
          }),
        ).toHaveAttribute('data-page-format', pageFormat);
      },
    );

    it('makes room for the margins on a page the size of the document', (): void => {
      vi.mocked(useResultPreview).mockReturnValue(preview());
      renderSteps('export', [makeDocument('a')], undefined, {
        ...PDF_A4,
        pageFormat: 'image',
        margins: 2.54,
      });

      // 600 × 800 px at 150 dpi = 288 × 384 pt, plus 72 pt on each side
      const image: HTMLCanvasElement = screen.getByTestId('result');
      expect(image.height).toBe(800);
      expect(image.width).toBe(Math.round((432 * 800) / 528));
    });

    it.each(['png', 'jpg'] as const)(
      'shows the plain render when exporting to %s',
      (format: 'png' | 'jpg'): void => {
        vi.mocked(useResultPreview).mockReturnValue(preview());
        renderSteps('export', [makeDocument('a')], undefined, {
          ...PDF_A4,
          format,
        });

        const image: HTMLCanvasElement = screen.getByRole('img', {
          name: 'Preview of document 1, cropped',
        });
        expect(image).not.toHaveAttribute('data-page-format');
        expect(image.width).toBe(600);
        expect(image.height).toBe(800);
      },
    );

    it('shows the plain render in the Adjust step, even when exporting to PDF', (): void => {
      vi.mocked(useResultPreview).mockReturnValue(preview());
      renderSteps('enhance', [makeDocument('a')]);

      const image: HTMLCanvasElement = screen.getByTestId('result');
      expect(image).not.toHaveAttribute('data-page-format');
      expect(image.width).toBe(600);
      expect(image.height).toBe(800);
    });

    it('does not lay out and draw the page again while the render and the settings stay the same', (): void => {
      const result: HTMLCanvasElement = canvas(600, 800);
      vi.mocked(useResultPreview).mockReturnValue(preview({ result }));
      const docs: DocumentItem[] = [makeDocument('a')];
      const { rerender } = renderSteps('export', docs);

      vi.mocked(useResultPreview).mockReturnValue(
        preview({ result, busy: true, rendering: true }),
      );
      rerender(steps('export', docs));

      expect(screen.getByTestId('result')).toHaveClass('is-page', 'is-busy');
      expect(drawImage).toHaveBeenCalledTimes(1);
    });
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
