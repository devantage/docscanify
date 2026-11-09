import type { JSX } from 'react';

import { CameraIcon, PlusIcon, UploadIcon } from '@/components/icons';
import { useTranslate } from '@/i18n';

interface Props {
  /** Images are being dragged over the carousel. */
  over: boolean;
  /** Icon-only buttons with a tooltip, for the compact carousel. */
  compact: boolean;
  onTakePhoto(): void;
  /** Called on the upload button. */
  onChooseFiles(): void;
}

/** Last item of the carousel: adds documents by taking photos, choosing, or dropping images. */
export function AddTile({
  over,
  compact,
  onTakePhoto,
  onChooseFiles,
}: Props): JSX.Element {
  const { t } = useTranslate();

  return (
    <div className={`add-tile${over ? ' is-over' : ''}`}>
      <span className="add-tile-head">
        <span className="add-tile-icon" aria-hidden>
          <PlusIcon />
        </span>
        <span className="add-tile-title">{t('carousel.add')}</span>
      </span>
      <div className="add-tile-actions">
        <button
          type="button"
          className="btn btn-primary btn-small"
          onClick={onTakePhoto}
          aria-label={t('common.takePhoto')}
          title={compact ? t('common.takePhoto') : undefined}
          data-testid="add-camera"
        >
          <CameraIcon className="btn-icon" />
          <span className="add-tile-label">{t('common.takePhoto')}</span>
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onChooseFiles}
          aria-label={t('common.uploadImages')}
          title={compact ? t('common.uploadImages') : undefined}
          data-testid="add-upload"
        >
          <UploadIcon className="btn-icon" />
          <span className="add-tile-label">{t('carousel.upload')}</span>
        </button>
      </div>
      <p className="add-tile-hint">{t('common.dropHint')}</p>
    </div>
  );
}
