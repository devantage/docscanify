import { useContext } from 'react';

import type { DocumentItem } from '@/lib/types';

import { ScanContext, type ScanContextValue } from './ScanContext';

/**
 * The scanning session: documents, their operations, thumbnails, import, and export options.
 *
 * @throws When used outside {@link ScanProvider}.
 */
export function useScan(): ScanContextValue {
  const value: ScanContextValue | null = useContext(ScanContext);
  if (!value) throw new Error('useScan must be used inside ScanProvider');
  return value;
}

/**
 * The document on display, for steps that are only shown with one (see {@link CurrentStep}).
 *
 * @throws When there is no document.
 */
export function useActiveDocument(): DocumentItem {
  const { active } = useScan();
  if (!active) throw new Error('useActiveDocument needs a document on display');
  return active;
}
