import { type RefObject, useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import type { ToastContextValue } from '@/components/toast/ToastContext';
import { useScan } from '@/features/scan/useScan';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';

/** Id of the new-version toast, so showing it again updates its text instead of stacking. */
const UPDATE_TOAST: string = 'update';

/** How often an app left open checks for a new version, in ms. */
const CHECK_INTERVAL: number = 60 * 60 * 1000;

/**
 * Activates the new version and reloads the page once it takes over. When another tab already
 * activated it, it only reloads.
 */
async function applyUpdate(): Promise<void> {
  const registration: ServiceWorkerRegistration | undefined =
    await navigator.serviceWorker.getRegistration();
  if (!registration?.waiting) {
    window.location.reload();
    return;
  }
  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      window.location.reload();
    },
    {
      once: true,
    },
  );
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}

/**
 * Registers the service worker that keeps the app available offline (only in the build; the
 * dev server has none) and, when a new version is downloaded, shows a toast with an update
 * button. Updating reloads the page, so with documents open the toast says they are discarded.
 * Without the button, the new version takes over the next time the app opens.
 */
export function UpdatePrompt(): null {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const { documents } = useScan();
  // This tab is updating: it reloads by itself, so it shows no notice meanwhile
  const updating: RefObject<boolean> = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
  } = useRegisterSW({
    // Registers after the page loads, so the download of the app files does not slow it down
    immediate: false,
    onRegisteredSW(
      _url: string,
      registration: ServiceWorkerRegistration | undefined,
    ) {
      if (!registration) return;
      // Lives as long as the app, like the registration
      setInterval(() => {
        if (navigator.onLine)
          registration.update().catch(() => {
            // Offline or the server failed: the next interval tries again
          });
      }, CHECK_INTERVAL);
    },
    // Another tab activated the new version. Without this, the page would reload by itself and
    // lose its documents; instead, the notice stays until the user updates
    onNeedReload() {
      if (!updating.current) setNeedRefresh(true);
    },
  });

  const message: string = t(
    documents.length ? 'update.availableWithDocuments' : 'update.available',
  );

  useEffect(() => {
    if (!needRefresh) return;
    toast.info(message, {
      id: UPDATE_TOAST,
      duration: Infinity,
      action: {
        label: t('update.action'),
        onClick: () => {
          updating.current = true;
          setNeedRefresh(false);
          void applyUpdate();
        },
      },
      // Closed: the new version waits for the next time the app opens
      onClose: () => {
        setNeedRefresh(false);
      },
    });
  }, [needRefresh, message, t, toast, setNeedRefresh]);

  return null;
}
