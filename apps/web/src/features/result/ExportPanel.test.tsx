import type { ScannedDocument } from '@devantage/docscanify';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { ToastProvider } from '@/components/toast';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import type { Step } from '@/features/steps';
import { StepsContext } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import {
  downloadFile,
  exportDocuments,
  type ExportedFile,
  type ExportItem,
} from '@/lib/export';
import { MIN_LOADING_MS } from '@/lib/loading';
import type { DocumentItem, ExportSettings } from '@/lib/types';

import { ExportPanel } from './ExportPanel';

// Encoding and rendering need OpenCV and real images: the panel is tested around them
vi.mock('@/lib/export', (): Record<string, unknown> => ({
  exportDocuments: vi.fn(),
  downloadFile: vi.fn(),
}));
vi.mock('@/features/documents/renderCache', (): Record<string, unknown> => ({
  renderDocument: vi.fn(),
}));

type ExportOptions = Parameters<typeof exportDocuments>[2];

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

/** A promise that the test settles from outside, to hold the export at a given point. */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = (): void => undefined;
  let reject: (reason: unknown) => void = (): void => undefined;
  const promise: Promise<T> = new Promise<T>(
    (res: (value: T) => void, rej: (reason: unknown) => void): void => {
      resolve = res;
      reject = rej;
    },
  );
  return { promise, resolve, reject };
}

const SETTINGS: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margin: 0,
  combine: true,
};

const FILE: ExportedFile = {
  blob: new Blob(['%PDF'], { type: 'application/pdf' }),
  fileName: 'documents-202611060840.pdf',
};

