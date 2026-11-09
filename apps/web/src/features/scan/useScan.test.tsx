import type { ScannedDocument } from '@devantage/docscanify';
import { renderHook } from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentItem } from '@/lib/types';

import { ScanContext, type ScanContextValue } from './ScanContext';
import { useActiveDocument, useScan } from './useScan';

const doc: DocumentItem = {
  id: '1',
  source: {
    image: new Image(),
    url: 'blob:1',
    name: 'doc',
    scannedDocument: {} as ScannedDocument,
  },
  corners: null,
  valid: false,
  detectorFailed: true,
  options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
};

/** A session with only `active` on display (and in the list), or no documents for null. */
const sessionWith = (active: DocumentItem | null): ScanContextValue =>
  ({
    documents: active ? [active] : [],
    active,
  }) as ScanContextValue;

/** A wrapper that provides `value` as the session, as {@link ScanProvider} does. */
const providing =
  (value: ScanContextValue) =>
  ({ children }: { children: ReactNode }): JSX.Element => (
    <ScanContext.Provider value={value}>{children}</ScanContext.Provider>
  );

describe('useScan', (): void => {
  beforeEach((): void => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns the session of the provider', (): void => {
    const value: ScanContextValue = sessionWith(doc);

    const { result } = renderHook(() => useScan(), {
      wrapper: providing(value),
    });

    expect(result.current).toBe(value);
  });

  it('throws when used outside ScanProvider', (): void => {
    expect(() => renderHook(() => useScan())).toThrow(
      'useScan must be used inside ScanProvider',
    );
  });
});

describe('useActiveDocument', (): void => {
  beforeEach((): void => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('returns the document on display', (): void => {
    const { result } = renderHook(() => useActiveDocument(), {
      wrapper: providing(sessionWith(doc)),
    });

    expect(result.current).toBe(doc);
  });

  it('throws without a document on display', (): void => {
    expect(() =>
      renderHook(() => useActiveDocument(), {
        wrapper: providing(sessionWith(null)),
      }),
    ).toThrow('useActiveDocument needs a document on display');
  });

  it('throws when used outside ScanProvider', (): void => {
    expect(() => renderHook(() => useActiveDocument())).toThrow(
      'useScan must be used inside ScanProvider',
    );
  });
});
