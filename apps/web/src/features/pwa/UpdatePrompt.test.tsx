import type { Corners, ScannedDocument } from '@devantage/docscanify';
import { act, render, type RenderResult, screen } from '@testing-library/react';
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
import {
  ToastContext,
  type ToastContextValue,
  type ToastOptions,
} from '@/components/toast/ToastContext';
import type { ScanContextValue } from '@/features/scan/ScanContext';
import { useScan } from '@/features/scan/useScan';
import { TranslateProvider } from '@/i18n';
import { DEFAULT_EXPORT_SETTINGS } from '@/lib/export';
import type { DocumentItem } from '@/lib/types';

import { UpdatePrompt } from './UpdatePrompt';

vi.mock('@/features/scan/useScan', () => ({
  useScan: vi.fn(),
  useActiveDocument: vi.fn(),
}));
// Only the PWA plugin of the build provides it (the unit test config resolves it to a stand-in):
// each test backs it with the fake below, which keeps `needRefresh` in real React state
vi.mock('virtual:pwa-register/react', () => ({ useRegisterSW: vi.fn() }));

const ONE_HOUR: number = 60 * 60 * 1000;

/** State of the fake `useRegisterSW`, shared with the tests. */
interface FakeServiceWorker {
  /** Options of the last call to `useRegisterSW`. */
  options: RegisterSWOptions | undefined;
  /** Values the component passed to `setNeedRefresh`, in order. */
  setNeedRefreshCalls: SetStateAction<boolean>[];
  /** Sets `needRefresh` as the plugin does when a new version is downloaded. */
  setNeedRefresh: Dispatch<SetStateAction<boolean>>;
}

const sw: FakeServiceWorker = {
  options: undefined,
  setNeedRefreshCalls: [],
  setNeedRefresh: (): void => undefined,
};

function useFakeRegisterSW(options?: RegisterSWOptions): {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker(): Promise<void>;
} {
  sw.options = options;
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
      url: `blob:${id}`,
      name: id,
      scannedDocument: {} as ScannedDocument,
    },
    corners: CORNERS,
    valid: true,
    detectorFailed: false,
    options: { filter: 'none', turns: 0, sharpen: 'off', denoise: false },
  };
}

function mockDocuments(count: number): void {
  const documents: DocumentItem[] = Array.from(
    { length: count },
    (_: unknown, i: number) => makeDocument(`doc-${String(i)}`),
  );
  const value: ScanContextValue = {
    documents,
    active: documents[0] ?? null,
    invalidCount: 0,
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

function prompt(): JSX.Element {
  return (
    <TranslateProvider>
      <ToastProvider>
        <UpdatePrompt />
      </ToastProvider>
    </TranslateProvider>
  );
}

function renderPrompt(): RenderResult {
  return render(prompt());
}

/** The plugin found a new version, downloaded and waiting. */
function announceNewVersion(): void {
  act((): void => {
    sw.setNeedRefresh(true);
  });
}

/** Fake service worker container, with an optional waiting worker. */
interface FakeContainer {
  container: EventTarget & {
    getRegistration(): Promise<ServiceWorkerRegistration | undefined>;
  };
  postMessage: Mock<(message: unknown) => void>;
}

function installServiceWorker(waiting: boolean): FakeContainer {
  const postMessage: Mock<(message: unknown) => void> =
    vi.fn<(message: unknown) => void>();
  const registration: ServiceWorkerRegistration = {
    waiting: waiting ? ({ postMessage } as unknown as ServiceWorker) : null,
  } as unknown as ServiceWorkerRegistration;
  const container: FakeContainer['container'] = Object.assign(
    new EventTarget(),
    {
      getRegistration: async (): Promise<
        ServiceWorkerRegistration | undefined
      > => Promise.resolve(registration),
    },
  );
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: container,
  });
  return { container, postMessage };
}

function stubReload(): Mock<() => void> {
  const reload: Mock<() => void> = vi.fn<() => void>();
  // Only reload is used; jsdom cannot reload the page
  vi.stubGlobal('location', { href: window.location.href, reload });
  return reload;
}

