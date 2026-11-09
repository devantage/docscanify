import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import { detectCrop } from '@/features/documents/detectCrop';
import { usePreviews } from '@/features/documents/usePreviews';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { ScanProvider } from '@/features/scan/ScanProvider';
import { useScan } from '@/features/scan/useScan';
import { type Step, StepsProvider, useSteps } from '@/features/steps';
import type { StepsContextValue } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import { sourceFromFile } from '@/lib/image';
import type { DocumentItem } from '@/lib/types';

import type { CameraContextValue } from './CameraContext';
import { CameraLayer } from './CameraLayer';
import { CameraProvider } from './CameraProvider';
import { useCamera } from './useCamera';

// The camera itself (video, shutter) is covered by its own tests and end to end; here, a stand-in
// that finishes with two photos or goes back
vi.mock('./CameraCapture', () => ({
  CameraCapture: ({
    onDone,
    onCancel,
  }: {
    onDone(photos: File[]): void;
    onCancel(): void;
  }): JSX.Element => (
    <div data-testid="camera-capture">
      <button
        type="button"
        onClick={() => {
          onDone([
            new File(['1'], 'photo-1.png', { type: 'image/png' }),
            new File(['2'], 'photo-2.png', { type: 'image/png' }),
          ]);
        }}
      >
        Done
      </button>
      <button type="button" onClick={onCancel}>
        Back
      </button>
    </div>
  ),
}));
vi.mock('@/lib/loading', () => ({
  MIN_LOADING_MS: 0,
  PAINT_DELAY: 0,
  waitForPaint: async (): Promise<void> => Promise.resolve(),
  withMinDuration: async <T,>(work: () => Promise<T>): Promise<T> => work(),
}));
vi.mock('@/lib/image', () => ({ sourceFromFile: vi.fn() }));
vi.mock('@/lib/scan', () => ({
  NO_ENHANCEMENTS: {
    filter: 'none',
    turns: 0,
    sharpen: 'off',
    denoise: false,
  },
}));
vi.mock('@/features/documents/detectCrop', () => ({ detectCrop: vi.fn() }));
vi.mock('@/features/documents/usePreviews', () => ({ usePreviews: vi.fn() }));

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 10, y: 0 },
  bottomRight: { x: 10, y: 10 },
  bottomLeft: { x: 0, y: 10 },
};

interface Session {
  scan: ScanContextValue | null;
  steps: StepsContextValue | null;
  camera: CameraContextValue | null;
}

const session: Session = { scan: null, steps: null, camera: null };

/**
 * The workspace, as `CurrentStep` shows it: the camera over the step while it is open. It also
 * keeps the scan, steps, and camera contexts in `session`, for the tests to read.
 */
function Workspace(): JSX.Element {
  session.scan = useScan();
  session.steps = useSteps();
  session.camera = useCamera();
  return session.camera.isOpen ? (
    <CameraLayer />
  ) : (
    <p data-testid="step">{session.steps.step}</p>
  );
}

/** Renders the workspace inside every provider the camera and the scan session need. */
function renderApp(): void {
  render(
    <TranslateProvider>
      <ToastProvider>
        <StepsProvider>
          <CameraProvider>
            <ScanProvider>
              <Workspace />
            </ScanProvider>
          </CameraProvider>
        </StepsProvider>
      </ToastProvider>
    </TranslateProvider>,
  );
}

/**
 * The contexts the workspace rendered last.
 *
 * @throws When the app is not rendered.
 */
function current(): {
  scan: ScanContextValue;
  steps: StepsContextValue;
  camera: CameraContextValue;
} {
  const { scan, steps, camera } = session;
  if (!scan || !steps || !camera) throw new Error('The app is not rendered');
  return { scan, steps, camera };
}

/** File names of the documents in the session, in list order. */
const names = (): string[] =>
  current().scan.documents.map((d: DocumentItem) => d.source.name);

/** Starts a session with one uploaded image, then opens the camera over the given step. */
async function openCameraOver(step: Step): Promise<void> {
  await act(async () => {
    await current().scan.addFiles([
      new File(['0'], 'upload.png', { type: 'image/png' }),
    ]);
  });
  act(() => {
    current().steps.goTo(step);
  });
  act(() => {
    current().camera.open();
  });
}

describe('CameraLayer', (): void => {
  beforeEach((): void => {
    vi.mocked(usePreviews).mockReturnValue({});
    vi.mocked(sourceFromFile).mockImplementation(async (f: File) =>
      Promise.resolve({
        image: new Image(),
        url: `blob:${f.name}`,
        name: f.name.replace(/\.png$/, ''),
        scannedDocument: {} as ScannedDocument,
      }),
    );
    vi.mocked(detectCrop).mockResolvedValue({
      corners: CORNERS,
      valid: true,
      detectorFailed: false,
    });
    renderApp();
  });

  afterEach((): void => {
    session.scan = null;
    session.steps = null;
    session.camera = null;
    vi.mocked(usePreviews).mockReset();
    vi.mocked(sourceFromFile).mockReset();
    vi.mocked(detectCrop).mockReset();
  });

  it('shows the camera over the step', async (): Promise<void> => {
    await openCameraOver('enhance');

    expect(screen.getByTestId('camera-capture')).toBeInTheDocument();
    expect(screen.queryByTestId('step')).not.toBeInTheDocument();
    expect(current().steps.step).toBe('enhance');
  });

  it.each(['upload', 'crop', 'enhance', 'export'] as const)(
    'goes back to the %s step without importing anything',
    async (step: Step): Promise<void> => {
      await openCameraOver(step);

      await userEvent.click(screen.getByRole('button', { name: 'Back' }));

      expect(current().camera.isOpen).toBe(false);
      expect(screen.getByTestId('step')).toHaveTextContent(step);
      expect(names()).toEqual(['upload']);
    },
  );

  it.each(['crop', 'enhance', 'export'] as const)(
    'from the %s step, Done imports the photos and goes to Crop with the first photo on display',
    async (step: Step): Promise<void> => {
      await openCameraOver(step);

      await userEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(current().camera.isOpen).toBe(false);
      expect(await screen.findByText('crop')).toBeInTheDocument();
      expect(names()).toEqual(['upload', 'photo-1', 'photo-2']);
      expect(current().scan.active?.source.name).toBe('photo-1');
    },
  );

  it('from the Upload step, Done imports the photos and stays there', async (): Promise<void> => {
    await openCameraOver('upload');

    await userEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(current().camera.isOpen).toBe(false);
    await waitFor((): void => {
      expect(names()).toEqual(['upload', 'photo-1', 'photo-2']);
    });
    expect(screen.getByTestId('step')).toHaveTextContent('upload');
    expect(current().scan.active?.source.name).toBe('photo-1');
  });
});
