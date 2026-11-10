import type { Corners, ScannedDocument } from '@devantage/docscanify';
import {
  act,
  renderHook,
  type RenderHookResult,
  screen,
} from '@testing-library/react';
import type { JSX, ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { ToastProvider } from '@/components/toast';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { useCropAlerts, type UseCropAlertsResult } from './useCropAlerts';

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 100 },
  bottomLeft: { x: 0, y: 100 },
};

const CROSSED: string =
  'The corners are crossed. Drag them to form a quadrilateral.';
const DETECTOR: string = 'The edge detector could not be loaded';

/** A document with valid corners and no adjustments, changed by `overrides`. */
function makeDocument(overrides: Partial<DocumentItem> = {}): DocumentItem {
  return {
    id: 'doc-1',
    source: {
      image: document.createElement('img'),
      url: 'blob:doc',
      name: 'doc',
      scannedDocument: {} as unknown as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off' },
    ...overrides,
  };
}

/** The translation (in English) and toast providers the hook needs. */
function Providers({ children }: { children: ReactNode }): JSX.Element {
  return (
    <TranslateProvider defaultLocale="en">
      <ToastProvider>{children}</ToastProvider>
    </TranslateProvider>
  );
}

interface HookProps {
  doc: DocumentItem;
  invalidCount: number;
}

/** Renders the hook with `initial` as its props; `rerender` changes the document or the count. */
function renderAlerts(
  initial: HookProps,
): RenderHookResult<UseCropAlertsResult, HookProps> {
  return renderHook(
    ({ doc, invalidCount }: HookProps): UseCropAlertsResult =>
      useCropAlerts(doc, invalidCount),
    { initialProps: initial, wrapper: Providers },
  );
}

/** Toasts on screen, in order, as `kind: message`. */
const toasts = (): string[] =>
  screen
    .queryAllByTestId('toast')
    .map(
      (toast: HTMLElement) =>
        `${toast.dataset.kind ?? ''}: ${toast.textContent}`,
    );

describe('useCropAlerts', (): void => {
  it('shows nothing for a valid document when every document is valid', (): void => {
    renderAlerts({ doc: makeDocument(), invalidCount: 0 });

    expect(toasts()).toEqual([]);
  });

  it('shows the crossed-corners error when a document with crossed corners opens', (): void => {
    renderAlerts({ doc: makeDocument({ valid: false }), invalidCount: 1 });

    // The error covers the document on display: no warning about the count on top of it
    expect(toasts()).toEqual([`error: ${CROSSED}`]);
    expect(screen.getByRole('alert')).toHaveTextContent(CROSSED);
  });

  it('does not report crossed corners for a document without corners', (): void => {
    renderAlerts({
      doc: makeDocument({ corners: null, valid: false }),
      invalidCount: 0,
    });

    expect(toasts()).toEqual([]);
  });

  it('waits for the drag to end before reporting corners that became crossed', (): void => {
    const { result, rerender } = renderAlerts({
      doc: makeDocument(),
      invalidCount: 0,
    });

    // Every move of the drag updates the document: no toast yet
    rerender({ doc: makeDocument({ valid: false }), invalidCount: 1 });
    expect(toasts()).toEqual([]);

    act((): void => {
      result.current.dragEnded();
    });
    expect(toasts()).toEqual([`error: ${CROSSED}`]);
  });

  it('reports nothing on drag end when the corners are fine', (): void => {
    const { result } = renderAlerts({ doc: makeDocument(), invalidCount: 0 });

    act((): void => {
      result.current.dragEnded();
    });

    expect(toasts()).toEqual([]);
  });

  it('shows a single crossed-corners toast however many drags end crossed', (): void => {
    const { result } = renderAlerts({
      doc: makeDocument({ valid: false }),
      invalidCount: 1,
    });

    act((): void => {
      result.current.dragEnded();
      result.current.dragEnded();
    });

    expect(toasts()).toEqual([`error: ${CROSSED}`]);
  });

  it('clears the crossed-corners error once the corners are fixed', (): void => {
    const { rerender } = renderAlerts({
      doc: makeDocument({ valid: false }),
      invalidCount: 1,
    });

    rerender({ doc: makeDocument({ valid: true }), invalidCount: 0 });

    expect(toasts()).toEqual([]);
  });

  it('shows the crossed-corners error again when another crossed document opens', (): void => {
    const { rerender } = renderAlerts({
      doc: makeDocument({ valid: false }),
      invalidCount: 2,
    });
    act((): void => {
      screen.getByRole('button', { name: 'Close message' }).click();
    });
    expect(toasts()).toEqual([]);

    rerender({
      doc: makeDocument({ id: 'doc-2', valid: false }),
      invalidCount: 2,
    });

    expect(toasts()).toEqual([`error: ${CROSSED}`]);
  });

  it('warns about other documents that need a crop fix, with the plural form', (): void => {
    renderAlerts({ doc: makeDocument(), invalidCount: 2 });

    expect(toasts()).toEqual([
      'warning: 2 documents need a crop fix. They are marked with ! in the list.',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('2 documents');
  });

  it('uses the singular for a single document that needs a fix', (): void => {
    renderAlerts({ doc: makeDocument(), invalidCount: 1 });

    expect(toasts()).toEqual([
      'warning: 1 document needs a crop fix. It is marked with ! in the list.',
    ]);
  });

  it('replaces the warning when the count changes, instead of stacking another', (): void => {
    const { rerender } = renderAlerts({ doc: makeDocument(), invalidCount: 3 });

    rerender({ doc: makeDocument(), invalidCount: 2 });

    expect(toasts()).toEqual([
      'warning: 2 documents need a crop fix. They are marked with ! in the list.',
    ]);
  });

  it('removes the warning when no document needs a fix any more', (): void => {
    const { rerender } = renderAlerts({ doc: makeDocument(), invalidCount: 1 });

    rerender({ doc: makeDocument(), invalidCount: 0 });

    expect(toasts()).toEqual([]);
  });

  it('switches from the error to the warning when the document on display is fixed but others are not', (): void => {
    const { rerender } = renderAlerts({
      doc: makeDocument({ valid: false }),
      invalidCount: 2,
    });
    expect(toasts()).toEqual([`error: ${CROSSED}`]);

    rerender({ doc: makeDocument({ valid: true }), invalidCount: 1 });

    expect(toasts()).toEqual([
      'warning: 1 document needs a crop fix. It is marked with ! in the list.',
    ]);
  });

  it('reports a document whose edge detector could not be loaded', (): void => {
    renderAlerts({
      doc: makeDocument({ corners: null, valid: false, detectorFailed: true }),
      invalidCount: 0,
    });

    expect(toasts()).toEqual([`error: ${DETECTOR}`]);
  });

  it('keeps the detector error when a document with crossed corners opens next', (): void => {
    const { rerender } = renderAlerts({
      doc: makeDocument({ corners: null, valid: false, detectorFailed: true }),
      invalidCount: 0,
    });
    expect(toasts()).toEqual([`error: ${DETECTOR}`]);

    rerender({
      doc: makeDocument({ id: 'doc-2', valid: false }),
      invalidCount: 1,
    });

    // Each toast is about its own condition: the crossed corners do not replace the detector error
    expect(toasts()).toHaveLength(2);
    expect(toasts()).toEqual(
      expect.arrayContaining([`error: ${DETECTOR}`, `error: ${CROSSED}`]),
    );
  });

  it('reports the detector error again when another failed document opens', (): void => {
    const { rerender } = renderAlerts({
      doc: makeDocument({ corners: null, valid: false, detectorFailed: true }),
      invalidCount: 0,
    });
    act((): void => {
      screen.getByRole('button', { name: 'Close message' }).click();
    });

    rerender({
      doc: makeDocument({
        id: 'doc-2',
        corners: null,
        valid: false,
        detectorFailed: true,
      }),
      invalidCount: 0,
    });

    expect(toasts()).toEqual([`error: ${DETECTOR}`]);
  });
});
