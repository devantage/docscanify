import type { JSX } from 'react';

import type { CameraContextValue } from '@/features/camera/CameraContext';
import { useCamera } from '@/features/camera/useCamera';
import { DocumentCarousel } from '@/features/documents/DocumentCarousel';

import type { ScanContextValue } from './ScanContext';
import { useScan } from './useScan';

/**
 * The compact document carousel under the preview of the Crop, Enhance, and Export steps, wired
 * to the session: selects the document on display and adds, removes, and reorders documents.
 */
export function DocumentStrip(): JSX.Element | null {
  const scan: ScanContextValue = useScan();
  const camera: CameraContextValue = useCamera();
  if (!scan.active) return null;

  return (
    <DocumentCarousel
      size="compact"
      documents={scan.documents}
      activeId={scan.active.id}
      onSelect={scan.select}
      previews={scan.previews}
      onFiles={(files: File[]) => {
        void scan.addFiles(files);
      }}
      onCamera={camera.open}
      onRemove={scan.removeDocument}
      onReorder={scan.reorder}
    />
  );
}
