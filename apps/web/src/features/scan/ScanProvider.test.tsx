import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider } from '@/components/toast';
import type { CameraContextValue } from '@/features/camera/CameraContext';
import { CameraProvider } from '@/features/camera/CameraProvider';
import { useCamera } from '@/features/camera/useCamera';
import type { CropState } from '@/features/documents/detectCrop';
import { detectCrop } from '@/features/documents/detectCrop';
import {
  type CurrentRender,
  type Preview,
  type PreviewMode,
  usePreviews,
} from '@/features/documents/usePreviews';
import { type Step, StepsProvider, useSteps } from '@/features/steps';
import type { StepsContextValue } from '@/features/steps/StepsContext';
import { TranslateProvider } from '@/i18n';
import { sourceFromFile } from '@/lib/image';
import type {
  DocumentItem,
  EnhanceOptions,
  ExportSettings,
  SourceImage,
} from '@/lib/types';

import type { ScanContextValue } from './ScanContext';
import { ScanProvider } from './ScanProvider';
import { useScan } from './useScan';

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
  },
}));
vi.mock('@/features/documents/detectCrop', () => ({ detectCrop: vi.fn() }));
vi.mock('@/features/documents/usePreviews', () => ({ usePreviews: vi.fn() }));

const DEFAULT_SETTINGS: ExportSettings = {
  format: 'pdf',
  pageFormat: 'a4',
  margins: 0,
  combine: true,
};

/** Valid corners of a square with sides of `size` px at the origin. */
const square = (size: number): Corners => ({
  topLeft: { x: 0, y: 0 },
  topRight: { x: size, y: 0 },
  bottomRight: { x: size, y: size },
  bottomLeft: { x: 0, y: size },
});

/** A PNG file named `<name>.png`; its content does not matter, image decoding is mocked. */
const file = (name: string): File =>
  new File(['x'], `${name}.png`, { type: 'image/png' });

/**
 * Crop detected for each image: `crossed*` images get crossed corners and `blind*` images a
 * detector that could not be loaded.
 */
const cropOf = (source: SourceImage): CropState => {
  if (source.name.startsWith('crossed'))
    return { corners: square(5), valid: false, detectorFailed: false };
  if (source.name.startsWith('blind'))
    return { corners: null, valid: false, detectorFailed: true };
  return { corners: square(10), valid: true, detectorFailed: false };
};

interface Session {
  scan: ScanContextValue | null;
  steps: StepsContextValue | null;
  camera: CameraContextValue | null;
}

const session: Session = { scan: null, steps: null, camera: null };

/** Renders nothing; keeps the session, steps, and camera in {@link session} for the tests. */
function Probe(): null {
  session.scan = useScan();
  session.steps = useSteps();
  session.camera = useCamera();
  return null;
}

/** Renders the session inside the providers it depends on, nested as in the app. */
function renderSession(): void {
  render(
    <TranslateProvider>
      <ToastProvider>
        <StepsProvider>
          <CameraProvider>
            <ScanProvider>
              <Probe />
            </ScanProvider>
          </CameraProvider>
        </StepsProvider>
      </ToastProvider>
    </TranslateProvider>,
  );
}

/** The rendered session. Throws before {@link renderSession}. */
function scan(): ScanContextValue {
  if (!session.scan) throw new Error('The session is not rendered');
  return session.scan;
}

/** The step on display. Throws before {@link renderSession}. */
function currentStep(): Step {
  if (!session.steps) throw new Error('The session is not rendered');
  return session.steps.step;
}

/** Moves to a step, as the top bar does. */
function goTo(step: Step): void {
  act(() => {
    session.steps?.goTo(step);
  });
}

/**
 * Imports one image per name through the session and waits for the import to end. Names
 * starting with `bad` fail to open; see {@link cropOf} for the crop of the others.
 */
async function addFiles(...names: string[]): Promise<void> {
  await act(async () => {
    await scan().addFiles(names.map(file));
  });
}

/** Names of the documents, in list order. */
const names = (): string[] =>
  scan().documents.map((d: DocumentItem) => d.source.name);

/** Arguments of the last call to the mocked {@link usePreviews}; throws when never called. */
const lastPreviews = (): Parameters<typeof usePreviews> => {
  const call: Parameters<typeof usePreviews> | undefined = vi
    .mocked(usePreviews)
    .mock.calls.at(-1);
  if (!call) throw new Error('usePreviews was not called');
  return call;
};

/** The toasts on screen, in order, with their kind and text. */
const toasts = (): { kind: string | null; text: string }[] =>
  screen.queryAllByTestId('toast').map((el: HTMLElement) => ({
    kind: el.getAttribute('data-kind'),
    text: el.textContent,
  }));

