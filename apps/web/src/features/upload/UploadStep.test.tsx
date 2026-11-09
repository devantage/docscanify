import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import type { JSX } from 'react';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { CameraProvider } from '@/features/camera/CameraProvider';
import { useCamera } from '@/features/camera/useCamera';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { useScan } from '@/features/scan/useScan';
import { StepsProvider, useSteps } from '@/features/steps';
import { TranslateProvider } from '@/i18n';
import { DEFAULT_EXPORT_SETTINGS } from '@/lib/export';
import type { DocumentItem } from '@/lib/types';

import { UploadStep } from './UploadStep';

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

function makeDocument(id: string): DocumentItem {
  return {
    id,
    source: {
      image: new Image(),
      url: `blob:source-${id}`,
      name: id,
      scannedDocument: {} as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  };
}

function imageFile(name: string): File {
  return new File(['x'], name, { type: 'image/png' });
}

interface ScanSpies {
  addFiles: Mock<(files: File[]) => Promise<void>>;
  removeDocument: Mock<(id: string) => void>;
  reorder: Mock<(from: number, to: number) => void>;
}

function mockScan(documents: DocumentItem[]): ScanSpies {
  const spies: ScanSpies = {
    addFiles: vi
      .fn<(files: File[]) => Promise<void>>()
      .mockResolvedValue(undefined),
    removeDocument: vi.fn<(id: string) => void>(),
    reorder: vi.fn<(from: number, to: number) => void>(),
  };
  const value: ScanContextValue = {
    documents,
    active: documents[0] ?? null,
    invalidCount: 0,
    previews: {},
    importProgress: null,
    exportSettings: DEFAULT_EXPORT_SETTINGS,
    ...spies,
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
  return spies;
}

/** Shows the step and whether the camera is open, which UploadStep changes. */
function Probe(): JSX.Element {
  const { step } = useSteps();
  const { isOpen } = useCamera();
  return (
    <output data-testid="probe">
      {step}/{isOpen ? 'camera' : 'no-camera'}
    </output>
  );
}

function renderStep(): { container: HTMLElement } {
  return render(
    <TranslateProvider>
      <StepsProvider>
        <CameraProvider>
          <UploadStep />
          <Probe />
        </CameraProvider>
      </StepsProvider>
    </TranslateProvider>,
  );
}

describe('UploadStep', (): void => {
  beforeEach((): void => {
    // jsdom does not implement scrolling, which the carousel uses
    Object.defineProperty(Element.prototype, 'scrollTo', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
  });

  afterEach((): void => {
    Reflect.deleteProperty(Element.prototype, 'scrollTo');
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  describe('without documents', (): void => {
    it('shows the empty state and no carousel', (): void => {
      mockScan([]);
      renderStep();

      expect(
        screen.getByRole('heading', {
          name: 'Take photos or upload images of your documents',
        }),
      ).toBeInTheDocument();
      expect(screen.getByTestId('upload-camera')).toBeInTheDocument();
      expect(screen.getByTestId('upload-files')).toBeInTheDocument();
      expect(
        screen.queryByRole('list', { name: 'Documents' }),
      ).not.toBeInTheDocument();
      expect(screen.queryByTestId('upload-continue')).not.toBeInTheDocument();
    });

    it('imports the chosen images', async (): Promise<void> => {
      const { addFiles } = mockScan([]);
      const user: UserEvent = userEvent.setup();
      renderStep();
      const files: File[] = [imageFile('a.png'), imageFile('b.png')];

      await user.upload(screen.getByTestId('file-input'), files);

      expect(addFiles).toHaveBeenCalledTimes(1);
      expect(addFiles).toHaveBeenCalledWith(files);
    });

    it('opens the camera from Take photo, staying on the Upload step', async (): Promise<void> => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn() },
      });
      mockScan([]);
      const user: UserEvent = userEvent.setup();
      renderStep();
      expect(screen.getByTestId('probe')).toHaveTextContent('upload/no-camera');

      await user.click(screen.getByTestId('upload-camera'));

      expect(screen.getByTestId('probe')).toHaveTextContent('upload/camera');
    });

    it('highlights the card while images are dragged over the screen', (): void => {
      mockScan([]);
      const { container } = renderStep();
      const screenArea: Element | null =
        container.querySelector('.upload-screen');
      if (!screenArea) throw new Error('upload screen not rendered');

      fireEvent.dragOver(screenArea);
      expect(container.querySelector('.add-card')).toHaveClass('is-over');

      fireEvent.dragLeave(screenArea);
      expect(container.querySelector('.add-card')).not.toHaveClass('is-over');
    });

    it('imports images dropped anywhere on the screen', (): void => {
      const { addFiles } = mockScan([]);
      const { container } = renderStep();
      const screenArea: Element | null =
        container.querySelector('.upload-screen');
      if (!screenArea) throw new Error('upload screen not rendered');
      const files: File[] = [imageFile('dropped.png')];

      fireEvent.drop(screenArea, { dataTransfer: { files } });

      expect(addFiles).toHaveBeenCalledTimes(1);
      expect(addFiles).toHaveBeenCalledWith(files);
    });

    it('ignores a drop without files', (): void => {
      const { addFiles } = mockScan([]);
      const { container } = renderStep();
      const screenArea: Element | null =
        container.querySelector('.upload-screen');
      if (!screenArea) throw new Error('upload screen not rendered');

      fireEvent.drop(screenArea, { dataTransfer: { files: [] } });

      expect(addFiles).not.toHaveBeenCalled();
    });
  });

  describe('with documents', (): void => {
    it('titles a single image in the singular', (): void => {
      mockScan([makeDocument('a')]);
      renderStep();

      expect(
        screen.getByRole('heading', { level: 1, name: 'You uploaded 1 image' }),
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          'You can add, remove, or drag to reorder in the list below.',
        ),
      ).toBeInTheDocument();
    });

    it('titles several images in the plural, with the count', (): void => {
      mockScan([makeDocument('a'), makeDocument('b'), makeDocument('c')]);
      renderStep();

      expect(
        screen.getByRole('heading', {
          level: 1,
          name: 'You uploaded 3 images',
        }),
      ).toBeInTheDocument();
    });

    it('shows the documents in the large carousel, not selectable, instead of the empty state', (): void => {
      mockScan([makeDocument('a'), makeDocument('b')]);
      const { container } = renderStep();

      const list: HTMLElement = screen.getByRole('list', {
        name: 'Documents',
      });
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
      expect(screen.getByRole('img', { name: 'Document 1' })).toBeVisible();
      expect(screen.getByRole('img', { name: 'Document 2' })).toBeVisible();
      expect(container.querySelector('.doc-carousel')).toHaveClass('is-large');
      expect(screen.queryByTestId('upload-camera')).not.toBeInTheDocument();
    });

    it('continues to the Crop step', async (): Promise<void> => {
      mockScan([makeDocument('a')]);
      const user: UserEvent = userEvent.setup();
      renderStep();

      await user.click(screen.getByRole('button', { name: 'Continue' }));

      expect(screen.getByTestId('probe')).toHaveTextContent('crop/no-camera');
    });

    it('removes a document from its tile', async (): Promise<void> => {
      const { removeDocument } = mockScan([
        makeDocument('a'),
        makeDocument('b'),
      ]);
      const user: UserEvent = userEvent.setup();
      renderStep();

      await user.click(
        screen.getByRole('button', { name: 'Remove document 2' }),
      );

      expect(removeDocument).toHaveBeenCalledWith('b');
    });

    it('reorders with Alt + arrows', (): void => {
      const { reorder } = mockScan([makeDocument('a'), makeDocument('b')]);
      renderStep();

      fireEvent.keyDown(screen.getByTestId('doc-1'), {
        key: 'ArrowLeft',
        altKey: true,
      });

      expect(reorder).toHaveBeenCalledWith(1, 0);
    });

    it('adds images from the carousel', async (): Promise<void> => {
      const { addFiles } = mockScan([makeDocument('a')]);
      const user: UserEvent = userEvent.setup();
      renderStep();
      const files: File[] = [imageFile('more.png')];

      await user.upload(screen.getByTestId('file-input'), files);

      expect(addFiles).toHaveBeenCalledWith(files);
    });

    it('imports a drop on the carousel only once', (): void => {
      const { addFiles } = mockScan([makeDocument('a')]);
      renderStep();
      const files: File[] = [imageFile('dropped.png')];

      fireEvent.drop(screen.getByRole('list', { name: 'Documents' }), {
        dataTransfer: { files },
      });

      expect(addFiles).toHaveBeenCalledTimes(1);
      expect(addFiles).toHaveBeenCalledWith(files);
    });

    it('opens the camera from the add tile', async (): Promise<void> => {
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn() },
      });
      mockScan([makeDocument('a')]);
      const user: UserEvent = userEvent.setup();
      renderStep();

      await user.click(screen.getByTestId('add-camera'));

      expect(screen.getByTestId('probe')).toHaveTextContent('upload/camera');
    });
  });
});
