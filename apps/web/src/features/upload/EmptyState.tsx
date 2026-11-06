import type { JSX } from 'react';

import { CameraIcon, LockIcon, UploadIcon } from '@/components/icons';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useTranslate } from '@/i18n';

interface Props {
  /** Images are being dragged over the screen. */
  over: boolean;
  /** Called with the chosen images, in the order received. */
  onFiles(files: File[]): void;
  /** Called on the take-photo button when the browser gives access to the camera. */
  onCamera(): void;
}

/** Dashed card of the Upload step before any image is added: take photos or choose images. */
export function EmptyState({ over, onFiles, onCamera }: Props): JSX.Element {
  const { t } = useTranslate();
  const { takePhoto, chooseFiles, fileInput } = useImagePicker({
    onFiles,
    onCamera,
  });

  return (
    <div className="upload-empty">
      <div className={`add-card add-card-large${over ? ' is-over' : ''}`}>
        <img
          className="upload-logo"
          src={`${import.meta.env.BASE_URL}icon.svg`}
          alt=""
          aria-hidden
        />
        <h1 className="upload-title">{t('upload.emptyTitle')}</h1>
        <p className="upload-text">{t('upload.emptyText')}</p>
        <div className="upload-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={takePhoto}
            data-testid="upload-camera"
          >
            <CameraIcon className="btn-icon" />
            {t('common.takePhoto')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={chooseFiles}
            data-testid="upload-files"
          >
            <UploadIcon className="btn-icon" />
            {t('common.uploadImages')}
          </button>
        </div>
        <p className="upload-drop">{t('common.dropHint')}</p>
      </div>
      <p className="upload-privacy">
        <LockIcon />
        {t('upload.privacy')}
      </p>
      {fileInput}
    </div>
  );
}
