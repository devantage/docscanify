import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, type Mock, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import {
  ScanContext,
  type ScanContextValue,
} from '@/features/scan/ScanContext';
import type { Step } from '@/features/steps';
import { StepsContext } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { CropStep } from './CropStep';

/** Props the Crop step passes to the corner editor, captured by its stand-in. */
interface EditorProps {
  corners: Corners;
  source: { url: string };
  onChange(corners: Corners): void;
  onDraggingChange?(dragging: boolean): void;
}

const MOVED: Corners = {
  topLeft: { x: 5, y: 6 },
  topRight: { x: 95, y: 4 },
  bottomRight: { x: 97, y: 96 },
  bottomLeft: { x: 3, y: 98 },
};

// The editor is covered by its own tests; here a stand-in exposes what the step wires to it
vi.mock('./CornerEditor', (): Record<string, unknown> => ({
  CornerEditor: (props: EditorProps): JSX.Element => (
    <div
      data-testid="corner-editor"
      data-corners={JSON.stringify(props.corners)}
      data-url={props.source.url}
    >
      <button
        type="button"
        onClick={(): void => {
          props.onChange(MOVED);
        }}
      >
        move corner
      </button>
      <button
        type="button"
        onClick={(): void => {
          props.onDraggingChange?.(true);
        }}
      >
        start drag
      </button>
      <button
        type="button"
        onClick={(): void => {
          props.onDraggingChange?.(false);
        }}
      >
        end drag
      </button>
    </div>
  ),
}));

// The carousel needs the camera and the thumbnails, which are not part of this step
vi.mock('@/features/scan/DocumentStrip', (): Record<string, unknown> => ({
  DocumentStrip: (): JSX.Element => <div data-testid="document-strip" />,
}));

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomRight: { x: 100, y: 100 },
  bottomLeft: { x: 0, y: 100 },
};

const CROSSED: string =
  'The corners are crossed. Drag them to form a quadrilateral.';

/** A document with valid corners and no adjustments, changed by `overrides`. */
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
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
    ...overrides,
  };
}

interface Session {
  scan: ScanContextValue;
  goTo: Mock<(step: Step) => void>;
  redetect: Mock<(id: string) => void>;
  setCorners: Mock<(id: string, corners: Corners) => void>;
  setDraggingCorner: Mock<(dragging: boolean) => void>;
}

/**
 * A scan session with `doc` as its only document and on display, and spies for what the step
 * calls.
 *
 * @param invalidCount How many documents the session reports with invalid corners.
 */
function makeSession(doc: DocumentItem, invalidCount: number = 0): Session {
  const redetect: Mock<(id: string) => void> = vi.fn();
  const setCorners: Mock<(id: string, corners: Corners) => void> = vi.fn();
  const setDraggingCorner: Mock<(dragging: boolean) => void> = vi.fn();
  const scan: ScanContextValue = {
    documents: [doc],
    active: doc,
    invalidCount,
    previews: {},
    importProgress: null,
    exportSettings: {
      format: 'pdf',
      pageFormat: 'a4',
      margin: 0,
      combine: true,
    },
    addFiles: vi.fn(async (): Promise<void> => {
      // Not used by this step
    }),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners,
    redetect,
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
    setExportSettings: vi.fn(),
    restart: vi.fn(),
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner,
  };
  return {
    scan,
    goTo: vi.fn(),
    redetect,
    setCorners,
    setDraggingCorner,
  };
}

