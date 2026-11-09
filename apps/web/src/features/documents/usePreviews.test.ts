import type { Corners, ScannedDocument } from '@devantage/docscanify';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { thumbnailFrom, thumbnailFromPng } from '@/lib/image';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { hasRender, renderDocument } from './renderCache';
import {
  type CurrentRender,
  type Preview,
  previewKey,
  type PreviewMode,
  usePreviews,
} from './usePreviews';

/** Minimum pending duration: 0 in most tests, so thumbnails land right away. */
const loading: { min: number } = vi.hoisted(() => ({ min: 0 }));

vi.mock('@/lib/loading', () => ({
  get MIN_LOADING_MS(): number {
    return loading.min;
  },
  waitForPaint: async (): Promise<void> => Promise.resolve(),
}));
vi.mock('@/lib/image', () => ({
  thumbnailFrom: vi.fn(),
  thumbnailFromPng: vi.fn(),
}));
vi.mock('@/lib/scan', () => ({
  NO_ENHANCEMENTS: {
    filter: 'none',
    turns: 0,
    sharpen: 'off',
    denoise: false,
  },
}));
vi.mock('./renderCache', () => ({
  hasRender: vi.fn(),
  renderDocument: vi.fn(),
}));

const NO_ENHANCEMENTS: EnhanceOptions = {
  filter: 'none',
  turns: 0,
  sharpen: 'off',
  denoise: false,
};
const BW: EnhanceOptions = { ...NO_ENHANCEMENTS, filter: 'bw' };

const square = (size: number): Corners => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: size, y: 0 },
  bottomRight: { x: size, y: size },
  bottomLeft: { x: 0, y: size },
});

function makeDoc(id: string, patch: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id,
    source: {
      image: new Image(),
      url: `blob:${id}`,
      name: id,
      scannedDocument: {} as ScannedDocument,
    },
    corners: square(10),
    valid: true,
    detectorFailed: false,
    options: NO_ENHANCEMENTS,
    ...patch,
  };
}

/** The thumbnail URL the mocks produce for a document rendered with these adjustments. */
const thumb = (doc: DocumentItem, options: EnhanceOptions): string =>
  `thumb:${doc.id}:${String(doc.corners?.topRight.x)}:${options.filter}`;

const encoder: TextEncoder = new TextEncoder();
const decoder: TextDecoder = new TextDecoder();

type PreviewOptions = Parameters<typeof usePreviews>[2];

interface Props {
  documents: DocumentItem[];
  mode: PreviewMode | null;
  options: PreviewOptions;
}

type Hook = RenderHookResult<Record<string, Preview>, Props>;

const renderPreviews = (props: Props): Hook =>
  renderHook(
    ({ documents, mode, options }: Props) =>
      usePreviews(documents, mode, options),
    { initialProps: props },
  );

/** The documents rendered in the background, in order, as `id:filter`. */
const renderCalls = (): string[] =>
  vi
    .mocked(renderDocument)
    .mock.calls.map(
      ([doc, options]: [DocumentItem, EnhanceOptions?]) =>
        `${doc.id}:${String(options?.filter)}`,
    );

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>((r: (value: T) => void) => {
    resolve = r;
  });
  return { promise, resolve };
}

/** Lets pending promises and zero-delay timers run. */
const settle = async (): Promise<void> => {
  await act(async () => {
    await new Promise<void>((resolve: () => void) => setTimeout(resolve, 5));
  });
};

describe('previewKey', (): void => {
  it('only depends on the corners in crop mode', (): void => {
    const doc: DocumentItem = makeDoc('a');

    expect(previewKey('crop', { ...doc, options: BW })).toBe(
      previewKey('crop', doc),
    );
    expect(previewKey('crop', { ...doc, corners: square(20) })).not.toBe(
      previewKey('crop', doc),
    );
  });

  it('depends on the corners and the adjustments in enhance mode', (): void => {
    const doc: DocumentItem = makeDoc('a');

    expect(previewKey('enhance', { ...doc, options: BW })).not.toBe(
      previewKey('enhance', doc),
    );
    expect(previewKey('enhance', { ...doc, corners: square(20) })).not.toBe(
      previewKey('enhance', doc),
    );
  });
});

