import './UploadStep.css';

import type { JSX } from 'react';

import type { CameraContextValue } from '@/features/camera/CameraContext';
import { useCamera } from '@/features/camera/useCamera';
import { DocumentCarousel } from '@/features/documents/DocumentCarousel';
import { useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useFileDrop } from '@/hooks/useFileDrop';
import { useTranslate } from '@/i18n';

import { EmptyState } from './EmptyState';

/**
 * Upload step. Without documents, it shows a card with the take-photo and upload buttons; with
 * them, the document carousel, where documents are also added, removed, and reordered. The whole
 * screen accepts dropped images.
 */
export function UploadStep(): JSX.Element {
  const { t } = useTranslate();
  const { goTo } = useSteps();
  const camera: CameraContextValue = useCamera();
  const { documents, addFiles, removeDocument, reorder } = useScan();
  const { over, dropProps } = useFileDrop({
    onFiles: (files: File[]) => {
      void addFiles(files);
    },
  });
  const count: number = documents.length;

  return (
    <section className="stage stage-center">
      <div className="upload-screen" {...dropProps}>
        {count === 0 ? (
          <EmptyState
            over={over}
            onFiles={(files: File[]) => {
              void addFiles(files);
            }}
            onCamera={camera.open}
          />
        ) : (
          <div className="upload-filled">
            <div className="upload-head">
              <h1 className="upload-heading">
                {t('upload.filledTitle', { count })}
              </h1>
              <p className="upload-sub">{t('upload.filledText')}</p>
            </div>
            <DocumentCarousel
              size="large"
              documents={documents}
              onFiles={(files: File[]) => {
                void addFiles(files);
              }}
              onCamera={camera.open}
              onRemove={removeDocument}
              onReorder={reorder}
            />
            <div className="upload-footer">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  goTo('crop');
                }}
                data-testid="upload-continue"
              >
                {t('common.continue')}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