/** Renders the Crop step in English, with the session and a spy `goTo` as its contexts. */
function renderStep(session: Session): void {
  render(
    <TranslateProvider defaultLocale="en">
      <ToastProvider>
        <StepsContext.Provider value={{ step: 'crop', goTo: session.goTo }}>
          <ScanContext.Provider value={session.scan}>
            <CropStep />
          </ScanContext.Provider>
        </StepsContext.Provider>
      </ToastProvider>
    </TranslateProvider>,
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

describe('CropStep', (): void => {
  it('shows the corner editor of the document on display, with its instructions', (): void => {
    renderStep(makeSession(makeDocument()));

    expect(screen.getByRole('region', { name: 'Crop' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Crop' })).toBeInTheDocument();
    expect(screen.getByTestId('detect-status')).toHaveTextContent(
      'Move the corners to frame the part of the image you want to scan',
    );
    const editor: HTMLElement = screen.getByTestId('corner-editor');
    expect(editor.dataset.corners).toBe(JSON.stringify(CORNERS));
    expect(editor.dataset.url).toBe('blob:doc-1');
    expect(screen.getByTestId('document-strip')).toBeInTheDocument();
  });

  it('shows the detector error instead of the editor when the document has no corners', (): void => {
    renderStep(
      makeSession(
        makeDocument({ corners: null, valid: false, detectorFailed: true }),
        1,
      ),
    );

    expect(screen.queryByTestId('corner-editor')).not.toBeInTheDocument();
    expect(screen.queryByTestId('detect-status')).not.toBeInTheDocument();
    expect(
      screen.getByText('The edge detector could not be loaded', {
        selector: '.stage-status',
      }),
    ).toBeInTheDocument();
  });

  it('saves the corners moved in the editor on the document on display', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument({ id: 'doc-7' }));
    renderStep(session);

    await user.click(screen.getByRole('button', { name: 'move corner' }));

    expect(session.setCorners).toHaveBeenCalledExactlyOnceWith('doc-7', MOVED);
  });

  it('detects the corners again on "Detect automatically"', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument({ id: 'doc-3' }));
    renderStep(session);

    const button: HTMLElement = screen.getByTestId('auto-detect');
    expect(button).toHaveTextContent('Detect automatically');
    await user.click(button);

    expect(session.redetect).toHaveBeenCalledExactlyOnceWith('doc-3');
  });

  it('detects the corners again on Ctrl + Z and on Cmd + Z', (): void => {
    const session: Session = makeSession(makeDocument({ id: 'doc-3' }));
    renderStep(session);

    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    fireEvent.keyDown(window, { key: 'Z', metaKey: true });

    expect(session.redetect.mock.calls).toEqual([['doc-3'], ['doc-3']]);
  });

  it('ignores Z without a modifier, with Shift (redo), or held down', (): void => {
    const session: Session = makeSession(makeDocument());
    renderStep(session);

    fireEvent.keyDown(window, { key: 'z' });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true, repeat: true });

    expect(session.redetect).not.toHaveBeenCalled();
  });

  it('prevents the browser undo on the shortcut', (): void => {
    renderStep(makeSession(makeDocument()));

    const notCancelled: boolean = fireEvent.keyDown(window, {
      key: 'z',
      ctrlKey: true,
    });

    expect(notCancelled).toBe(false);
  });

  it('continues to the Adjust step when every document is valid', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument(), 0);
    renderStep(session);

    const next: HTMLElement = screen.getByTestId('crop');
    expect(next).toBeEnabled();
    expect(next).toHaveTextContent('Continue');
    await user.click(next);

    expect(session.goTo).toHaveBeenCalledExactlyOnceWith('enhance');
  });

  it('blocks Continue while any document has invalid corners, even a valid one on display', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument(), 1);
    renderStep(session);

    const next: HTMLElement = screen.getByTestId('crop');
    expect(next).toBeDisabled();
    await user.click(next);

    expect(session.goTo).not.toHaveBeenCalled();
  });

  it('goes back to the Upload step', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument(), 1);
    renderStep(session);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(session.goTo).toHaveBeenCalledExactlyOnceWith('upload');
  });

  it('reports corner drags to the session, to pause the thumbnails', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument());
    renderStep(session);

    await user.click(screen.getByRole('button', { name: 'start drag' }));
    await user.click(screen.getByRole('button', { name: 'end drag' }));

    expect(session.setDraggingCorner.mock.calls).toEqual([[true], [false]]);
  });

  it('shows the crossed-corners error when a drag ends with crossed corners', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    const session: Session = makeSession(makeDocument({ valid: false }), 1);
    renderStep(session);
    // Shown when the document opens; closed by the user
    expect(toasts()).toEqual([`error: ${CROSSED}`]);
    await user.click(screen.getByRole('button', { name: 'Close message' }));

    await user.click(screen.getByRole('button', { name: 'start drag' }));
    expect(toasts()).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'end drag' }));

    expect(toasts()).toEqual([`error: ${CROSSED}`]);
  });

  it('warns about the documents that need a crop fix', (): void => {
    renderStep(makeSession(makeDocument(), 2));

    expect(toasts()).toEqual([
      'warning: 2 documents need a crop fix. They are marked with ! in the list.',
    ]);
  });
});
