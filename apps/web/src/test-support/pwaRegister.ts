import type { Dispatch, SetStateAction } from 'react';

/** What `useRegisterSW` returns, as in vite-plugin-pwa. */
interface RegisterSW {
  needRefresh: [boolean, Dispatch<SetStateAction<boolean>>];
  offlineReady: [boolean, Dispatch<SetStateAction<boolean>>];
  updateServiceWorker(reloadPage?: boolean): Promise<void>;
}

/**
 * Stands in for `virtual:pwa-register/react`, which only exists in the Vite build with the PWA
 * plugin (see vitest.config.ts). Tests mock it with vi.mock('virtual:pwa-register/react').
 */
export function useRegisterSW(): RegisterSW {
  return {
    needRefresh: [false, (): void => undefined],
    offlineReady: [false, (): void => undefined],
    updateServiceWorker: async (): Promise<void> => {
      await Promise.resolve();
    },
  };
}
