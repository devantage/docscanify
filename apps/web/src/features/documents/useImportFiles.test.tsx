import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TranslateProvider } from '@/i18n';
import { MESSAGES } from '@/i18n/config';
import { createTranslate, type TranslateFunction } from '@/i18n/translate';
import { sourceFromFile } from '@/lib/image';
import type { DocumentItem, EnhanceOptions, SourceImage } from '@/lib/types';

import { type CropState, detectCrop } from './detectCrop';
import {
  describeImport,
  describeProgress,
  type ImportProgress,
  type ImportResult,
  useImportFiles,
  type UseImportFilesResult,
} from './useImportFiles';

/** Switches the loading helpers between instant (most tests) and their real timing. */
const loading: { real: boolean } = vi.hoisted(() => ({ real: false }));

vi.mock('@/lib/loading', async (importOriginal: () => Promise<unknown>) => {
  const actual: typeof import('@/lib/loading') =
    (await importOriginal()) as typeof import('@/lib/loading');
  return {
    ...actual,
    waitForPaint: async (): Promise<void> =>
      loading.real ? actual.waitForPaint() : Promise.resolve(),
    withMinDuration: async <T,>(work: () => Promise<T>): Promise<T> =>
      loading.real ? actual.withMinDuration(work) : work(),
  };
});
vi.mock('@/lib/image', () => ({ sourceFromFile: vi.fn() }));
vi.mock('@/lib/scan', () => ({
  NO_ENHANCEMENTS: {
    filter: 'none',
    turns: 0,
    sharpen: 'off',
  },
}));
vi.mock('./detectCrop', () => ({ detectCrop: vi.fn() }));

const NO_ENHANCEMENTS: EnhanceOptions = {
  filter: 'none',
  turns: 0,
  sharpen: 'off',
};

const t: TranslateFunction = createTranslate('en', MESSAGES.en, MESSAGES.en);

/** Corners of a `size` × `size` square at the origin. */
const square = (size: number): Corners => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: size, y: 0 },
  bottomRight: { x: size, y: size },
  bottomLeft: { x: 0, y: size },
});

/** A tiny PNG file with this name, as chosen by the user. */
const file = (name: string): File =>
  new File(['x'], name, { type: 'image/png' });

/** The source image the mocked `sourceFromFile` opens from a file, named without the extension. */
const sourceOf = (f: File): SourceImage => ({
  image: new Image(),
  url: `blob:${f.name}`,
  name: f.name.replace(/\.[^.]+$/, ''),
  scannedDocument: {} as ScannedDocument,
});

/** Corners whose size identifies the image they were detected in. */
const cropOf = (source: SourceImage): CropState => ({
  corners: square(source.name.length),
  valid: true,
  detectorFailed: false,
});

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

/** A promise the test settles by hand, to hold an import at a given file and phase. */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>(
    (res: (value: T) => void, rej: (reason: unknown) => void) => {
      resolve = res;
      reject = rej;
    },
  );
  return { promise, resolve, reject };
}

/** Wraps the hook in the translation provider, for the default file name. */
const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <TranslateProvider>{children}</TranslateProvider>
);

type Hook = RenderHookResult<UseImportFilesResult, unknown>;

/** Renders the hook with no import running and no progress. */
const renderImport = (): Hook =>
  renderHook(() => useImportFiles(), { wrapper });

/** Lets the pending promises of the import settle. */
const flush = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('describeProgress', (): void => {
  it('describes a single image without counting', (): void => {
    expect(
      describeProgress({ phase: 'opening', current: 1, total: 1, value: 0 }, t),
    ).toBe('Uploading the image…');
    expect(
      describeProgress(
        { phase: 'detecting', current: 1, total: 1, value: 0.3 },
        t,
      ),
    ).toBe('Finding the document in the image…');
  });

  it('counts the images when there are several', (): void => {
    expect(
      describeProgress(
        { phase: 'opening', current: 2, total: 3, value: 0.4 },
        t,
      ),
    ).toBe('Uploading image 2 of 3…');
    expect(
      describeProgress(
        { phase: 'detecting', current: 3, total: 3, value: 0.7 },
        t,
      ),
    ).toBe('Finding the document in image 3 of 3…');
  });
});

