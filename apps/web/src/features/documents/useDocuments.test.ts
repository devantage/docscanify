import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, renderHook, type RenderHookResult } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { type CropState, detectCrop } from './detectCrop';
import { forgetRenders } from './renderCache';
import { useDocuments, type UseDocumentsResult } from './useDocuments';

vi.mock('./detectCrop', () => ({ detectCrop: vi.fn() }));
vi.mock('./renderCache', () => ({ forgetRenders: vi.fn() }));

const NO_ENHANCEMENTS: EnhanceOptions = {
  filter: 'none',
  turns: 0,
  sharpen: 'off',
  denoise: false,
};

/** Corners of a `size` × `size` square at the origin. */
const square = (size: number): Corners => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: size, y: 0 },
  bottomRight: { x: size, y: size },
  bottomLeft: { x: 0, y: size },
});

/** Left and right swapped: the fake document rejects them, as the real one does. */
const CROSSED: Corners = {
  topLeft: { x: 100, y: 0 },
  topRight: { x: 0, y: 0 },
  bottomRight: { x: 0, y: 100 },
  bottomLeft: { x: 100, y: 100 },
};

/** Stand-in for the document: keeps valid corners and throws on crossed ones. */
function fakeScannedDocument(): ScannedDocument {
  let current: Corners | null = null;
  const fake: { corners: Corners | null } = {
    get corners(): Corners | null {
      return current;
    },
    set corners(value: Corners | null) {
      if (value && value.topLeft.x > value.topRight.x)
        throw new Error('Crossed corners');
      current = value;
    },
  };
  return fake as unknown as ScannedDocument;
}

/**
 * A document with valid corners (a 10 × 10 square) and no adjustments, changed by `patch`. Its
 * scanned document is a {@link fakeScannedDocument}.
 */
function makeDoc(id: string, patch: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id,
    source: {
      image: new Image(),
      url: `blob:${id}`,
      name: id,
      scannedDocument: fakeScannedDocument(),
    },
    corners: square(10),
    valid: true,
    detectorFailed: false,
    options: NO_ENHANCEMENTS,
    ...patch,
  };
}

/** Ids of the documents, in list order. */
const ids = (documents: DocumentItem[]): string[] =>
  documents.map((d: DocumentItem) => d.id);

type Hook = RenderHookResult<UseDocumentsResult, unknown>;

