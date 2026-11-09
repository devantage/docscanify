import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NO_ENHANCEMENTS, renderWith } from '@/lib/scan';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { forgetRenders, hasRender, renderDocument } from './renderCache';

vi.mock('@/lib/scan', (): Record<string, unknown> => ({
  NO_ENHANCEMENTS: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  renderWith: vi.fn(),
}));

interface Deferred {
  resolve(png: Uint8Array): void;
  reject(error: unknown): void;
}

/** Renders started through renderWith that the test settles by hand, in start order. */
let pending: Deferred[];

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 200 },
  bottomLeft: { x: 0, y: 200 },
};

const GRAYSCALE: EnhanceOptions = { ...NO_ENHANCEMENTS, filter: 'grayscale' };
const BW: EnhanceOptions = { ...NO_ENHANCEMENTS, filter: 'bw' };
const ROTATED: EnhanceOptions = { ...NO_ENHANCEMENTS, turns: 1 };

function makeDoc(
  id: string,
  overrides: Partial<DocumentItem> = {},
): DocumentItem {
  return {
    id,
    source: {
      image: document.createElement('img'),
      url: `blob:${id}`,
      name: id,
      scannedDocument: { id } as unknown as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: NO_ENHANCEMENTS,
    ...overrides,
  };
}

const renderCount = (): number => vi.mocked(renderWith).mock.calls.length;

/** Lets the cache see that a render settled. */
async function flush(): Promise<void> {
  await new Promise<void>((resolve: () => void): void => {
    setTimeout(resolve, 0);
  });
}

/** Renders and settles it right away, so later requests find it finished. */
async function renderNow(
  doc: DocumentItem,
  options?: EnhanceOptions,
): Promise<Uint8Array> {
  const result: Promise<Uint8Array> = renderDocument(doc, options);
  pending[pending.length - 1].resolve(new Uint8Array([pending.length]));
  return result;
}

beforeEach((): void => {
  forgetRenders();
  pending = [];
  vi.mocked(renderWith).mockImplementation(
    async (): Promise<Uint8Array> =>
      new Promise<Uint8Array>(
        (
          resolve: (png: Uint8Array) => void,
          reject: (error: unknown) => void,
        ): void => {
          pending.push({ resolve, reject });
        },
      ),
  );
});

describe('renderDocument', (): void => {
  it("renders the document's scanned document with its own adjustments by default", async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a', { options: GRAYSCALE });

    const png: Uint8Array = await renderNow(doc);

    expect(png).toEqual(new Uint8Array([1]));
    expect(renderWith).toHaveBeenCalledExactlyOnceWith(
      doc.source.scannedDocument,
      GRAYSCALE,
    );
  });

  it('renders with the given adjustments instead of the document ones', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a', { options: GRAYSCALE });

    await renderNow(doc, NO_ENHANCEMENTS);

    expect(renderWith).toHaveBeenCalledExactlyOnceWith(
      doc.source.scannedDocument,
      NO_ENHANCEMENTS,
    );
  });

  it('reuses the earlier render with the same document, corners and adjustments', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a');
    const first: Uint8Array = await renderNow(doc);

    // An equal but new document object and options object still hit the cache
    const second: Uint8Array = await renderDocument(
      makeDoc('a', { corners: structuredClone(CORNERS) }),
      { ...NO_ENHANCEMENTS },
    );

    expect(second).toBe(first);
    expect(renderCount()).toBe(1);
  });

  it('shares a render still in progress between concurrent requests', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a');

    const first: Promise<Uint8Array> = renderDocument(doc);
    const second: Promise<Uint8Array> = renderDocument(doc);
    expect(renderCount()).toBe(1);
    const png: Uint8Array = new Uint8Array([42]);
    pending[0].resolve(png);

    expect(await first).toBe(png);
    expect(await second).toBe(png);
  });

  it('renders again when the adjustments change', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a');

    await renderNow(doc);
    await renderNow(doc, BW);

    expect(renderCount()).toBe(2);
    expect(vi.mocked(renderWith).mock.calls[1][1]).toEqual(BW);
  });

  it('renders again when the corners change', async (): Promise<void> => {
    await renderNow(makeDoc('a'));
    const moved: DocumentItem = makeDoc('a', {
      corners: { ...CORNERS, topLeft: { x: 1, y: 0 } },
    });

    const png: Uint8Array = await renderNow(moved);

    expect(renderCount()).toBe(2);
    expect(png).toEqual(new Uint8Array([2]));
  });

  it('keys renders without corners apart from renders with corners', async (): Promise<void> => {
    await renderNow(makeDoc('a', { corners: null }));
    await renderNow(makeDoc('a'));
    await renderDocument(makeDoc('a', { corners: null }));

    expect(renderCount()).toBe(2);
  });

  it('keeps the renders of each document apart', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const b: DocumentItem = makeDoc('b');

    const pngA: Uint8Array = await renderNow(a);
    const pngB: Uint8Array = await renderNow(b);

    expect(renderCount()).toBe(2);
    expect(vi.mocked(renderWith).mock.calls[1][0]).toBe(
      b.source.scannedDocument,
    );
    expect(await renderDocument(a)).toBe(pngA);
    expect(await renderDocument(b)).toBe(pngB);
    expect(renderCount()).toBe(2);
  });

  it('keeps the renders of documents from files with the same name apart', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const otherB: DocumentItem = makeDoc('b');
    // Two photos both named "image.jpg": only the id tells them apart
    const b: DocumentItem = {
      ...otherB,
      source: { ...otherB.source, name: a.source.name, url: a.source.url },
    };

    const pngA: Uint8Array = await renderNow(a);
    const pngB: Uint8Array = await renderNow(b);

    expect(renderCount()).toBe(2);
    expect(vi.mocked(renderWith).mock.calls[1][0]).toBe(
      b.source.scannedDocument,
    );
    expect(pngB).not.toBe(pngA);
    forgetRenders('a');
    expect(hasRender(b)).toBe(true);
  });

  describe('with more than 3 renders of a document', (): void => {
    it('evicts the oldest one', async (): Promise<void> => {
      const doc: DocumentItem = makeDoc('a');
      await renderNow(doc, NO_ENHANCEMENTS);
      await renderNow(doc, GRAYSCALE);
      await renderNow(doc, BW);
      await renderNow(doc, ROTATED);

      // The three most recent are still cached
      await renderDocument(doc, GRAYSCALE);
      await renderDocument(doc, BW);
      await renderDocument(doc, ROTATED);
      expect(renderCount()).toBe(4);
      expect(hasRender(doc, NO_ENHANCEMENTS)).toBe(false);

      // The oldest renders again
      await renderNow(doc, NO_ENHANCEMENTS);
      expect(renderCount()).toBe(5);
    });

    it('evicts the least recently used one, not the first rendered', async (): Promise<void> => {
      const doc: DocumentItem = makeDoc('a');
      await renderNow(doc, NO_ENHANCEMENTS);
      await renderNow(doc, GRAYSCALE);
      await renderNow(doc, BW);

      // Using the first one again makes GRAYSCALE the oldest
      await renderDocument(doc, NO_ENHANCEMENTS);
      await renderNow(doc, ROTATED);

      expect(renderCount()).toBe(4);
      expect(hasRender(doc, NO_ENHANCEMENTS)).toBe(true);
      expect(hasRender(doc, GRAYSCALE)).toBe(false);
      expect(hasRender(doc, BW)).toBe(true);
      expect(hasRender(doc, ROTATED)).toBe(true);
    });

    it('counts the limit per document', async (): Promise<void> => {
      const a: DocumentItem = makeDoc('a');
      const b: DocumentItem = makeDoc('b');
      for (const options of [NO_ENHANCEMENTS, GRAYSCALE, BW]) {
        await renderNow(a, options);
        await renderNow(b, options);
      }

      for (const options of [NO_ENHANCEMENTS, GRAYSCALE, BW]) {
        expect(hasRender(a, options)).toBe(true);
        expect(hasRender(b, options)).toBe(true);
      }
    });
  });

  describe('when a render fails', (): void => {
    it('rejects every request sharing it and renders again on the next request', async (): Promise<void> => {
      const doc: DocumentItem = makeDoc('a');
      const error: Error = new Error('OpenCV failed');

      const first: Promise<Uint8Array> = renderDocument(doc);
      const second: Promise<Uint8Array> = renderDocument(doc);
      pending[0].reject(error);
      await expect(first).rejects.toBe(error);
      await expect(second).rejects.toBe(error);
      await flush();

      const retry: Uint8Array = await renderNow(doc);
      expect(renderCount()).toBe(2);
      expect(retry).toEqual(new Uint8Array([2]));
      expect(hasRender(doc)).toBe(true);
    });

    it('does not drop a newer render with the same key', async (): Promise<void> => {
      const doc: DocumentItem = makeDoc('a');
      // Started, then evicted while still in progress
      const stale: Promise<Uint8Array> = renderDocument(doc, NO_ENHANCEMENTS);
      await renderNow(doc, GRAYSCALE);
      await renderNow(doc, BW);
      await renderNow(doc, ROTATED);
      // Requested again: a new render takes its key
      await renderNow(doc, NO_ENHANCEMENTS);
      expect(renderCount()).toBe(5);

      pending[0].reject(new Error('stale render failed'));
      await expect(stale).rejects.toThrow('stale render failed');
      await flush();

      expect(hasRender(doc, NO_ENHANCEMENTS)).toBe(true);
      await renderDocument(doc, NO_ENHANCEMENTS);
      expect(renderCount()).toBe(5);
    });
  });
});

