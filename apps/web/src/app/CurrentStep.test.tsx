import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { render, screen } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { CameraProvider } from '@/features/camera/CameraProvider';
import { useCamera } from '@/features/camera/useCamera';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { useScan } from '@/features/scan/useScan';
import { type Step, StepsProvider, useSteps } from '@/features/steps';
import { DEFAULT_EXPORT_SETTINGS } from '@/lib/export';
import type { DocumentItem } from '@/lib/types';

import { CurrentStep } from './CurrentStep';

// Each step is covered by its own tests; here they only need to be told apart
vi.mock('@/features/camera/CameraLayer', () => ({
  CameraLayer: (): JSX.Element => <div data-testid="camera-layer" />,
}));
vi.mock('@/features/upload/UploadStep', () => ({
  UploadStep: (): JSX.Element => <div data-testid="upload-step" />,
}));
vi.mock('@/features/crop/CropStep', () => ({
  CropStep: (): JSX.Element => <div data-testid="crop-step" />,
}));
vi.mock('@/features/result/ResultSteps', () => ({
  ResultSteps: (): JSX.Element => <div data-testid="result-steps" />,
}));
vi.mock('@/features/scan/useScan', () => ({
  useScan: vi.fn(),
  useActiveDocument: vi.fn(),
}));

const CORNERS: Corners = {
  topLeft: { x: 0, y: 0 },
  topRight: { x: 100, y: 0 },
  bottomLeft: { x: 0, y: 100 },
  bottomRight: { x: 100, y: 100 },
};

function makeDocument(corners: Corners | null): DocumentItem {
  return {
    id: 'doc',
    source: {
      image: new Image(),
      url: 'blob:doc',
      name: 'doc',
      scannedDocument: {} as ScannedDocument,
    },
    corners,
    valid: corners !== null,
    detectorFailed: corners === null,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  };
}

function mockActive(active: DocumentItem | null): void {
  const value: ScanContextValue = {
    documents: active ? [active] : [],
    active,
    invalidCount: active?.corners ? 0 : 1,
    previews: {},
    importProgress: null,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    addFiles: vi.fn(),
    removeDocument: vi.fn(),
    reorder: vi.fn(),
    select: vi.fn(),
    setCorners: vi.fn(),
    redetect: vi.fn(),
    setOptions: vi.fn(),
    applyOptionsToAll: vi.fn(),
    setExportSettings: vi.fn(),
    restart: vi.fn(),
    dismissImportProgress: vi.fn(),
    setMainRender: vi.fn(),
    setDraggingCorner: vi.fn(),
  };
  vi.mocked(useScan).mockReturnValue(value);
}

/** Changes the step and the camera, as the top bar and the steps do. */
function Controls(): JSX.Element {
  const { goTo } = useSteps();
  const camera: ReturnType<typeof useCamera> = useCamera();
  const steps: Step[] = ['upload', 'crop', 'enhance', 'export'];
  return (
    <div>
      <button type="button" onClick={camera.open}>
        open-camera
      </button>
      <button type="button" onClick={camera.close}>
        close-camera
      </button>
      {steps.map((s: Step) => (
        <button
          key={s}
          type="button"
          onClick={(): void => {
            goTo(s);
          }}
        >
          {`go-${s}`}
        </button>
      ))}
    </div>
  );
}

function renderWorkspace(): { workspace: HTMLElement } {
  render(
    <StepsProvider>
      <CameraProvider>
        <main data-testid="workspace">
          <CurrentStep />
        </main>
        <Controls />
      </CameraProvider>
    </StepsProvider>,
  );
  return { workspace: screen.getByTestId('workspace') };
}

/** Test ids of what the workspace shows. */
function shown(workspace: HTMLElement): string[] {
  return Array.from(workspace.children).map(
    (child: Element) => child.getAttribute('data-testid') ?? '',
  );
}

async function openStep(user: UserEvent, step: Step): Promise<void> {
  await user.click(screen.getByRole('button', { name: `go-${step}` }));
}

describe('CurrentStep', (): void => {
  it('starts on the Upload step', (): void => {
    mockActive(null);
    const { workspace } = renderWorkspace();

    expect(shown(workspace)).toEqual(['upload-step']);
  });

  it('shows the Crop step with a document on display', async (): Promise<void> => {
    mockActive(makeDocument(CORNERS));
    const user: UserEvent = userEvent.setup();
    const { workspace } = renderWorkspace();

    await openStep(user, 'crop');

    expect(shown(workspace)).toEqual(['crop-step']);
  });

  it('shows nothing on Crop without a document', async (): Promise<void> => {
    mockActive(null);
    const user: UserEvent = userEvent.setup();
    const { workspace } = renderWorkspace();

    await openStep(user, 'crop');

    expect(shown(workspace)).toEqual([]);
  });

  it('shows Crop even when the document has no corners, so they can be set', async (): Promise<void> => {
    mockActive(makeDocument(null));
    const user: UserEvent = userEvent.setup();
    const { workspace } = renderWorkspace();

    await openStep(user, 'crop');

    expect(shown(workspace)).toEqual(['crop-step']);
  });

  it.each<Step>(['enhance', 'export'])(
    'shows the result steps on %s with a cropped document',
    async (step: Step): Promise<void> => {
      mockActive(makeDocument(CORNERS));
      const user: UserEvent = userEvent.setup();
      const { workspace } = renderWorkspace();

      await openStep(user, step);

      expect(shown(workspace)).toEqual(['result-steps']);
    },
  );

  it.each<Step>(['enhance', 'export'])(
    'shows nothing on %s when the document has no corners',
    async (step: Step): Promise<void> => {
      mockActive(makeDocument(null));
      const user: UserEvent = userEvent.setup();
      const { workspace } = renderWorkspace();

      await openStep(user, step);

      expect(shown(workspace)).toEqual([]);
    },
  );

  it.each<Step>(['enhance', 'export'])(
    'shows nothing on %s without a document',
    async (step: Step): Promise<void> => {
      mockActive(null);
      const user: UserEvent = userEvent.setup();
      const { workspace } = renderWorkspace();

      await openStep(user, step);

      expect(shown(workspace)).toEqual([]);
    },
  );

  it.each<Step>(['upload', 'crop', 'enhance', 'export'])(
    'shows only the camera while it is open, over %s',
    async (step: Step): Promise<void> => {
      mockActive(makeDocument(CORNERS));
      const user: UserEvent = userEvent.setup();
      const { workspace } = renderWorkspace();
      await openStep(user, step);

      await user.click(screen.getByRole('button', { name: 'open-camera' }));

      expect(shown(workspace)).toEqual(['camera-layer']);
    },
  );

  it('goes back to the step it covered when the camera closes', async (): Promise<void> => {
    mockActive(makeDocument(CORNERS));
    const user: UserEvent = userEvent.setup();
    const { workspace } = renderWorkspace();
    await openStep(user, 'crop');
    await user.click(screen.getByRole('button', { name: 'open-camera' }));

    await user.click(screen.getByRole('button', { name: 'close-camera' }));

    expect(shown(workspace)).toEqual(['crop-step']);
  });
});
