import type { Corners, ScannedDocument } from '@devantage/docscanify';
import {
  act,
  renderHook,
  type RenderHookResult,
  waitFor,
} from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hasRender, renderDocument } from '@/features/documents/renderCache';
import { canvasFromPng } from '@/lib/image';
import { waitForPaint, withMinDuration } from '@/lib/loading';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import {
  useRenderedDocument,
  type UseRenderedDocumentResult,
} from './useRenderedDocument';

// Rendering needs OpenCV and decoding needs real images: the hook is tested around them
vi.mock('@/features/documents/renderCache', (): Record<string, unknown> => ({
  hasRender: vi.fn(),
  renderDocument: vi.fn(),
}));
vi.mock('@/lib/image', (): Record<string, unknown> => ({
  canvasFromPng: vi.fn(),
}));
vi.mock('@/lib/loading', (): Record<string, unknown> => ({
  waitForPaint: vi.fn(),
  withMinDuration: vi.fn(),
}));

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

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 10, y: 0 },
  bottomRight: { x: 10, y: 10 },
  bottomLeft: { x: 0, y: 10 },
};

const OPTIONS: EnhanceOptions = {
  filter: 'none',
  turns: 0,
  sharpen: 'off',
  denoise: false,
};

function makeDocument(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc-1',
    source: {
      image: document.createElement('img'),
      url: 'blob:doc-1',
      name: 'doc-1',
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: OPTIONS,
    ...overrides,
  };
}

/** Renders requested so far, in order: each one finishes when the test says so. */
let renders: Deferred<Uint8Array>[];

/** A PNG whose decoded canvas is `width` px wide, so each render is recognizable. */
const png = (width: number): Uint8Array => new Uint8Array([width]);

type Hook = RenderHookResult<UseRenderedDocumentResult, { doc: DocumentItem }>;

function renderPreview(doc: DocumentItem): Hook {
  return renderHook(
    ({ doc: current }: { doc: DocumentItem }): UseRenderedDocumentResult =>
      useRenderedDocument(current),
    { initialProps: { doc } },
  );
}

async function settle(): Promise<void> {
  await act(async (): Promise<void> => {
    await Promise.resolve();
  });
}

beforeEach((): void => {
  vi.resetAllMocks();
  renders = [];
  vi.mocked(renderDocument).mockImplementation(
    async (): Promise<Uint8Array> => {
      const render: Deferred<Uint8Array> = deferred<Uint8Array>();
      renders.push(render);
      return render.promise;
    },
  );
  vi.mocked(hasRender).mockReturnValue(false);
  vi.mocked(canvasFromPng).mockImplementation(
    async (bytes: Uint8Array): Promise<HTMLCanvasElement> => {
      const canvas: HTMLCanvasElement = document.createElement('canvas');
      canvas.width = bytes[0];
      canvas.height = 50;
      return Promise.resolve(canvas);
    },
  );
  vi.mocked(waitForPaint).mockResolvedValue(undefined);
  vi.mocked(withMinDuration).mockImplementation(
    async <T>(work: () => Promise<T>): Promise<T> => work(),
  );
  vi.spyOn(console, 'error').mockImplementation((): void => undefined);
});

