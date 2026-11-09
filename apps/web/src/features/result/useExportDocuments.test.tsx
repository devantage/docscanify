import type { ScannedDocument } from '@devantage/docscanify';
import {
  act,
  renderHook,
  type RenderHookResult,
  screen,
} from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import { renderDocument } from '@/features/documents/renderCache';
import { type Locale, TranslateProvider, useTranslate } from '@/i18n';
import {
  downloadFile,
  exportDocuments,
  type ExportedFile,
  type ExportItem,
} from '@/lib/export';
import { MIN_LOADING_MS } from '@/lib/loading';
import type { DocumentItem, ExportSettings } from '@/lib/types';

import {
  useExportDocuments,
  type UseExportDocumentsResult,
} from './useExportDocuments';

// Encoding and rendering need OpenCV and real images: the hook is tested around them
vi.mock('@/lib/export', (): Record<string, unknown> => ({
  exportDocuments: vi.fn(),
  downloadFile: vi.fn(),
}));
vi.mock('@/features/documents/renderCache', (): Record<string, unknown> => ({
  renderDocument: vi.fn(),
}));

type ExportOptions = Parameters<typeof exportDocuments>[2];

/** The export hook along with a language switch, to export after the user changes language. */
interface LocalizedExport {
  exporter: UseExportDocumentsResult;
  setLocale(locale: Locale): void;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

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
  pageFormat: 'letter',
  margin: 5,
  combine: true,
};

const FILE: ExportedFile = {
  blob: new Blob(['%PDF'], { type: 'application/pdf' }),
  fileName: 'documents-202611060840.pdf',
};

function makeDocument(id: string, name: string): DocumentItem {
  return {
    id,
    source: {
      image: document.createElement('img'),
      url: `blob:${id}`,
      name,
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: null,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  };
}

const DOCUMENTS: DocumentItem[] = [
  makeDocument('a', 'invoice'),
  makeDocument('b', 'receipt'),
  makeDocument('c', 'contract'),
];

function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <TranslateProvider defaultLocale="en">
      <ToastProvider>{children}</ToastProvider>
    </TranslateProvider>
  );
}

function renderExport(): RenderHookResult<UseExportDocumentsResult, unknown> {
  return renderHook(useExportDocuments, { wrapper: Providers });
}

const toasts = (): string[] =>
  screen
    .queryAllByTestId('toast')
    .map(
      (toast: HTMLElement) =>
        `${toast.dataset.kind ?? ''}: ${toast.textContent}`,
    );

/** Starts an export without waiting for it. */
function start(
  hook: RenderHookResult<UseExportDocumentsResult, unknown>,
  documents: DocumentItem[] = DOCUMENTS,
): void {
  act((): void => {
    void hook.result.current.start(documents, SETTINGS);
  });
}

/** Lets the minimum loading duration and any pending promise pass. */
async function finish(): Promise<void> {
  await act(async (): Promise<void> => {
    await vi.advanceTimersByTimeAsync(MIN_LOADING_MS);
  });
}

/** The options the export received, to report progress through them. */
function exportOptions(): ExportOptions {
  const call: Parameters<typeof exportDocuments> | undefined = vi
    .mocked(exportDocuments)
    .mock.calls.at(-1);
  if (!call) throw new Error('exportDocuments was not called');
  return call[2];
}

beforeEach((): void => {
  // The module mocks keep their implementations between tests otherwise
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation((): void => undefined);
});

afterEach((): void => {
  vi.useRealTimers();
});