describe('hasRender', (): void => {
  it('is false before rendering and while the render is in progress', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a');
    expect(hasRender(doc)).toBe(false);

    const result: Promise<Uint8Array> = renderDocument(doc);
    expect(hasRender(doc)).toBe(false);

    pending[0].resolve(new Uint8Array([1]));
    await result;
    expect(hasRender(doc)).toBe(true);
  });

  it('matches the corners and the adjustments, defaulting to the document ones', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a', { options: GRAYSCALE });
    await renderNow(doc);

    expect(hasRender(doc)).toBe(true);
    expect(hasRender(doc, GRAYSCALE)).toBe(true);
    expect(hasRender(doc, BW)).toBe(false);
    expect(hasRender({ ...doc, corners: null })).toBe(false);
    expect(hasRender(makeDoc('b', { options: GRAYSCALE }))).toBe(false);
  });

  it('is false after the render failed', async (): Promise<void> => {
    const doc: DocumentItem = makeDoc('a');
    const result: Promise<Uint8Array> = renderDocument(doc);
    pending[0].reject(new Error('failed'));
    await expect(result).rejects.toThrow('failed');
    await flush();

    expect(hasRender(doc)).toBe(false);
  });
});

describe('forgetRenders', (): void => {
  it('drops the renders of one document only', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const b: DocumentItem = makeDoc('b');
    await renderNow(a);
    await renderNow(b);

    forgetRenders('a');

    expect(hasRender(a)).toBe(false);
    expect(hasRender(b)).toBe(true);
    await renderNow(a);
    await renderDocument(b);
    expect(renderCount()).toBe(3);
  });

  it('drops every render without an id', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    const b: DocumentItem = makeDoc('b');
    await renderNow(a);
    await renderNow(b);

    forgetRenders();

    expect(hasRender(a)).toBe(false);
    expect(hasRender(b)).toBe(false);
  });

  it('ignores an unknown id', async (): Promise<void> => {
    const a: DocumentItem = makeDoc('a');
    await renderNow(a);

    forgetRenders('missing');

    expect(hasRender(a)).toBe(true);
  });
});
