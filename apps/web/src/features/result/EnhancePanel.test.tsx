import type { ScannedDocument } from '@devantage/docscanify';
import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import type { Step } from '@/features/steps';
import { StepsContext } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { EnhancePanel } from './EnhancePanel';

const OPTIONS: EnhanceOptions = {
  filter: 'grayscale',
  turns: 1,
  sharpen: 'soft',
};

/** A document with valid corners and the given adjustments, named after its id. */
function makeDocument(
  id: string,
  options: EnhanceOptions = OPTIONS,
): DocumentItem {
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
    options,
  };
}

interface Session {
  goTo: Mock<(step: Step) => void>;
  setOptions: Mock<(id: string, options: EnhanceOptions) => void>;
  applyOptionsToAll: Mock<(sourceId: string) => void>;
}

/**
 * Renders the panel in English at the Enhance step, with a session of the given documents, and
 * returns the mocks of the session operations the panel calls.
 */
function renderPanel(
  documents: DocumentItem[],
  active: DocumentItem,
  status: string = '600 × 800 px',
): Session {
  const session: Session = {
    goTo: vi.fn(),
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
  };
  const scan: ScanContextValue = {
    documents,
    active,
    invalidCount: 0,
    previews: {},
    importProgress: null,
    exportSettings: {
      format: 'pdf',
      pageFormat: 'a4',
      margins: 0,
      combine: true,
    },
    addFiles: vi.fn(async (): Promise<void> => {
      // Not used by this panel
    }),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners: vi.fn(),
    redetect: vi.fn(),
    setOptions: session.setOptions,
    applyOptionsToAll: session.applyOptionsToAll,
    setExportSettings: vi.fn(),
    restart: vi.fn(),
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
  render(
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <StepsContext.Provider value={{ step: 'enhance', goTo: session.goTo }}>
          <ScanContext.Provider value={scan}>
            <EnhancePanel status={status} />
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

describe('EnhancePanel', (): void => {
  it('shows the title and the render status as a live status', (): void => {
    const doc: DocumentItem = makeDocument('a');
    renderPanel([doc], doc, 'Document 1 of 1 · 600 × 800 px');

    expect(screen.getByRole('heading', { name: 'Adjust' })).toBeInTheDocument();
    const status: HTMLElement = screen.getByTestId('result-size');
    expect(status).toHaveTextContent('Document 1 of 1 · 600 × 800 px');
    expect(status).toHaveAttribute('role', 'status');
  });

  it('shows the adjustments of the document on display', (): void => {
    const first: DocumentItem = makeDocument('a', {
      ...OPTIONS,
      filter: 'none',
    });
    const second: DocumentItem = makeDocument('b', {
      ...OPTIONS,
      filter: 'bw',
      sharpen: 'strong',
    });
    renderPanel([first, second], second);

    expect(
      within(screen.getByRole('group', { name: 'Color' })).getByRole('radio', {
        name: 'Black and white',
      }),
    ).toBeChecked();
    expect(
      within(screen.getByRole('group', { name: 'Sharpness' })).getByRole(
        'radio',
        { name: 'Strong' },
      ),
    ).toBeChecked();
  });

  it('saves a changed adjustment on the document on display', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const first: DocumentItem = makeDocument('a');
    const second: DocumentItem = makeDocument('b');
    const session: Session = renderPanel([first, second], second);

    await user.click(screen.getByRole('button', { name: 'Right' }));

    expect(session.setOptions).toHaveBeenCalledExactlyOnceWith('b', {
      ...OPTIONS,
      turns: 2,
    });
  });

  it('has no "apply to all" with a single document', (): void => {
    const doc: DocumentItem = makeDocument('a');
    renderPanel([doc], doc);

    expect(screen.queryByTestId('apply-all')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'Keeps the other adjustments and only changes the rotation in this document.',
      ),
    ).not.toBeInTheDocument();
  });

  it('offers "apply to all" with several documents, explaining what it keeps', (): void => {
    const docs: DocumentItem[] = [makeDocument('a'), makeDocument('b')];
    renderPanel(docs, docs[0]);

    expect(screen.getByTestId('apply-all')).toHaveTextContent(
      'Apply to all documents',
    );
    expect(
      screen.getByText(
        'Keeps the other adjustments and only changes the rotation in this document.',
      ),
    ).toBeInTheDocument();
  });

  it('copies the adjustments of the document on display to the others and confirms with the count', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const docs: DocumentItem[] = [
      makeDocument('a'),
      makeDocument('b'),
      makeDocument('c'),
    ];
    const session: Session = renderPanel(docs, docs[1]);

    await user.click(screen.getByTestId('apply-all'));

    expect(session.applyOptionsToAll).toHaveBeenCalledExactlyOnceWith('b');
    expect(toasts()).toEqual([
      'success: The adjustments were applied to all 3 documents.',
    ]);
  });

  it('shows a single confirmation however many times it is applied', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const docs: DocumentItem[] = [makeDocument('a'), makeDocument('b')];
    const session: Session = renderPanel(docs, docs[0]);

    await user.click(screen.getByTestId('apply-all'));
    await user.click(screen.getByTestId('apply-all'));

    expect(session.applyOptionsToAll).toHaveBeenCalledTimes(2);
    expect(toasts()).toEqual([
      'success: The adjustments were applied to all 2 documents.',
    ]);
  });

  it('continues to the Export step', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const doc: DocumentItem = makeDocument('a');
    const session: Session = renderPanel([doc], doc);

    await user.click(screen.getByTestId('continue'));

    expect(session.goTo).toHaveBeenCalledExactlyOnceWith('export');
  });

  it('goes back to the Crop step', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const doc: DocumentItem = makeDocument('a');
    const session: Session = renderPanel([doc], doc);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(session.goTo).toHaveBeenCalledExactlyOnceWith('crop');
  });
});