describe('UpdatePrompt', (): void => {
  beforeEach((): void => {
    sw.options = undefined;
    sw.setNeedRefreshCalls = [];
    vi.mocked(useRegisterSW).mockImplementation(useFakeRegisterSW);
    mockDocuments(0);
  });

  afterEach((): void => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
    vi.useRealTimers();
  });

  it('registers the service worker after the page loads', (): void => {
    renderPrompt();

    expect(sw.options?.immediate).toBe(false);
  });

  it('shows nothing while there is no new version', (): void => {
    renderPrompt();

    expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
  });

  describe('new version notice', (): void => {
    it('shows an info toast with an Update button', (): void => {
      renderPrompt();

      announceNewVersion();

      const toast: HTMLElement = screen.getByTestId('toast');
      expect(toast).toHaveAttribute('data-kind', 'info');
      expect(toast).toHaveAttribute('role', 'status');
      expect(toast).toHaveTextContent('A new version is available.');
      expect(screen.getByTestId('toast-action')).toHaveTextContent('Update');
    });

    it('asks for an update toast that has an id and stays until closed', (): void => {
      const info: Mock<(message: string, options?: ToastOptions) => string> =
        vi.fn<(message: string, options?: ToastOptions) => string>();
      const toast: ToastContextValue = {
        success: vi.fn(),
        info,
        warning: vi.fn(),
        error: vi.fn(),
        dismiss: vi.fn(),
      };
      render(
        <TranslateProvider>
          <ToastContext.Provider value={toast}>
            <UpdatePrompt />
          </ToastContext.Provider>
        </TranslateProvider>,
      );
      expect(info).not.toHaveBeenCalled();

      announceNewVersion();

      expect(info).toHaveBeenCalledTimes(1);
      expect(info).toHaveBeenCalledWith('A new version is available.', {
        id: 'update',
        duration: Infinity,
        action: { label: 'Update', onClick: expect.any(Function) as unknown },
        onClose: expect.any(Function) as unknown,
      });
    });

    it('stays on screen until the user acts on it', (): void => {
      vi.useFakeTimers();
      renderPrompt();
      announceNewVersion();

      act((): void => {
        vi.advanceTimersByTime(ONE_HOUR);
      });

      expect(screen.getByTestId('toast')).toHaveTextContent(
        'A new version is available.',
      );
    });

    it('warns that updating discards the open documents', (): void => {
      mockDocuments(2);
      renderPrompt();

      announceNewVersion();

      expect(screen.getByTestId('toast')).toHaveTextContent(
        'A new version is available. Updating now discards the open documents.',
      );
    });

    it('updates the same notice when documents are added, instead of stacking another', (): void => {
      const { rerender } = renderPrompt();
      announceNewVersion();

      mockDocuments(1);
      rerender(prompt());

      expect(screen.getAllByTestId('toast')).toHaveLength(1);
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'A new version is available. Updating now discards the open documents.',
      );
    });

    it('is in the language of the app', (): void => {
      localStorage.setItem('docscanify.locale', 'es');
      renderPrompt();

      announceNewVersion();

      expect(screen.getByTestId('toast')).toHaveTextContent(
        'Hay una nueva versión disponible.',
      );
      expect(screen.getByTestId('toast-action')).toHaveTextContent(
        'Actualizar',
      );
    });
  });

  describe('updating', (): void => {
    it('activates the waiting version and reloads once it takes over', async (): Promise<void> => {
      const { container, postMessage } = installServiceWorker(true);
      const reload: Mock<() => void> = stubReload();
      const user: UserEvent = userEvent.setup();
      renderPrompt();
      announceNewVersion();

      await user.click(screen.getByRole('button', { name: 'Update' }));

      await vi.waitFor((): void => {
        expect(postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
      });
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(reload).not.toHaveBeenCalled();
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
      expect(sw.setNeedRefreshCalls).toEqual([false]);

      container.dispatchEvent(new Event('controllerchange'));
      container.dispatchEvent(new Event('controllerchange'));

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('only reloads when another tab already activated the new version', async (): Promise<void> => {
      const { postMessage } = installServiceWorker(false);
      const reload: Mock<() => void> = stubReload();
      const user: UserEvent = userEvent.setup();
      renderPrompt();
      announceNewVersion();

      await user.click(screen.getByRole('button', { name: 'Update' }));

      await vi.waitFor((): void => {
        expect(reload).toHaveBeenCalledTimes(1);
      });
      expect(postMessage).not.toHaveBeenCalled();
    });

    it('keeps the current version when the notice is closed', async (): Promise<void> => {
      const { postMessage } = installServiceWorker(true);
      const reload: Mock<() => void> = stubReload();
      const user: UserEvent = userEvent.setup();
      renderPrompt();
      announceNewVersion();

      await user.click(screen.getByRole('button', { name: 'Close message' }));

      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
      expect(sw.setNeedRefreshCalls).toEqual([false]);
      expect(postMessage).not.toHaveBeenCalled();
      expect(reload).not.toHaveBeenCalled();
    });

    it('shows the notice again for the next new version after closing it', async (): Promise<void> => {
      const user: UserEvent = userEvent.setup();
      renderPrompt();
      announceNewVersion();
      await user.click(screen.getByRole('button', { name: 'Close message' }));

      announceNewVersion();

      expect(screen.getByTestId('toast')).toHaveTextContent(
        'A new version is available.',
      );
    });
  });

  describe('new version activated by another tab', (): void => {
    it('shows the notice instead of reloading and losing the documents', (): void => {
      const reload: Mock<() => void> = stubReload();
      mockDocuments(1);
      renderPrompt();

      act((): void => {
        sw.options?.onNeedReload?.();
      });

      expect(reload).not.toHaveBeenCalled();
      expect(sw.setNeedRefreshCalls).toEqual([true]);
      expect(screen.getByTestId('toast')).toHaveTextContent(
        'A new version is available. Updating now discards the open documents.',
      );
    });

    it('shows no notice when this tab is the one updating', async (): Promise<void> => {
      installServiceWorker(true);
      stubReload();
      const user: UserEvent = userEvent.setup();
      renderPrompt();
      announceNewVersion();
      await user.click(screen.getByRole('button', { name: 'Update' }));
      sw.setNeedRefreshCalls = [];

      act((): void => {
        sw.options?.onNeedReload?.();
      });

      expect(sw.setNeedRefreshCalls).toEqual([]);
      expect(screen.queryByTestId('toast')).not.toBeInTheDocument();
    });
  });

  describe('hourly check for new versions', (): void => {
    function registered(
      update: Mock<() => Promise<void>>,
    ): ServiceWorkerRegistration {
      return { update } as unknown as ServiceWorkerRegistration;
    }

    it('checks every hour while online', (): void => {
      vi.useFakeTimers();
      const update: Mock<() => Promise<void>> = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      renderPrompt();

      sw.options?.onRegisteredSW?.('/sw.js', registered(update));
      vi.advanceTimersByTime(ONE_HOUR - 1);
      expect(update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(update).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(ONE_HOUR);
      expect(update).toHaveBeenCalledTimes(2);
    });

    it('skips the check while offline and resumes when back online', (): void => {
      vi.useFakeTimers();
      const onLine: Mock<() => boolean> = vi.fn<() => boolean>(() => false);
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        get: onLine,
      });
      const update: Mock<() => Promise<void>> = vi
        .fn<() => Promise<void>>()
        .mockResolvedValue(undefined);
      try {
        renderPrompt();
        sw.options?.onRegisteredSW?.('/sw.js', registered(update));

        vi.advanceTimersByTime(ONE_HOUR * 2);
        expect(update).not.toHaveBeenCalled();

        onLine.mockReturnValue(true);
        vi.advanceTimersByTime(ONE_HOUR);
        expect(update).toHaveBeenCalledTimes(1);
      } finally {
        Reflect.deleteProperty(navigator, 'onLine');
      }
    });

    it('tries again on the next hour when a check fails', async (): Promise<void> => {
      vi.useFakeTimers();
      const update: Mock<() => Promise<void>> = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValue(undefined);
      renderPrompt();
      sw.options?.onRegisteredSW?.('/sw.js', registered(update));

      await vi.advanceTimersByTimeAsync(ONE_HOUR);
      await vi.advanceTimersByTimeAsync(ONE_HOUR);

      expect(update).toHaveBeenCalledTimes(2);
    });

    it('does not schedule checks without a registration', (): void => {
      vi.useFakeTimers();
      renderPrompt();
      const timersBefore: number = vi.getTimerCount();

      sw.options?.onRegisteredSW?.('/sw.js', undefined);

      expect(vi.getTimerCount()).toBe(timersBefore);
    });
  });
});
