import type { ScannedDocument } from '@devantage/docscanify';
import { act, render, screen, within } from '@testing-library/react';
import { type UserEvent, userEvent } from '@testing-library/user-event';
import {
  type Dispatch,
  type JSX,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

import { ToastProvider } from '@/components/toast';
import type { ToastContextValue } from '@/components/toast/ToastContext';
import { CameraProvider } from '@/features/camera/CameraProvider';
import type { CropState } from '@/features/documents/detectCrop';
import { detectCrop } from '@/features/documents/detectCrop';
import { usePreviews } from '@/features/documents/usePreviews';
import { ExportPanel } from '@/features/result/ExportPanel';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { ScanProvider } from '@/features/scan/ScanProvider';
import { useScan } from '@/features/scan/useScan';
import { type Step, StepsProvider, useSteps } from '@/features/steps';
import type { StepsContextValue } from '@/features/steps/StepsContext';
import { useToast } from '@/hooks/useToast';
import { TranslateProvider } from '@/i18n';
import { sourceFromFile } from '@/lib/image';
import type { SourceImage } from '@/lib/types';

import { UpdatePrompt } from './UpdatePrompt';

// Image decoding, detection and rendering need real images and OpenCV: the session is tested
// around them, as in ScanProvider.test.tsx
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
// Only the PWA plugin of the build provides it (the unit test config resolves it to a stand-in):
// each test backs it with the fake below, which keeps `needRefresh` in real React state
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));

const PLAIN_NOTICE: string = 'A new version is available.';
const NOTICE_WITH_DOCUMENTS: string =
  'A new version is available. Updating now discards the open documents.';

/** State of the fake `useRegisterSW`, shared with the tests. */
interface FakeServiceWorker {
  /** Values the component passed to `setNeedRefresh`, in order. */
  setNeedRefreshCalls: SetStateAction<boolean>[];
  /** Sets `needRefresh` as the plugin does when a new version is downloaded. */
  setNeedRefresh: Dispatch<SetStateAction<boolean>>;
}

const sw: FakeServiceWorker = {
  setNeedRefreshCalls: [],
  setNeedRefresh: (): void => undefined,
};

/**
 * Stand-in for {@link useRegisterSW}: keeps `needRefresh` in React state, records the values the
 * component sets, and exposes the setter in {@link sw} so tests can announce a new version.
 */
function useFakeRegisterSW(_options?: RegisterSWOptions): {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker(): Promise<void>;
} {
  const [needRefresh, setNeedRefreshState] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const setNeedRefresh: Dispatch<SetStateAction<boolean>> = useCallback(
    (value: SetStateAction<boolean>): void => {
      sw.setNeedRefreshCalls.push(value);
      setNeedRefreshState(value);
    },
    [],
  );
  sw.setNeedRefresh = setNeedRefreshState;
  return {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker: async (): Promise<void> => {
      await Promise.resolve();
    },
  };
}

interface Session {
  scan: ScanContextValue | null;
  steps: StepsContextValue | null;
  toast: ToastContextValue | null;
}

const session: Session = { scan: null, steps: null, toast: null };

/** The current step, with the real Export panel (and its New scan button) at the Export step. */
function Workspace(): JSX.Element | null {
  session.scan = useScan();
  session.steps = useSteps();
  session.toast = useToast();
  return session.steps.step === 'export' ? (
    <ExportPanel status="" ready />
  ) : null;
}

/** The providers and the update prompt, nested as in App, AppShell and main.tsx. */
function renderApp(): void {
  render(
    <TranslateProvider>
      <ToastProvider>
        <StepsProvider>
          <CameraProvider>
            <ScanProvider>
              <Workspace />
              <UpdatePrompt />
            </ScanProvider>
          </CameraProvider>
        </StepsProvider>
      </ToastProvider>
    </TranslateProvider>,
  );
}

/** The session of the rendered app. Throws before {@link renderApp}. */
function scan(): ScanContextValue {
  if (!session.scan) throw new Error('The session is not rendered');
  return session.scan;
}

/** The step on display in the rendered app. Throws before {@link renderApp}. */
function currentStep(): Step {
  if (!session.steps) throw new Error('The session is not rendered');
  return session.steps.step;
}

/** The toast API of the rendered app, to show other toasts. Throws before {@link renderApp}. */
function toastApi(): ToastContextValue {
  if (!session.toast) throw new Error('The session is not rendered');
  return session.toast;
}

