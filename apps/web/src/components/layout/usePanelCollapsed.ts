import { useState } from 'react';

const STORAGE_KEY: string = 'docscanify.panelCollapsed';

function readStoredCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    // Storage may be unavailable, such as in some private browsing modes
    return false;
  }
}

function storeCollapsed(collapsed: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Without storage the choice only lasts while the panel is on screen
  }
}

/**
 * Whether the options of the step panels are collapsed, which only shows on phones. Open by
 * default; the choice is shared by every step and kept between visits.
 */
export function usePanelCollapsed(): [boolean, (collapsed: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readStoredCollapsed);

  const change = (value: boolean): void => {
    setCollapsed(value);
    storeCollapsed(value);
  };

  return [collapsed, change];
}