describe('useExportDocuments', (): void => {
  it('has no progress before an export', (): void => {
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    expect(hook.result.current.progress).toBeNull();
  });

  it('shows the progress from zero as soon as the export starts', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);

    expect(hook.result.current.progress).toEqual({
      done: 0,
      total: 3,
      finished: false,
    });
  });

  it('exports the documents in list order, named after their images, with the chosen options', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValue(FILE);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);
    await finish();

    expect(exportDocuments).toHaveBeenCalledTimes(1);
    const [items, settings, options] = vi.mocked(exportDocuments).mock.calls[0];
    expect(items.map((item: ExportItem) => item.name)).toEqual([
      'invoice',
      'receipt',
      'contract',
    ]);
    expect(settings).toEqual(SETTINGS);
    // A ZIP of several documents is named in the current language
    expect(options.batchName).toBe('documents');
  });

  it('names a ZIP of several documents in the language chosen by the user', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValue(FILE);
    const hook: RenderHookResult<LocalizedExport, unknown> = renderHook(
      (): LocalizedExport => ({
        exporter: useExportDocuments(),
        setLocale: useTranslate().setLocale,
      }),
      { wrapper: Providers },
    );

    act((): void => {
      hook.result.current.setLocale('pt-BR');
    });
    act((): void => {
      void hook.result.current.exporter.start(DOCUMENTS, SETTINGS);
    });
    await finish();

    expect(exportOptions().batchName).toBe('documentos');
    expect(toasts()).toEqual([
      'success: Arquivo baixado: documents-202611060840.pdf',
    ]);
  });

  it('renders each document only when the export asks for it, reusing the render cache', async (): Promise<void> => {
    const png: Uint8Array = new Uint8Array([1, 2, 3]);
    vi.mocked(renderDocument).mockResolvedValue(png);
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);
    expect(renderDocument).not.toHaveBeenCalled();

    const items: ExportItem[] = vi.mocked(exportDocuments).mock.calls[0][0];
    await expect(items[1].render()).resolves.toBe(png);
    expect(renderDocument).toHaveBeenCalledExactlyOnceWith(DOCUMENTS[1]);
  });

  it('follows the progress reported by the export', (): void => {
    vi.mocked(exportDocuments).mockReturnValue(
      deferred<ExportedFile>().promise,
    );
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();
    start(hook);

    act((): void => {
      exportOptions().onProgress?.(1, 3);
    });
    expect(hook.result.current.progress).toEqual({
      done: 1,
      total: 3,
      finished: false,
    });

    act((): void => {
      exportOptions().onProgress?.(3, 3);
    });
    expect(hook.result.current.progress).toEqual({
      done: 3,
      total: 3,
      finished: false,
    });
  });

  it('downloads the file, confirms it by name and marks the progress finished', async (): Promise<void> => {
    const file: Deferred<ExportedFile> = deferred<ExportedFile>();
    vi.mocked(exportDocuments).mockReturnValue(file.promise);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();
    start(hook);
    act((): void => {
      exportOptions().onProgress?.(3, 3);
    });

    file.resolve(FILE);
    await finish();

    expect(downloadFile).toHaveBeenCalledExactlyOnceWith(FILE);
    expect(toasts()).toEqual([
      'success: File downloaded: documents-202611060840.pdf',
    ]);
    expect(hook.result.current.progress).toEqual({
      done: 3,
      total: 3,
      finished: true,
    });
  });

  it('lasts at least the minimum loading duration, even when the export is instant', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValue(FILE);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();
    start(hook);

    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(MIN_LOADING_MS - 1);
    });
    expect(downloadFile).not.toHaveBeenCalled();
    expect(hook.result.current.progress?.finished).toBe(false);

    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(downloadFile).toHaveBeenCalledTimes(1);
    expect(hook.result.current.progress?.finished).toBe(true);
  });

  it('keeps the finished progress until it is dismissed', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValue(FILE);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();
    start(hook);
    await finish();

    await act(async (): Promise<void> => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(hook.result.current.progress?.finished).toBe(true);

    act((): void => {
      hook.result.current.dismissProgress();
    });
    expect(hook.result.current.progress).toBeNull();
  });

  it('reports a failed export, hides the progress and downloads nothing', async (): Promise<void> => {
    const error: Error = new Error('encoder crashed');
    vi.mocked(exportDocuments).mockRejectedValue(error);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);
    await finish();

    expect(downloadFile).not.toHaveBeenCalled();
    expect(toasts()).toEqual(['error: The file could not be created.']);
    expect(hook.result.current.progress).toBeNull();
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('reports a failed download like a failed export', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValue(FILE);
    vi.mocked(downloadFile).mockImplementation((): void => {
      throw new Error('blocked');
    });
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);
    await finish();

    expect(toasts()).toEqual(['error: The file could not be created.']);
    expect(hook.result.current.progress).toBeNull();
  });

  it('removes the notice of the previous export when a new one starts', async (): Promise<void> => {
    vi.mocked(exportDocuments).mockResolvedValueOnce(FILE);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();
    start(hook);
    await finish();
    expect(toasts()).toHaveLength(1);

    vi.mocked(exportDocuments).mockReturnValueOnce(
      deferred<ExportedFile>().promise,
    );
    start(hook, DOCUMENTS.slice(0, 1));

    expect(toasts()).toEqual([]);
    expect(hook.result.current.progress).toEqual({
      done: 0,
      total: 1,
      finished: false,
    });
  });

  it('replaces the notice of a failed export with the one of the next export', async (): Promise<void> => {
    vi.mocked(exportDocuments)
      .mockRejectedValueOnce(new Error('first'))
      .mockResolvedValueOnce(FILE);
    const hook: RenderHookResult<UseExportDocumentsResult, unknown> =
      renderExport();

    start(hook);
    await finish();
    start(hook);
    await finish();

    expect(toasts()).toEqual([
      'success: File downloaded: documents-202611060840.pdf',
    ]);
  });
});