describe('describeImport', (): void => {
  const doc: DocumentItem = {
    id: '1',
    source: sourceOf(file('a.png')),
    corners: square(1),
    valid: true,
    detectorFailed: false,
    options: NO_ENHANCEMENTS,
  };

  it('reports an error when the only file could not be opened', (): void => {
    expect(describeImport({ added: [], failed: 1, total: 1 }, t)).toEqual({
      kind: 'error',
      message:
        'This file could not be opened. Upload a JPG, PNG, or WebP image.',
    });
  });

  it('reports an error counting the files when none could be opened', (): void => {
    expect(describeImport({ added: [], failed: 4, total: 4 }, t)).toEqual({
      kind: 'error',
      message:
        'None of the 4 files could be opened. Upload JPG, PNG, or WebP images.',
    });
  });

  it('warns how many files failed when some were imported', (): void => {
    expect(describeImport({ added: [doc], failed: 1, total: 2 }, t)).toEqual({
      kind: 'warning',
      message: '1 file could not be opened.',
    });
    expect(describeImport({ added: [doc], failed: 2, total: 3 }, t)).toEqual({
      kind: 'warning',
      message: '2 files could not be opened.',
    });
  });

  it('has nothing to say when every file was imported', (): void => {
    expect(describeImport({ added: [doc], failed: 0, total: 1 }, t)).toBeNull();
  });
});