/** Renders the hook with the given documents already added. */
function renderWith(...docs: DocumentItem[]): Hook {
  const hook: Hook = renderHook(() => useDocuments());
  if (docs.length)
    act(() => {
      hook.result.current.add(docs);
    });
  return hook;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

/** A promise that settles only when the test resolves it, to finish detections in any order. */
function deferred<T>(): Deferred<T> {
  let resolve: (value: T) => void = () => undefined;
  const promise: Promise<T> = new Promise<T>((r: (value: T) => void) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('useDocuments', (): void => {
  beforeEach((): void => {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
  });

  afterEach((): void => {
    vi.mocked(detectCrop).mockReset();
  });

  it('starts with no documents and nothing on display', (): void => {
    const { result } = renderHook(() => useDocuments());

    expect(result.current.documents).toEqual([]);
    expect(result.current.active).toBeNull();
  });

  describe('add', (): void => {
    it('appends documents at the end, in the order given', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));

      act(() => {
        result.current.add([makeDoc('c'), makeDoc('d')]);
      });

      expect(ids(result.current.documents)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('puts the first of the added documents on display', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      expect(result.current.active?.id).toBe('a');

      act(() => {
        result.current.add([makeDoc('c'), makeDoc('d')]);
      });

      expect(result.current.active?.id).toBe('c');
    });

    it('ignores an empty list and keeps the document on display', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      act(() => {
        result.current.select('b');
      });

      act(() => {
        result.current.add([]);
      });

      expect(ids(result.current.documents)).toEqual(['a', 'b']);
      expect(result.current.active?.id).toBe('b');
    });
  });

  describe('select and the active document', (): void => {
    it('puts the selected document on display', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));

      act(() => {
        result.current.select('c');
      });

      expect(result.current.active).toBe(result.current.documents[2]);
    });

    it('falls back to the first document when the selected id is not in the list', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));

      act(() => {
        result.current.select('missing');
      });

      expect(result.current.active?.id).toBe('a');
    });

    it('reflects updates of the active document', (): void => {
      const { result } = renderWith(makeDoc('a'));
      const options: EnhanceOptions = { ...NO_ENHANCEMENTS, filter: 'bw' };

      act(() => {
        result.current.setOptions('a', options);
      });

      expect(result.current.active?.options).toEqual(options);
    });
  });

  describe('remove', (): void => {
    it('removes the document and returns how many are left', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));
      let left: number = -1;

      act(() => {
        left = result.current.remove('b');
      });

      expect(left).toBe(2);
      expect(ids(result.current.documents)).toEqual(['a', 'c']);
    });

    it('revokes the object URL of the removed image and drops its renders', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));

      act(() => {
        result.current.remove('b');
      });

      expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:b');
      expect(forgetRenders).toHaveBeenCalledTimes(1);
      expect(forgetRenders).toHaveBeenCalledWith('b');
    });

    it('shows the next document when the one on display is removed', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));
      act(() => {
        result.current.select('b');
      });

      act(() => {
        result.current.remove('b');
      });

      expect(result.current.active?.id).toBe('c');
    });

    it('shows the previous document when the last one, on display, is removed', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));
      act(() => {
        result.current.select('c');
      });

      act(() => {
        result.current.remove('c');
      });

      expect(result.current.active?.id).toBe('b');
    });

    it('keeps the document on display when another one is removed', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));
      act(() => {
        result.current.select('c');
      });

      act(() => {
        result.current.remove('a');
      });

      expect(result.current.active?.id).toBe('c');
    });

    it('leaves nothing on display after the last document is removed', (): void => {
      const { result } = renderWith(makeDoc('a'));
      let left: number = -1;

      act(() => {
        left = result.current.remove('a');
      });

      expect(left).toBe(0);
      expect(result.current.documents).toEqual([]);
      expect(result.current.active).toBeNull();

      // A new document is shown even though the old selection is gone
      act(() => {
        result.current.add([makeDoc('b')]);
      });
      expect(result.current.active?.id).toBe('b');
    });

    it('ignores an unknown id', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      let left: number = -1;

      act(() => {
        left = result.current.remove('missing');
      });

      expect(left).toBe(2);
      expect(ids(result.current.documents)).toEqual(['a', 'b']);
      expect(URL.revokeObjectURL).not.toHaveBeenCalled();
      expect(forgetRenders).not.toHaveBeenCalled();
    });
  });

  describe('reorder', (): void => {
    it('moves a document forward', (): void => {
      const { result } = renderWith(
        makeDoc('a'),
        makeDoc('b'),
        makeDoc('c'),
        makeDoc('d'),
      );

      act(() => {
        result.current.reorder(0, 2);
      });

      expect(ids(result.current.documents)).toEqual(['b', 'c', 'a', 'd']);
    });

    it('moves a document backward', (): void => {
      const { result } = renderWith(
        makeDoc('a'),
        makeDoc('b'),
        makeDoc('c'),
        makeDoc('d'),
      );

      act(() => {
        result.current.reorder(3, 0);
      });

      expect(ids(result.current.documents)).toEqual(['d', 'a', 'b', 'c']);
    });

    it('keeps the same document on display after reordering', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'), makeDoc('c'));

      act(() => {
        result.current.reorder(0, 2);
      });

      expect(result.current.active?.id).toBe('a');
    });
  });

  describe('setCorners', (): void => {
    it('stores valid corners and hands them to the document', (): void => {
      const doc: DocumentItem = makeDoc('a');
      const { result } = renderWith(doc);
      const corners: Corners = square(50);

      act(() => {
        result.current.setCorners('a', corners);
      });

      expect(result.current.documents[0].corners).toEqual(corners);
      expect(result.current.documents[0].valid).toBe(true);
      expect(doc.source.scannedDocument.corners).toEqual(corners);
    });

    it('keeps crossed corners on screen but marks the document invalid', (): void => {
      const doc: DocumentItem = makeDoc('a');
      const { result } = renderWith(doc);
      act(() => {
        result.current.setCorners('a', square(50));
      });

      act(() => {
        result.current.setCorners('a', CROSSED);
      });

      expect(result.current.documents[0].corners).toEqual(CROSSED);
      expect(result.current.documents[0].valid).toBe(false);
      // The document itself keeps the last valid corners
      expect(doc.source.scannedDocument.corners).toEqual(square(50));
    });

    it('makes the document valid again when the corners are fixed', (): void => {
      const { result } = renderWith(makeDoc('a'));
      act(() => {
        result.current.setCorners('a', CROSSED);
      });

      act(() => {
        result.current.setCorners('a', square(20));
      });

      expect(result.current.documents[0].valid).toBe(true);
      expect(result.current.documents[0].corners).toEqual(square(20));
    });

    it('only changes the given document', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      const before: DocumentItem = result.current.documents[1];

      act(() => {
        result.current.setCorners('a', CROSSED);
      });

      expect(result.current.documents[1]).toBe(before);
    });

    it('ignores an unknown id', (): void => {
      const { result } = renderWith(makeDoc('a'));
      const before: DocumentItem[] = result.current.documents;

      act(() => {
        result.current.setCorners('missing', square(5));
      });

      expect(result.current.documents).toBe(before);
    });
  });

  describe('setOptions', (): void => {
    it('replaces the adjustments of one document only', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      const options: EnhanceOptions = {
        filter: 'grayscale',
        turns: 1,
        sharpen: 'strong',
        denoise: true,
      };

      act(() => {
        result.current.setOptions('b', options);
      });

      expect(result.current.documents[1].options).toEqual(options);
      expect(result.current.documents[0].options).toEqual(NO_ENHANCEMENTS);
    });
  });

  describe('applyOptionsToAll', (): void => {
    it('copies color, sharpness and noise reduction to every other document, keeping each rotation', (): void => {
      const { result } = renderWith(
        makeDoc('a', { options: { ...NO_ENHANCEMENTS, turns: 3 } }),
        makeDoc('b', {
          options: { filter: 'bw', turns: 2, sharpen: 'soft', denoise: true },
        }),
        makeDoc('c', { options: { ...NO_ENHANCEMENTS, turns: -1 } }),
      );

      act(() => {
        result.current.applyOptionsToAll('b');
      });

      expect(
        result.current.documents.map((d: DocumentItem) => d.options),
      ).toEqual([
        { filter: 'bw', turns: 3, sharpen: 'soft', denoise: true },
        { filter: 'bw', turns: 2, sharpen: 'soft', denoise: true },
        { filter: 'bw', turns: -1, sharpen: 'soft', denoise: true },
      ]);
    });

    it('keeps the source document object unchanged', (): void => {
      const { result } = renderWith(
        makeDoc('a'),
        makeDoc('b', {
          options: { filter: 'bw', turns: 0, sharpen: 'soft', denoise: true },
        }),
      );
      const source: DocumentItem = result.current.documents[1];

      act(() => {
        result.current.applyOptionsToAll('b');
      });

      expect(result.current.documents[1]).toBe(source);
    });

    it('ignores an unknown source', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));
      const before: DocumentItem[] = result.current.documents;

      act(() => {
        result.current.applyOptionsToAll('missing');
      });

      expect(result.current.documents).toBe(before);
    });
  });

  describe('redetect', (): void => {
    it('puts the detected crop on the document', async (): Promise<void> => {
      const doc: DocumentItem = makeDoc('a', { valid: false });
      const crop: CropState = {
        corners: square(77),
        valid: true,
        detectorFailed: false,
      };
      vi.mocked(detectCrop).mockResolvedValue(crop);
      const { result } = renderWith(doc, makeDoc('b'));

      await act(async () => {
        await result.current.redetect('a');
      });

      expect(detectCrop).toHaveBeenCalledWith(doc.source);
      expect(result.current.documents[0]).toMatchObject(crop);
      expect(result.current.documents[1].corners).toEqual(square(10));
    });

    it('marks the document when the detector could not be loaded', async (): Promise<void> => {
      vi.mocked(detectCrop).mockResolvedValue({
        corners: null,
        valid: false,
        detectorFailed: true,
      });
      const { result } = renderWith(makeDoc('a'));

      await act(async () => {
        await result.current.redetect('a');
      });

      expect(result.current.documents[0]).toMatchObject({
        corners: null,
        valid: false,
        detectorFailed: true,
      });
    });

    it('only keeps the latest detection when an earlier one finishes later', async (): Promise<void> => {
      const first: Deferred<CropState> = deferred<CropState>();
      const second: Deferred<CropState> = deferred<CropState>();
      vi.mocked(detectCrop)
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderWith(makeDoc('a'));

      let runs: Promise<void>[] = [];
      act(() => {
        runs = [result.current.redetect('a'), result.current.redetect('a')];
      });
      await act(async () => {
        second.resolve({
          corners: square(2),
          valid: true,
          detectorFailed: false,
        });
        first.resolve({
          corners: square(1),
          valid: true,
          detectorFailed: false,
        });
        await Promise.all(runs);
      });

      expect(result.current.documents[0].corners).toEqual(square(2));
    });

    it('does nothing for an unknown id', async (): Promise<void> => {
      const { result } = renderWith(makeDoc('a'));

      await act(async () => {
        await result.current.redetect('missing');
      });

      expect(detectCrop).not.toHaveBeenCalled();
    });
  });

  describe('clear', (): void => {
    it('discards every document, its image URL and every render', (): void => {
      const { result } = renderWith(makeDoc('a'), makeDoc('b'));

      act(() => {
        result.current.clear();
      });

      expect(result.current.documents).toEqual([]);
      expect(result.current.active).toBeNull();
      expect(vi.mocked(URL.revokeObjectURL).mock.calls).toEqual([
        ['blob:a'],
        ['blob:b'],
      ]);
      expect(forgetRenders).toHaveBeenCalledTimes(1);
      expect(forgetRenders).toHaveBeenCalledWith();
    });
  });
});