describe('usePreviews', (): void => {
  beforeEach((): void => {
    loading.min = 0;
    vi.mocked(hasRender).mockReturnValue(false);
    vi.mocked(renderDocument).mockImplementation(
      async (doc: DocumentItem, options: EnhanceOptions = doc.options) =>
        Promise.resolve(encoder.encode(thumb(doc, options))),
    );
    vi.mocked(thumbnailFromPng).mockImplementation(async (png: Uint8Array) =>
      Promise.resolve(decoder.decode(png)),
    );
  });

  afterEach((): void => {
    vi.useRealTimers();
    vi.mocked(hasRender).mockReset();
    vi.mocked(renderDocument).mockReset();
    vi.mocked(thumbnailFromPng).mockReset();
    vi.mocked(thumbnailFrom).mockReset();
  });

  it('returns no thumbnails and renders nothing without a mode', async (): Promise<void> => {
    const { result } = renderPreviews({
      documents: [makeDoc('a')],
      mode: null,
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(result.current).toEqual({});
    expect(renderDocument).not.toHaveBeenCalled();
  });

  it('renders every document cropped only in crop mode, the one on display first', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a', { options: BW });
    const b: DocumentItem = makeDoc('b');
    const c: DocumentItem = makeDoc('c');
    const { result } = renderPreviews({
      documents: [a, b, c],
      mode: 'crop',
      options: { activeId: 'b', paused: false },
    });

    await waitFor((): void => {
      expect(result.current).toEqual({
        a: { url: thumb(a, NO_ENHANCEMENTS), pending: false },
        b: { url: thumb(b, NO_ENHANCEMENTS), pending: false },
        c: { url: thumb(c, NO_ENHANCEMENTS), pending: false },
      });
    });
    // The adjustments of `a` are not applied in the Crop step
    expect(renderCalls()).toEqual(['b:none', 'a:none', 'c:none']);
  });

  it('shows the documents as pending until their thumbnails are ready', async (): Promise<void> => {
    const pending: Deferred<Uint8Array> = deferred();
    vi.mocked(renderDocument).mockReturnValueOnce(pending.promise);
    const a: DocumentItem = makeDoc('a');
    const { result } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(result.current).toEqual({ a: { url: null, pending: true } });

    pending.resolve(encoder.encode('ready'));
    await waitFor((): void => {
      expect(result.current).toEqual({ a: { url: 'ready', pending: false } });
    });
  });

  it('renders one thumbnail at a time', async (): Promise<void> => {
    const first: Deferred<Uint8Array> = deferred();
    vi.mocked(renderDocument).mockReturnValueOnce(first.promise);
    const { result } = renderPreviews({
      documents: [makeDoc('a'), makeDoc('b')],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(renderCalls()).toEqual(['a:none']);

    first.resolve(encoder.encode('first'));
    await waitFor((): void => {
      expect(result.current.b.pending).toBe(false);
    });
    expect(renderCalls()).toEqual(['a:none', 'b:none']);
  });

  it('has no thumbnail and never renders documents without a valid crop', async (): Promise<void> => {
    const ok: DocumentItem = makeDoc('ok');
    const { result } = renderPreviews({
      documents: [
        makeDoc('crossed', { valid: false }),
        makeDoc('undetected', {
          corners: null,
          valid: false,
          detectorFailed: true,
        }),
        ok,
      ],
      mode: 'crop',
      options: { activeId: 'crossed', paused: false },
    });

    await waitFor((): void => {
      expect(result.current.ok.url).toBe(thumb(ok, NO_ENHANCEMENTS));
    });
    expect(result.current.crossed).toEqual({ url: null, pending: false });
    expect(result.current.undetected).toEqual({ url: null, pending: false });
    expect(renderCalls()).toEqual(['ok:none']);
  });

  it('generates nothing while paused, and resumes when unpaused', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const documents: DocumentItem[] = [a];
    const { result, rerender } = renderPreviews({
      documents,
      mode: 'crop',
      options: { activeId: 'a', paused: true },
    });
    await settle();

    expect(renderDocument).not.toHaveBeenCalled();
    expect(result.current.a).toEqual({ url: null, pending: true });

    rerender({
      documents,
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: false,
      });
    });
  });

  it('renders the documents with their adjustments in enhance mode, except the one on display', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a', { options: BW });
    const b: DocumentItem = makeDoc('b', {
      options: { ...NO_ENHANCEMENTS, filter: 'grayscale' },
    });
    const { result } = renderPreviews({
      documents: [a, b],
      mode: 'enhance',
      options: { activeId: 'a', paused: false },
    });

    await waitFor((): void => {
      expect(result.current.b).toEqual({
        url: thumb(b, b.options),
        pending: false,
      });
    });
    expect(renderCalls()).toEqual(['b:grayscale']);
    // The document on display waits for the main preview
    expect(result.current.a).toEqual({ url: null, pending: true });
  });

  it('uses the main preview as the thumbnail of the document on display', async (): Promise<void> => {
    const canvas: HTMLCanvasElement = document.createElement('canvas');
    vi.mocked(thumbnailFrom).mockResolvedValue('from-canvas');
    const a: DocumentItem = makeDoc('a', { options: BW });
    const current: CurrentRender = {
      id: 'a',
      key: previewKey('enhance', a),
      canvas,
    };
    const { result } = renderPreviews({
      documents: [a],
      mode: 'enhance',
      options: { activeId: 'a', current, paused: false },
    });

    await waitFor((): void => {
      expect(result.current.a).toEqual({ url: 'from-canvas', pending: false });
    });
    expect(thumbnailFrom).toHaveBeenCalledWith(canvas);
    expect(renderDocument).not.toHaveBeenCalled();
  });

  it('keeps the previous thumbnail when the main preview failed', async (): Promise<void> => {
    vi.mocked(thumbnailFrom).mockResolvedValue('first');
    const a: DocumentItem = makeDoc('a');
    const documents: DocumentItem[] = [a];
    const { result, rerender } = renderPreviews({
      documents,
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: {
          id: 'a',
          key: previewKey('enhance', a),
          canvas: document.createElement('canvas'),
        },
        paused: false,
      },
    });
    await waitFor((): void => {
      expect(result.current.a.url).toBe('first');
    });

    const edited: DocumentItem = { ...a, options: BW };
    rerender({
      documents: [edited],
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: { id: 'a', key: previewKey('enhance', edited), canvas: null },
        paused: false,
      },
    });

    await waitFor((): void => {
      expect(result.current.a).toEqual({ url: 'first', pending: false });
    });
    // A failed render has no canvas to scale down
    expect(thumbnailFrom).toHaveBeenCalledTimes(1);
  });

  it('does not scale the main preview down again when it is redrawn with the same crop and adjustments', async (): Promise<void> => {
    vi.mocked(thumbnailFrom).mockResolvedValue('from-canvas');
    const a: DocumentItem = makeDoc('a', { options: BW });
    const key: string = previewKey('enhance', a);
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: { id: 'a', key, canvas: document.createElement('canvas') },
        paused: false,
      },
    });
    await waitFor((): void => {
      expect(result.current.a).toEqual({ url: 'from-canvas', pending: false });
    });

    rerender({
      documents: [a],
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: { id: 'a', key, canvas: document.createElement('canvas') },
        paused: false,
      },
    });
    await settle();

    expect(thumbnailFrom).toHaveBeenCalledTimes(1);
    expect(result.current.a).toEqual({ url: 'from-canvas', pending: false });
  });

  it('ignores the main preview in crop mode', async (): Promise<void> => {
    vi.mocked(thumbnailFrom).mockResolvedValue('from-canvas');
    const a: DocumentItem = makeDoc('a');
    const { result } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: {
        activeId: 'a',
        current: {
          id: 'a',
          key: previewKey('enhance', a),
          canvas: document.createElement('canvas'),
        },
        paused: false,
      },
    });

    await waitFor((): void => {
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: false,
      });
    });
    expect(thumbnailFrom).not.toHaveBeenCalled();
  });

  it('ignores a main preview result that is no longer current', async (): Promise<void> => {
    const older: Deferred<string> = deferred();
    const newer: Deferred<string> = deferred();
    vi.mocked(thumbnailFrom)
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const a: DocumentItem = makeDoc('a');
    const edited: DocumentItem = { ...a, options: BW };
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: {
          id: 'a',
          key: previewKey('enhance', a),
          canvas: document.createElement('canvas'),
        },
        paused: false,
      },
    });
    rerender({
      documents: [edited],
      mode: 'enhance',
      options: {
        activeId: 'a',
        current: {
          id: 'a',
          key: previewKey('enhance', edited),
          canvas: document.createElement('canvas'),
        },
        paused: false,
      },
    });

    newer.resolve('newer');
    await waitFor((): void => {
      expect(result.current.a).toEqual({ url: 'newer', pending: false });
    });
    older.resolve('older');
    await settle();

    expect(result.current.a).toEqual({ url: 'newer', pending: false });
  });

  it('regenerates a thumbnail when the crop changes, showing the previous one meanwhile', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.a.url).toBe(thumb(a, NO_ENHANCEMENTS));
    });
    const next: Deferred<Uint8Array> = deferred();
    vi.mocked(renderDocument).mockReturnValueOnce(next.promise);

    const moved: DocumentItem = { ...a, corners: square(30) };
    rerender({
      documents: [moved],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(result.current.a).toEqual({
      url: thumb(a, NO_ENHANCEMENTS),
      pending: true,
    });

    next.resolve(encoder.encode(thumb(moved, NO_ENHANCEMENTS)));
    await waitFor((): void => {
      expect(result.current.a).toEqual({
        url: thumb(moved, NO_ENHANCEMENTS),
        pending: false,
      });
    });
  });

  it('does not regenerate a thumbnail when only the adjustments change in crop mode', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.a.pending).toBe(false);
    });

    rerender({
      documents: [{ ...a, options: BW }],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(renderDocument).toHaveBeenCalledTimes(1);
    expect(result.current.a.pending).toBe(false);
  });

  it('renders again with the new crop when the document changes during its render', async (): Promise<void> => {
    const first: Deferred<Uint8Array> = deferred();
    vi.mocked(renderDocument).mockReturnValueOnce(first.promise);
    const a: DocumentItem = makeDoc('a');
    const moved: DocumentItem = { ...a, corners: square(40) };
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();
    rerender({
      documents: [moved],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });

    first.resolve(encoder.encode(thumb(a, NO_ENHANCEMENTS)));

    await waitFor((): void => {
      expect(result.current.a).toEqual({
        url: thumb(moved, NO_ENHANCEMENTS),
        pending: false,
      });
    });
    expect(renderDocument).toHaveBeenCalledTimes(2);
    expect(vi.mocked(renderDocument).mock.calls[1][0]).toBe(moved);
  });

  it('shows no loading state when the render is already cached', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const { result, rerender } = renderPreviews({
      documents: [a],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.a.pending).toBe(false);
    });
    vi.mocked(hasRender).mockReturnValue(true);
    const scaling: Deferred<Uint8Array> = deferred();
    vi.mocked(renderDocument).mockReturnValueOnce(scaling.promise);

    const moved: DocumentItem = { ...a, corners: square(50) };
    rerender({
      documents: [moved],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(result.current.a).toEqual({
      url: thumb(a, NO_ENHANCEMENTS),
      pending: false,
    });
    scaling.resolve(encoder.encode(thumb(moved, NO_ENHANCEMENTS)));
    await waitFor((): void => {
      expect(result.current.a.url).toBe(thumb(moved, NO_ENHANCEMENTS));
    });
  });

  it('does not show the document being edited as pending', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const b: DocumentItem = makeDoc('b');
    const { result } = renderPreviews({
      documents: [a, b],
      mode: 'crop',
      options: { activeId: 'a', paused: true, holdId: 'a' },
    });
    await settle();

    expect(result.current.a).toEqual({ url: null, pending: false });
    expect(result.current.b).toEqual({ url: null, pending: true });
  });

  it('keeps the thumbnails of each mode, so going back to a step does not render again', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a', { options: BW });
    const b: DocumentItem = makeDoc('b', { options: BW });
    const documents: DocumentItem[] = [a, b];
    const { result, rerender } = renderPreviews({
      documents,
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.b.url).toBe(thumb(b, NO_ENHANCEMENTS));
    });

    rerender({
      documents,
      mode: 'enhance',
      options: { activeId: 'a', paused: false },
    });
    await waitFor((): void => {
      expect(result.current.b.url).toBe(thumb(b, BW));
    });

    rerender({
      documents,
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });
    await settle();

    expect(result.current).toEqual({
      a: { url: thumb(a, NO_ENHANCEMENTS), pending: false },
      b: { url: thumb(b, NO_ENHANCEMENTS), pending: false },
    });
    expect(renderCalls()).toEqual(['a:none', 'b:none', 'b:bw']);
  });

  it('keeps going after a failed render, leaving that document without a thumbnail', async (): Promise<void> => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const failure: Error = new Error('render failed');
    vi.mocked(renderDocument).mockRejectedValueOnce(failure);
    const b: DocumentItem = makeDoc('b');
    const { result } = renderPreviews({
      documents: [makeDoc('a'), b],
      mode: 'crop',
      options: { activeId: 'a', paused: false },
    });

    await waitFor((): void => {
      expect(result.current).toEqual({
        a: { url: null, pending: false },
        b: { url: thumb(b, NO_ENHANCEMENTS), pending: false },
      });
    });
    expect(console.error).toHaveBeenCalledWith(failure);
  });

  describe('minimum pending duration', (): void => {
    beforeEach((): void => {
      loading.min = 1000;
      vi.useFakeTimers({
        toFake: ['setTimeout', 'clearTimeout', 'performance'],
      });
      // The page has been open for a while, as when documents are on screen
      vi.advanceTimersByTime(60_000);
    });

    const advance = async (ms: number): Promise<void> => {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ms);
      });
    };

    it('keeps a new render pending for at least the minimum duration', async (): Promise<void> => {
      const a: DocumentItem = makeDoc('a');
      const { result } = renderPreviews({
        documents: [a],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });

      await advance(999);
      expect(result.current.a).toEqual({ url: null, pending: true });

      await advance(1);
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: false,
      });
    });

    it('starts the minimum duration of the document being edited only when the edit ends', async (): Promise<void> => {
      const a: DocumentItem = makeDoc('a');
      const { result, rerender } = renderPreviews({
        documents: [a],
        mode: 'crop',
        options: { activeId: 'a', paused: true, holdId: 'a' },
      });
      await advance(5000);

      rerender({
        documents: [a],
        mode: 'crop',
        options: { activeId: 'a', paused: false, holdId: null },
      });
      await advance(999);
      expect(result.current.a).toEqual({ url: null, pending: true });

      await advance(1);
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: false,
      });
    });

    it('keeps the minimum duration for a crop that changed while the previous one rendered', async (): Promise<void> => {
      const first: Deferred<Uint8Array> = deferred();
      vi.mocked(renderDocument).mockReturnValueOnce(first.promise);
      const a: DocumentItem = makeDoc('a');
      const moved: DocumentItem = { ...a, corners: square(40) };
      const { result, rerender } = renderPreviews({
        documents: [a],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });
      await advance(0);
      rerender({
        documents: [moved],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });
      await advance(100);

      first.resolve(encoder.encode(thumb(a, NO_ENHANCEMENTS)));
      await advance(400);
      // The outdated thumbnail shows meanwhile, and the new crop is still pending
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: true,
      });

      await advance(500);
      expect(result.current.a).toEqual({
        url: thumb(moved, NO_ENHANCEMENTS),
        pending: false,
      });
    });

    it('keeps the minimum duration for a crop changed while another document renders', async (): Promise<void> => {
      const other: Deferred<Uint8Array> = deferred();
      const a: DocumentItem = makeDoc('a');
      const b: DocumentItem = makeDoc('b');
      const moved: DocumentItem = { ...a, corners: square(40) };
      vi.mocked(renderDocument)
        .mockResolvedValueOnce(encoder.encode(thumb(a, NO_ENHANCEMENTS)))
        .mockReturnValueOnce(other.promise);
      const { result, rerender } = renderPreviews({
        documents: [a, b],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });
      await advance(500);
      // `a` changes while `b` renders, and its previous thumbnail lands meanwhile
      rerender({
        documents: [moved, b],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });
      await advance(600);
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: true,
      });

      other.resolve(encoder.encode(thumb(b, NO_ENHANCEMENTS)));
      // `a` renders right after `b`, and that render is done in the next tick
      await advance(10);
      await advance(10);
      // The new crop of `a` became stale 620 ms ago: still pending
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: true,
      });

      await advance(400);
      expect(result.current.a).toEqual({
        url: thumb(moved, NO_ENHANCEMENTS),
        pending: false,
      });
    });

    it('shows a thumbnail of a cached render right away', async (): Promise<void> => {
      vi.mocked(hasRender).mockReturnValue(true);
      const a: DocumentItem = makeDoc('a');
      const { result } = renderPreviews({
        documents: [a],
        mode: 'crop',
        options: { activeId: 'a', paused: false },
      });

      await advance(0);
      expect(result.current.a).toEqual({
        url: thumb(a, NO_ENHANCEMENTS),
        pending: false,
      });
    });
  });
});