describe('ScanProvider', (): void => {
  beforeEach((): void => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.mocked(usePreviews).mockReturnValue({});
    vi.mocked(sourceFromFile).mockImplementation(async (f: File) => {
      const name: string = f.name.replace(/\.png$/, '');
      if (name.startsWith('bad'))
        return Promise.reject(new Error(`Could not open ${f.name}`));
      return Promise.resolve({
        image: new Image(),
        url: `blob:${name}`,
        name,
        scannedDocument: {} as ScannedDocument,
      });
    });
    vi.mocked(detectCrop).mockImplementation(async (source: SourceImage) =>
      Promise.resolve(cropOf(source)),
    );
    renderSession();
  });

  afterEach((): void => {
    session.scan = null;
    session.steps = null;
    session.camera = null;
    vi.mocked(usePreviews).mockReset();
    vi.mocked(sourceFromFile).mockReset();
    vi.mocked(detectCrop).mockReset();
  });

  it('starts at the Upload step with no documents and the default export settings', (): void => {
    expect(currentStep()).toBe('upload');
    expect(scan().documents).toEqual([]);
    expect(scan().active).toBeNull();
    expect(scan().invalidCount).toBe(0);
    expect(scan().importProgress).toBeNull();
    expect(scan().exportSettings).toEqual(DEFAULT_SETTINGS);
  });

  describe('addFiles', (): void => {
    it('stays at the Upload step and selects the first new document', async (): Promise<void> => {
      await addFiles('a', 'b');
      expect(currentStep()).toBe('upload');
      expect(names()).toEqual(['a', 'b']);
      expect(scan().active?.source.name).toBe('a');

      await addFiles('c', 'd');
      expect(currentStep()).toBe('upload');
      expect(names()).toEqual(['a', 'b', 'c', 'd']);
      expect(scan().active?.source.name).toBe('c');
    });

    it.each(['crop', 'enhance', 'export'] as const)(
      'from the %s step, goes to Crop with the first new document selected',
      async (step: Step): Promise<void> => {
        await addFiles('a', 'b');
        goTo(step);
        act(() => {
          scan().select(scan().documents[1].id);
        });

        await addFiles('c', 'd');

        expect(currentStep()).toBe('crop');
        expect(names()).toEqual(['a', 'b', 'c', 'd']);
        expect(scan().active?.source.name).toBe('c');
      },
    );

    it('shows an error and changes nothing when no file can be opened', async (): Promise<void> => {
      await addFiles('a');
      goTo('enhance');

      await addFiles('bad1', 'bad2');

      expect(toasts()).toEqual([
        {
          kind: 'error',
          text: 'None of the 2 files could be opened. Upload JPG, PNG, or WebP images.',
        },
      ]);
      expect(currentStep()).toBe('enhance');
      expect(names()).toEqual(['a']);
    });

    it('warns about the files that failed and adds the others', async (): Promise<void> => {
      goTo('export');

      await addFiles('bad', 'good', 'fine');

      expect(toasts()).toEqual([
        { kind: 'warning', text: '1 file could not be opened.' },
      ]);
      expect(names()).toEqual(['good', 'fine']);
      expect(currentStep()).toBe('crop');
    });

    it('shows no notice when every file is imported', async (): Promise<void> => {
      await addFiles('a', 'b');

      expect(toasts()).toEqual([]);
    });

    it('replaces the notice of the previous import', async (): Promise<void> => {
      await addFiles('bad');
      expect(toasts()).toHaveLength(1);

      await addFiles('bad1', 'ok');
      expect(toasts()).toEqual([
        { kind: 'warning', text: '1 file could not be opened.' },
      ]);

      await addFiles('ok2');
      expect(toasts()).toEqual([]);
    });

    it('keeps the finished import progress until it is dismissed', async (): Promise<void> => {
      await addFiles('a');
      expect(scan().importProgress).toEqual({
        phase: 'detecting',
        current: 1,
        total: 1,
        value: 1,
      });

      act(() => {
        scan().dismissImportProgress();
      });
      expect(scan().importProgress).toBeNull();
    });
  });

  describe('removeDocument', (): void => {
    it('stays in the step while documents are left', async (): Promise<void> => {
      await addFiles('a', 'b');
      goTo('export');

      act(() => {
        scan().removeDocument(scan().documents[0].id);
      });

      expect(currentStep()).toBe('export');
      expect(names()).toEqual(['b']);
    });

    it('goes back to Upload when the last document is removed', async (): Promise<void> => {
      await addFiles('a');
      goTo('enhance');

      act(() => {
        scan().removeDocument(scan().documents[0].id);
      });

      expect(currentStep()).toBe('upload');
      expect(scan().documents).toEqual([]);
      expect(scan().active).toBeNull();
    });
  });

  it('counts the documents without corners or with crossed corners', async (): Promise<void> => {
    await addFiles('ok', 'crossed', 'blind', 'fine');

    expect(scan().invalidCount).toBe(2);
  });

  it('updates the invalid count when the corners are fixed', async (): Promise<void> => {
    await addFiles('ok', 'crossed');
    const crossed: DocumentItem = scan().documents[1];

    act(() => {
      scan().setCorners(crossed.id, square(20));
    });

    expect(scan().invalidCount).toBe(0);
    expect(scan().documents[1].corners).toEqual(square(20));
  });

  it('detects a document again', async (): Promise<void> => {
    await addFiles('blind');
    expect(scan().invalidCount).toBe(1);
    vi.mocked(detectCrop).mockResolvedValueOnce({
      corners: square(42),
      valid: true,
      detectorFailed: false,
    });

    await act(async () => {
      scan().redetect(scan().documents[0].id);
      await Promise.resolve();
    });

    expect(scan().documents[0]).toMatchObject({
      corners: square(42),
      valid: true,
      detectorFailed: false,
    });
    expect(scan().invalidCount).toBe(0);
  });

  it('reorders, selects and adjusts the documents', async (): Promise<void> => {
    await addFiles('a', 'b', 'c');
    const options: EnhanceOptions = {
      filter: 'grayscale',
      turns: 1,
      sharpen: 'strong',
    };

    act(() => {
      scan().reorder(2, 0);
    });
    expect(names()).toEqual(['c', 'a', 'b']);

    act(() => {
      scan().select(scan().documents[2].id);
    });
    expect(scan().active?.source.name).toBe('b');

    act(() => {
      scan().setOptions(scan().documents[0].id, options);
    });
    act(() => {
      scan().applyOptionsToAll(scan().documents[0].id);
    });
    expect(scan().documents.map((d: DocumentItem) => d.options)).toEqual([
      options,
      { ...options, turns: 0 },
      { ...options, turns: 0 },
    ]);
  });

  it('changes the export settings', (): void => {
    const settings: ExportSettings = {
      format: 'jpg',
      pageFormat: 'letter',
      margins: 10,
      combine: false,
    };

    act(() => {
      scan().setExportSettings(settings);
    });

    expect(scan().exportSettings).toEqual(settings);
  });

  it('restarts: discards the documents, the export settings and the notices, and goes to Upload', async (): Promise<void> => {
    await addFiles('a', 'bad');
    act(() => {
      scan().setExportSettings({
        format: 'png',
        pageFormat: 'image',
        margins: 5,
        combine: false,
      });
    });
    goTo('export');
    expect(toasts()).toHaveLength(1);

    act(() => {
      scan().restart();
    });

    expect(currentStep()).toBe('upload');
    expect(scan().documents).toEqual([]);
    expect(scan().active).toBeNull();
    expect(scan().exportSettings).toEqual(DEFAULT_SETTINGS);
    expect(toasts()).toEqual([]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:a');
  });

  describe('thumbnails', (): void => {
    it.each([
      ['upload', null],
      ['crop', 'crop'],
      ['enhance', 'enhance'],
      ['export', 'enhance'],
    ] as [Step, PreviewMode | null][])(
      'in the %s step, shows the %s thumbnails',
      (step: Step, mode: PreviewMode | null): void => {
        goTo(step);

        expect(lastPreviews()[1]).toBe(mode);
      },
    );

    it('stops the thumbnails while the camera covers the step', (): void => {
      goTo('crop');

      act(() => {
        session.camera?.open();
      });
      expect(lastPreviews()[1]).toBeNull();

      act(() => {
        session.camera?.close();
      });
      expect(lastPreviews()[1]).toBe('crop');
    });

    it('passes the documents and the document on display', async (): Promise<void> => {
      await addFiles('a', 'b');
      act(() => {
        scan().select(scan().documents[1].id);
      });

      const [documents, , options] = lastPreviews();
      expect(documents).toBe(scan().documents);
      expect(options.activeId).toBe(scan().documents[1].id);
    });

    it('pauses the thumbnails in Crop while a corner is dragged, holding the document on display', async (): Promise<void> => {
      await addFiles('a', 'b');
      goTo('crop');
      expect(lastPreviews()[2]).toMatchObject({ paused: false, holdId: null });

      act(() => {
        scan().setDraggingCorner(true);
      });
      expect(lastPreviews()[2]).toMatchObject({
        paused: true,
        holdId: scan().documents[0].id,
      });

      act(() => {
        scan().setDraggingCorner(false);
      });
      expect(lastPreviews()[2]).toMatchObject({ paused: false, holdId: null });
    });

    it('in Enhance, waits for the main preview and uses it as the current thumbnail', async (): Promise<void> => {
      await addFiles('a');
      goTo('enhance');
      expect(lastPreviews()[2]).toMatchObject({ paused: true, current: null });

      const current: CurrentRender = {
        id: scan().documents[0].id,
        key: 'k',
        canvas: null,
      };
      act(() => {
        scan().setMainRender(current);
      });

      expect(lastPreviews()[2]).toMatchObject({ paused: false, current });
    });

    it('exposes the thumbnails from usePreviews', (): void => {
      const previews: Record<string, Preview> = {
        x: { url: 'data:x', pending: false },
      };
      vi.mocked(usePreviews).mockReturnValue(previews);

      goTo('crop');

      expect(scan().previews).toBe(previews);
    });
  });
});