describe('useRenderedDocument', (): void => {
  it('renders a new document with a loading state and nothing to show yet', async (): Promise<void> => {
    const doc: DocumentItem = makeDocument();
    const hook: Hook = renderPreview(doc);

    expect(hook.result.current).toEqual({
      result: null,
      ready: false,
      busy: true,
      failed: false,
      rendering: true,
    });
    // A new render lasts the minimum loading duration and lets the loading state paint first
    expect(withMinDuration).toHaveBeenCalledTimes(1);
    await waitFor((): void => {
      expect(renderDocument).toHaveBeenCalledExactlyOnceWith(doc);
    });
    expect(waitForPaint).toHaveBeenCalledTimes(1);
  });

  it('shows the rendered document once it is ready', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });

    renders[0].resolve(png(120));

    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    expect(canvasFromPng).toHaveBeenCalledExactlyOnceWith(png(120));
    expect(hook.result.current.result?.width).toBe(120);
    expect(hook.result.current).toMatchObject({
      busy: false,
      failed: false,
      rendering: false,
    });
  });

  it('shows a cached render without a loading state', async (): Promise<void> => {
    vi.mocked(hasRender).mockReturnValue(true);
    vi.mocked(renderDocument).mockResolvedValue(png(80));
    const hook: Hook = renderPreview(makeDocument());

    expect(hook.result.current.rendering).toBe(false);
    expect(hook.result.current.busy).toBe(false);

    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    expect(hook.result.current.result?.width).toBe(80);
    expect(withMinDuration).not.toHaveBeenCalled();
    expect(waitForPaint).not.toHaveBeenCalled();
  });

  it('keeps showing the previous render, faded, while the new options render', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    renders[0].resolve(png(100));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });

    const changed: DocumentItem = makeDocument({
      options: { ...OPTIONS, filter: 'bw' },
    });
    hook.rerender({ doc: changed });

    expect(hook.result.current).toMatchObject({
      ready: false,
      busy: true,
      rendering: true,
    });
    expect(hook.result.current.result?.width).toBe(100);

    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });
    expect(renderDocument).toHaveBeenLastCalledWith(changed);
    renders[1].resolve(png(200));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    expect(hook.result.current.result?.width).toBe(200);
    expect(hook.result.current.rendering).toBe(false);
  });

  it('renders again when the corners change', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });

    hook.rerender({
      doc: makeDocument({
        corners: { ...CORNERS, topLeft: { x: 1, y: 1 } },
      }),
    });

    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });
  });

  it('renders again for another document with the same crop and adjustments', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    renders[0].resolve(png(100));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });

    const other: DocumentItem = makeDocument({ id: 'doc-2' });
    hook.rerender({ doc: other });

    expect(hook.result.current.ready).toBe(false);
    await waitFor((): void => {
      expect(renderDocument).toHaveBeenLastCalledWith(other);
    });
  });

  it('does not render again when the document changes without affecting the render', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    renders[0].resolve(png(100));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });

    // Same id, corners and adjustments in a new object, such as after another document changes
    hook.rerender({ doc: makeDocument({ detectorFailed: false }) });
    await settle();

    expect(renderDocument).toHaveBeenCalledTimes(1);
    expect(hook.result.current.ready).toBe(true);
  });

  it('ignores a render that finishes after the options changed again', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    hook.rerender({
      doc: makeDocument({ options: { ...OPTIONS, turns: 1 } }),
    });
    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });

    renders[1].resolve(png(222));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    // The first render is still running
    expect(hook.result.current.rendering).toBe(true);

    renders[0].resolve(png(111));
    await waitFor((): void => {
      expect(hook.result.current.rendering).toBe(false);
    });
    expect(hook.result.current.result?.width).toBe(222);
    expect(hook.result.current.ready).toBe(true);
  });

  it('ignores a render that fails after the options changed again', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    hook.rerender({
      doc: makeDocument({ options: { ...OPTIONS, turns: 1 } }),
    });
    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });

    renders[1].resolve(png(222));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });

    // The outdated render fails: the current one stays ready and not failed
    renders[0].reject(new Error('outdated render failed'));
    await waitFor((): void => {
      expect(hook.result.current.rendering).toBe(false);
    });
    expect(hook.result.current).toMatchObject({
      ready: true,
      busy: false,
      failed: false,
    });
    expect(hook.result.current.result?.width).toBe(222);
  });

  it('reports a failed render without anything to show', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    const error: Error = new Error('OpenCV ran out of memory');

    renders[0].reject(error);

    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    expect(hook.result.current).toEqual({
      result: null,
      ready: true,
      busy: false,
      failed: true,
      rendering: false,
    });
    expect(console.error).toHaveBeenCalledWith(error);
  });

  it('keeps the previous render when the new options fail', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    renders[0].resolve(png(100));
    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });

    hook.rerender({
      doc: makeDocument({ options: { ...OPTIONS, sharpen: 'strong' } }),
    });
    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });
    renders[1].reject(new Error('failed'));

    await waitFor((): void => {
      expect(hook.result.current.failed).toBe(true);
    });
    expect(hook.result.current.ready).toBe(true);
    expect(hook.result.current.result?.width).toBe(100);
  });

  it('recovers from a failure when other options render', async (): Promise<void> => {
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });
    renders[0].reject(new Error('failed'));
    await waitFor((): void => {
      expect(hook.result.current.failed).toBe(true);
    });

    hook.rerender({
      doc: makeDocument({ options: { ...OPTIONS, denoise: true } }),
    });
    expect(hook.result.current.failed).toBe(false);
    await waitFor((): void => {
      expect(renders).toHaveLength(2);
    });
    renders[1].resolve(png(64));

    await waitFor((): void => {
      expect(hook.result.current.ready).toBe(true);
    });
    expect(hook.result.current.failed).toBe(false);
    expect(hook.result.current.result?.width).toBe(64);
  });

  it('reports a decoding failure like a render failure', async (): Promise<void> => {
    vi.mocked(canvasFromPng).mockRejectedValue(new Error('bad PNG'));
    const hook: Hook = renderPreview(makeDocument());
    await waitFor((): void => {
      expect(renders).toHaveLength(1);
    });

    renders[0].resolve(png(10));

    await waitFor((): void => {
      expect(hook.result.current.failed).toBe(true);
    });
    expect(hook.result.current.result).toBeNull();
  });
});