/** Moves the rendered app to a step, as the top bar does. */
function goTo(step: Step): void {
  act((): void => {
    session.steps?.goTo(step);
  });
}

/** A PNG file named `<name>.png`; its content does not matter, image decoding is mocked. */
const file = (name: string): File =>
  new File(['x'], `${name}.png`, { type: 'image/png' });

/** Imports one image per name through the session and waits for the import to end. */
async function addFiles(...names: string[]): Promise<void> {
  await act(async (): Promise<void> => {
    await scan().addFiles(names.map(file));
  });
}

/** The plugin found a new version, downloaded and waiting. */
function announceNewVersion(): void {
  act((): void => {
    sw.setNeedRefresh(true);
  });
}

interface ShownToast {
  kind: string | null;
  message: string | null;
  action: string | null;
}

/** The toasts on screen, in order: kind, message and action button. */
const toasts = (): ShownToast[] =>
  screen.queryAllByTestId('toast').map((el: HTMLElement): ShownToast => ({
    kind: el.getAttribute('data-kind'),
    message: el.querySelector('p')?.textContent ?? null,
    action: within(el).queryByTestId('toast-action')?.textContent ?? null,
  }));

const UPDATE_NOTICE_WITH_DOCUMENTS: ShownToast = {
  kind: 'info',
  message: NOTICE_WITH_DOCUMENTS,
  action: 'Update',
};
const UPDATE_NOTICE: ShownToast = {
  kind: 'info',
  message: PLAIN_NOTICE,
  action: 'Update',
};

/** Fake service worker container with a waiting worker. */
interface FakeContainer {
  container: EventTarget;
  postMessage: Mock<(message: unknown) => void>;
}

/**
 * Replaces `navigator.serviceWorker` with a fake container whose registration has a waiting
 * worker, and returns it along with that worker's `postMessage` mock.
 */
function installServiceWorker(): FakeContainer {
  const postMessage: Mock<(message: unknown) => void> =
    vi.fn<(message: unknown) => void>();
  const registration: ServiceWorkerRegistration = {
    waiting: { postMessage } as unknown as ServiceWorker,
  } as unknown as ServiceWorkerRegistration;
  const container: EventTarget & {
    getRegistration(): Promise<ServiceWorkerRegistration | undefined>;
  } = Object.assign(new EventTarget(), {
    getRegistration: async (): Promise<ServiceWorkerRegistration | undefined> =>
      Promise.resolve(registration),
  });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  });
  return { container, postMessage };
}

/** Replaces `window.location` with one whose `reload` is a mock, and returns that mock. */
function stubReload(): Mock<() => void> {
  const reload: Mock<() => void> = vi.fn<() => void>();
  // Only reload is used; jsdom cannot reload the page
  vi.stubGlobal('location', { href: window.location.href, reload });
  return reload;
}