describe('useImportFiles', (): void => {
  beforeEach((): void => {
    loading.real = false;
    vi.mocked(sourceFromFile).mockImplementation(async (f: File) =>
      Promise.resolve(sourceOf(f)),
    );
    vi.mocked(detectCrop).mockImplementation(async (source: SourceImage) =>
      Promise.resolve(cropOf(source)),
    );
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.mocked(sourceFromFile).mockReset();
    vi.mocked(detectCrop).mockReset();
  });

  it('starts with no progress', (): void => {
    const { result } = renderImport();

    expect(result.current.progress).toBeNull();
  });

  it('creates one document per file, in the order the files were received', async (): Promise<void> => {
    const { result } = renderImport();
    const files: File[] = [
      file('first.png'),
      file('second.jpg'),
      file('c.webp'),
    ];
    let outcome: ImportResult | null = null;

    await act(async () => {
      outcome = await result.current.importFiles(files);
    });

    expect(outcome).toEqual({
      added: [
        {
          id: '1',
          source: sourceOf(files[0]),
          ...cropOf(sourceOf(files[0])),
          options: NO_ENHANCEMENTS,
        },
        {
          id: '2',
          source: sourceOf(files[1]),
          ...cropOf(sourceOf(files[1])),
          options: NO_ENHANCEMENTS,
        },
        {
          id: '3',
          source: sourceOf(files[2]),
          ...cropOf(sourceOf(files[2])),
          options: NO_ENHANCEMENTS,
        },
      ],
      failed: 0,
      total: 3,
    });
  });

  it('opens each file with "document" as the fallback name', async (): Promise<void> => {
    const { result } = renderImport();
    const files: File[] = [file('a.png'), file('b.png')];

    await act(async () => {
      await result.current.importFiles(files);
    });

    expect(vi.mocked(sourceFromFile).mock.calls).toEqual([
      [files[0], 'document'],
      [files[1], 'document'],
    ]);
  });

  it('keeps ids unique across imports', async (): Promise<void> => {
    const { result } = renderImport();
    let first: ImportResult | null = null;
    let second: ImportResult | null = null;

    await act(async () => {
      first = await result.current.importFiles([file('a.png'), file('b.png')]);
    });
    await act(async () => {
      second = await result.current.importFiles([file('c.png')]);
    });

    const idsOf = (r: ImportResult | null): string[] =>
      (r?.added ?? []).map((d: DocumentItem) => d.id);
    expect([...idsOf(first), ...idsOf(second)]).toEqual(['1', '2', '3']);
  });

  it('skips the files that cannot be opened and counts them', async (): Promise<void> => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(sourceFromFile).mockImplementation(async (f: File) =>
      f.name.startsWith('bad')
        ? Promise.reject(new Error(`Could not open ${f.name}`))
        : Promise.resolve(sourceOf(f)),
    );
    const { result } = renderImport();
    let outcome: ImportResult | null = null;

    await act(async () => {
      outcome = await result.current.importFiles([
        file('bad1.png'),
        file('good.png'),
        file('bad2.png'),
        file('fine.png'),
      ]);
    });

    expect(outcome).toMatchObject({ failed: 2, total: 4 });
    expect(
      (outcome as ImportResult | null)?.added.map(
        (d: DocumentItem) => d.source.name,
      ),
    ).toEqual(['good', 'fine']);
    // Only the opened images go through detection
    expect(detectCrop).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(2);
  });

  it('returns an empty result when no file can be opened', async (): Promise<void> => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(sourceFromFile).mockRejectedValue(new Error('unreadable'));
    const { result } = renderImport();
    let outcome: ImportResult | null = null;

    await act(async () => {
      outcome = await result.current.importFiles([
        file('a.txt'),
        file('b.txt'),
      ]);
    });

    expect(outcome).toEqual({ added: [], failed: 2, total: 2 });
  });

  it('reports each phase of each file, then the end of the import', async (): Promise<void> => {
    const opened: Deferred<SourceImage>[] = [deferred(), deferred()];
    const detected: Deferred<CropState>[] = [deferred(), deferred()];
    vi.mocked(sourceFromFile)
      .mockReturnValueOnce(opened[0].promise)
      .mockReturnValueOnce(opened[1].promise);
    vi.mocked(detectCrop)
      .mockReturnValueOnce(detected[0].promise)
      .mockReturnValueOnce(detected[1].promise);
    const files: File[] = [file('a.png'), file('b.png')];
    const { result } = renderImport();
    const progress = (): ImportProgress | null => result.current.progress;
    // Two files: opening and detecting each, plus the end, in 5 steps
    let done: Promise<ImportResult | null> = Promise.resolve(null);

    act(() => {
      done = result.current.importFiles(files);
    });
    expect(progress()).toEqual({
      phase: 'opening',
      current: 1,
      total: 2,
      value: 0,
    });

    await act(async () => {
      opened[0].resolve(sourceOf(files[0]));
      await Promise.resolve();
    });
    await flush();
    expect(progress()).toEqual({
      phase: 'detecting',
      current: 1,
      total: 2,
      value: 1 / 5,
    });

    await act(async () => {
      detected[0].resolve(cropOf(sourceOf(files[0])));
      await Promise.resolve();
    });
    await flush();
    expect(progress()).toEqual({
      phase: 'opening',
      current: 2,
      total: 2,
      value: 2 / 5,
    });

    await act(async () => {
      opened[1].resolve(sourceOf(files[1]));
      await Promise.resolve();
    });
    await flush();
    expect(progress()).toEqual({
      phase: 'detecting',
      current: 2,
      total: 2,
      value: 3 / 5,
    });

    await act(async () => {
      detected[1].resolve(cropOf(sourceOf(files[1])));
      await done;
    });
    // Finished: the bar stays full until it is dismissed
    expect(progress()).toEqual({
      phase: 'detecting',
      current: 2,
      total: 2,
      value: 1,
    });
  });

  it('keeps the finished progress until it is dismissed', async (): Promise<void> => {
    const { result } = renderImport();

    await act(async () => {
      await result.current.importFiles([file('a.png')]);
    });
    expect(result.current.progress?.value).toBe(1);

    act(() => {
      result.current.dismissProgress();
    });
    expect(result.current.progress).toBeNull();
  });

  it('ignores an empty list of files', async (): Promise<void> => {
    const { result } = renderImport();
    let outcome: ImportResult | null | undefined;

    await act(async () => {
      outcome = await result.current.importFiles([]);
    });

    expect(outcome).toBeNull();
    expect(result.current.progress).toBeNull();
    expect(sourceFromFile).not.toHaveBeenCalled();
  });

  it('ignores a second import while one is running, and accepts one after it ends', async (): Promise<void> => {
    const opened: Deferred<SourceImage> = deferred();
    vi.mocked(sourceFromFile).mockReturnValueOnce(opened.promise);
    const { result } = renderImport();
    let first: Promise<ImportResult | null> = Promise.resolve(null);
    let second: ImportResult | null | undefined;

    act(() => {
      first = result.current.importFiles([file('a.png')]);
    });
    await act(async () => {
      second = await result.current.importFiles([file('b.png')]);
    });
    expect(second).toBeNull();
    expect(sourceFromFile).toHaveBeenCalledTimes(1);

    await act(async () => {
      opened.resolve(sourceOf(file('a.png')));
      await first;
    });
    let third: ImportResult | null = null;
    await act(async () => {
      third = await result.current.importFiles([file('c.png')]);
    });
    expect(
      (third as ImportResult | null)?.added.map(
        (d: DocumentItem) => d.source.name,
      ),
    ).toEqual(['c']);
  });

  it('hides the progress and rethrows when the import breaks, and can import again', async (): Promise<void> => {
    const failure: Error = new Error('detector crashed');
    vi.mocked(detectCrop).mockRejectedValueOnce(failure);
    const { result } = renderImport();

    await act(async () => {
      await expect(result.current.importFiles([file('a.png')])).rejects.toBe(
        failure,
      );
    });
    expect(result.current.progress).toBeNull();

    let outcome: ImportResult | null = null;
    await act(async () => {
      outcome = await result.current.importFiles([file('b.png')]);
    });
    expect((outcome as ImportResult | null)?.added).toHaveLength(1);
  });

  it('keeps the loading state for at least the minimum duration, after the bar is painted', async (): Promise<void> => {
    loading.real = true;
    vi.useFakeTimers();
    const { result } = renderImport();
    let settled: boolean = false;

    act(() => {
      void result.current.importFiles([file('a.png')]).then(() => {
        settled = true;
      });
    });
    // Paint delay (30 ms) before the minimum duration starts, then two more paints per file
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1029);
    });
    expect(settled).toBe(false);
    expect(result.current.progress?.value).toBe(2 / 3);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(settled).toBe(true);
    expect(result.current.progress?.value).toBe(1);
  });
});