/** A document without corners or adjustments whose image is named `scan-<id>`. */
function makeDocument(id: string): DocumentItem {
  return {
    id,
    source: {
      image: document.createElement('img'),
      url: `blob:${id}`,
      name: `scan-${id}`,
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: null,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  };
}

interface Session {
  goTo: Mock<(step: Step) => void>;
  restart: Mock<() => void>;
  setExportSettings: Mock<(settings: ExportSettings) => void>;
}

interface PanelOptions {
  documents?: DocumentItem[];
  settings?: ExportSettings;
  ready?: boolean;
  status?: string;
}

/**
 * Renders the panel in English at the Export step and returns the mocks of the session
 * operations it calls. By default the session has three documents, exported as a single PDF.
 */
function renderPanel({
  documents = [makeDocument('a'), makeDocument('b'), makeDocument('c')],
  settings = SETTINGS,
  ready = true,
  status = '600 × 800 px',
}: PanelOptions = {}): Session {
  const session: Session = {
    goTo: vi.fn(),
    restart: vi.fn(),
    setExportSettings: vi.fn(),
  };
  const scan: ScanContextValue = {
    documents,
    active: documents[0],
    invalidCount: 0,
    previews: {},
    importProgress: null,
    exportSettings: settings,
    addFiles: vi.fn(async (): Promise<void> => {
      // Not used by this panel
    }),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners: vi.fn(),
    redetect: vi.fn(),
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
    setExportSettings: session.setExportSettings,
    restart: session.restart,
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
  render(
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <StepsContext.Provider value={{ step: 'export', goTo: session.goTo }}>
          <ScanContext.Provider value={scan}>
            <ExportPanel status={status} ready={ready} />
          </ScanContext.Provider>
        </StepsContext.Provider>
      </ToastProvider>
    </TranslateProvider>,
  );
  return session;
}

/** The toasts on screen, in order, as `kind: text`. */
const toasts = (): string[] =>
  screen
    .queryAllByTestId('toast')
    .map(
      (toast: HTMLElement) =>
        `${toast.dataset.kind ?? ''}: ${toast.textContent}`,
    );

/** The options the export received, to report progress through them. */
function exportOptions(): ExportOptions {
  const call: Parameters<typeof exportDocuments> | undefined = vi
    .mocked(exportDocuments)
    .mock.calls.at(-1);
  if (!call) throw new Error('exportDocuments was not called');
  return call[2];
}

/** Reports export progress as {@link exportDocuments} does, after `done` of `total` documents. */
function reportProgress(done: number, total: number): void {
  act((): void => {
    exportOptions().onProgress?.(done, total);
  });
}

/** Advances the fake clock by `ms` and lets React render the result. */
async function advance(ms: number): Promise<void> {
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The export progress bar; throws when the export button shows instead. */
const progressBar = (): HTMLElement => screen.getByRole('progressbar');

beforeEach((): void => {
  // The module mocks keep their implementations between tests otherwise
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation((): void => undefined);
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('ExportPanel', (): void => {
  it('shows the title, the render status and the export options', (): void => {
    renderPanel({ status: 'Document 1 of 3 · 600 × 800 px' });

    expect(screen.getByRole('heading', { name: 'Export' })).toBeInTheDocument();
    expect(screen.getByTestId('result-size')).toHaveTextContent(
      'Document 1 of 3 · 600 × 800 px',
    );
    expect(screen.getByTestId('result-size')).toHaveAttribute('role', 'status');
    expect(screen.getByRole('radio', { name: 'PDF' })).toBeChecked();
    // Three documents as PDF: the file choice shows up
    expect(screen.getByRole('group', { name: 'File' })).toBeInTheDocument();
  });

  it('hides the file choice for a single document', (): void => {
    renderPanel({ documents: [makeDocument('a')] });

    expect(
      screen.queryByRole('group', { name: 'File' }),
    ).not.toBeInTheDocument();
  });

  it('saves the changed options in the session', (): void => {
    const session: Session = renderPanel();

    fireEvent.click(screen.getByRole('radio', { name: 'PNG' }));

    expect(session.setExportSettings).toHaveBeenCalledExactlyOnceWith({
      ...SETTINGS,
      format: 'png',
    });
  });

  it('disables Export while the preview is not ready', (): void => {
    renderPanel({ ready: false });

    const button: HTMLElement = screen.getByTestId('download');
    expect(button).toHaveTextContent('Export');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(exportDocuments).not.toHaveBeenCalled();
  });

  it('exports every document in carousel order with the chosen options', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    const settings: ExportSettings = { ...SETTINGS, combine: false, margin: 8 };
    renderPanel({ settings });

    fireEvent.click(screen.getByTestId('download'));

    expect(exportDocuments).toHaveBeenCalledTimes(1);
    const [items, used] = vi.mocked(exportDocuments).mock.calls[0];
    expect(items.map((item: ExportItem) => item.name)).toEqual([
      'scan-a',
      'scan-b',
      'scan-c',
    ]);
    expect(used).toEqual(settings);
  });

  it('replaces the Export button with a progress bar counting the documents', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    renderPanel();

    fireEvent.click(screen.getByTestId('download'));

    expect(screen.queryByTestId('download')).not.toBeInTheDocument();
    expect(screen.getByTestId('export-progress')).toBeInTheDocument();
    expect(progressBar()).toHaveAccessibleName('Creating 1 of 3…');
    expect(progressBar()).toHaveAttribute('aria-valuenow', '0');

    // Each document is a step, and putting the file together is the last one
    reportProgress(1, 3);
    expect(progressBar()).toHaveAccessibleName('Creating 2 of 3…');
    expect(progressBar()).toHaveAttribute('aria-valuenow', '25');

    reportProgress(2, 3);
    expect(progressBar()).toHaveAccessibleName('Creating 3 of 3…');
    expect(progressBar()).toHaveAttribute('aria-valuenow', '50');

    reportProgress(3, 3);
    expect(progressBar()).toHaveAccessibleName('Creating file…');
    expect(progressBar()).toHaveAttribute('aria-valuenow', '75');
  });

  it('labels the progress of a single document without a count', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    renderPanel({ documents: [makeDocument('a')] });

    fireEvent.click(screen.getByTestId('download'));

    expect(progressBar()).toHaveAccessibleName('Creating file…');
    expect(progressBar()).toHaveAttribute('aria-valuenow', '0');
  });

  it('downloads the file, confirms it and brings the button back once the bar is full', async (): Promise<void> => {
    const file: Deferred<ExportedFile> = deferred<ExportedFile>();
    vi.mocked(exportDocuments).mockReturnValue(file.promise);
    renderPanel();

    fireEvent.click(screen.getByTestId('download'));
    reportProgress(3, 3);
    file.resolve(FILE);
    await advance(MIN_LOADING_MS);

    expect(downloadFile).toHaveBeenCalledExactlyOnceWith(FILE);
    expect(toasts()).toEqual([
      'success: File downloaded: documents-202611060840.pdf',
    ]);
    expect(progressBar()).toHaveAttribute('aria-valuenow', '100');

    // The bar fills up, stays full for a moment, then gives way to the button
    await advance(3000);
    expect(screen.getByTestId('export-progress')).toHaveClass('is-complete');
    await advance(500);
    expect(screen.queryByTestId('export-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('download')).toBeEnabled();
  });

  it('reports a failed export and brings the button back right away', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockRejectedValue(new Error('encoder crashed'));
    renderPanel();

    fireEvent.click(screen.getByTestId('download'));
    await advance(MIN_LOADING_MS);

    expect(downloadFile).not.toHaveBeenCalled();
    expect(toasts()).toEqual(['error: The file could not be created.']);
    expect(screen.queryByTestId('export-progress')).not.toBeInTheDocument();
    expect(screen.getByTestId('download')).toBeEnabled();
  });

  it('starts a new scan on "New scan"', (): void => {
    const session: Session = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'New scan' }));

    expect(session.restart).toHaveBeenCalledTimes(1);
    expect(session.goTo).not.toHaveBeenCalled();
  });

  it('goes back to the Adjust step', (): void => {
    const session: Session = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(session.goTo).toHaveBeenCalledExactlyOnceWith('enhance');
    expect(session.restart).not.toHaveBeenCalled();
  });

  it('keeps Back and New scan available during the export', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    renderPanel();

    fireEvent.click(screen.getByTestId('download'));

    expect(screen.getByRole('button', { name: 'Back' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'New scan' })).toBeEnabled();
  });
});