describe('UpdatePrompt with New scan', (): void => {
  beforeEach((): void => {
    sw.setNeedRefreshCalls = [];
    vi.mocked(useRegisterSW).mockImplementation(useFakeRegisterSW);
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((): void => undefined);
    vi.mocked(usePreviews).mockReturnValue({});
    vi.mocked(sourceFromFile).mockImplementation(
      async (f: File): Promise<SourceImage> => {
        const name: string = f.name.replace(/\.png$/, '');
        if (name.startsWith('bad'))
          return Promise.reject(new Error(`Could not open ${f.name}`));
        return Promise.resolve({
          image: new Image(),
          url: `blob:${name}`,
          name,
          scannedDocument: {} as ScannedDocument,
        });
      },
    );
    vi.mocked(detectCrop).mockImplementation(async (): Promise<CropState> =>
      Promise.resolve({
        corners: {
          topLeft: { x: 0, y: 0 },
          topRight: { x: 10, y: 0 },
          bottomRight: { x: 10, y: 10 },
          bottomLeft: { x: 0, y: 10 },
        },
        valid: true,
        detectorFailed: false,
      }),
    );
    renderApp();
  });

  afterEach((): void => {
    session.scan = null;
    session.steps = null;
    session.toast = null;
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.mocked(usePreviews).mockReset();
    vi.mocked(sourceFromFile).mockReset();
    vi.mocked(detectCrop).mockReset();
  });

  it('offers the update again after New scan, with the message without documents', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    await addFiles('a', 'b');
    goTo('export');
    announceNewVersion();
    expect(toasts()).toEqual([UPDATE_NOTICE_WITH_DOCUMENTS]);

    await user.click(screen.getByRole('button', { name: 'New scan' }));

    expect(currentStep()).toBe('upload');
    expect(scan().documents).toEqual([]);
    expect(toasts()).toEqual([UPDATE_NOTICE]);
    expect(screen.queryByText(NOTICE_WITH_DOCUMENTS)).not.toBeInTheDocument();
    // The notice was not closed: the new version is still pending
    expect(sw.setNeedRefreshCalls).toEqual([]);
  });

  it('still updates from the notice offered again after New scan', async (): Promise<void> => {
    const { container, postMessage } = installServiceWorker();
    const reload: Mock<() => void> = stubReload();
    const user: UserEvent = userEvent.setup();
    await addFiles('a');
    goTo('export');
    announceNewVersion();
    await user.click(screen.getByRole('button', { name: 'New scan' }));

    await user.click(screen.getByRole('button', { name: 'Update' }));

    await vi.waitFor((): void => {
      expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    });
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(sw.setNeedRefreshCalls).toEqual([false]);
    expect(toasts()).toEqual([]);
    expect(reload).not.toHaveBeenCalled();

    container.dispatchEvent(new Event('controllerchange'));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('still closes the notice offered again after New scan, keeping the current version', async (): Promise<void> => {
    const { postMessage } = installServiceWorker();
    const reload: Mock<() => void> = stubReload();
    const user: UserEvent = userEvent.setup();
    await addFiles('a');
    goTo('export');
    announceNewVersion();
    await user.click(screen.getByRole('button', { name: 'New scan' }));

    await user.click(screen.getByRole('button', { name: 'Close message' }));

    expect(toasts()).toEqual([]);
    expect(sw.setNeedRefreshCalls).toEqual([false]);
    expect(postMessage).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('clears the other toasts on New scan and keeps only the update notice', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    await addFiles('a', 'bad');
    goTo('export');
    announceNewVersion();
    act((): void => {
      toastApi().success('File downloaded: documents.pdf');
    });
    expect(toasts()).toEqual([
      { kind: 'warning', message: '1 file could not be opened.', action: null },
      UPDATE_NOTICE_WITH_DOCUMENTS,
      {
        kind: 'success',
        message: 'File downloaded: documents.pdf',
        action: null,
      },
    ]);

    await user.click(screen.getByRole('button', { name: 'New scan' }));

    expect(toasts()).toEqual([UPDATE_NOTICE]);
  });

  it('clears the toasts on New scan and shows no notice without a new version', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    await addFiles('a', 'bad');
    goTo('export');
    expect(toasts()).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'New scan' }));

    expect(toasts()).toEqual([]);
  });

  it('does not bring back a notice the user closed before New scan', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    await addFiles('a');
    goTo('export');
    announceNewVersion();
    await user.click(screen.getByRole('button', { name: 'Close message' }));
    expect(toasts()).toEqual([]);

    await user.click(screen.getByRole('button', { name: 'New scan' }));

    expect(toasts()).toEqual([]);
    expect(sw.setNeedRefreshCalls).toEqual([false]);
  });

  it('offers the update again after a second New scan with new documents', async (): Promise<void> => {
    const user: UserEvent = userEvent.setup();
    await addFiles('a');
    goTo('export');
    announceNewVersion();
    await user.click(screen.getByRole('button', { name: 'New scan' }));
    expect(toasts()).toEqual([UPDATE_NOTICE]);

    await addFiles('b');
    expect(toasts()).toEqual([UPDATE_NOTICE_WITH_DOCUMENTS]);
    goTo('export');
    await user.click(screen.getByRole('button', { name: 'New scan' }));

    expect(toasts()).toEqual([UPDATE_NOTICE]);
  });

  // The New scan button is only in the Export panel, which needs documents, so this path is not
  // reachable from the UI today; restart() is part of the session API (ScanContextValue), though
  it.fails(
    'keeps offering the update when the session restarts without documents',
    (): void => {
      // Known bug: restart() calls toast.dismiss() with no id, which removes the update notice
      // too; with no documents the message of UpdatePrompt does not change, its effect does not
      // run again, and the pending update is no longer offered (needRefresh stays true)
      announceNewVersion();
      expect(toasts()).toEqual([UPDATE_NOTICE]);

      act((): void => {
        scan().restart();
      });

      expect(toasts()).toEqual([UPDATE_NOTICE]);
    },
  );
});
