import type { JSX } from 'react';

import { CloseIcon } from '@/components/icons';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import type { Preview } from './usePreviews';

interface Props {
  document: DocumentItem;
  /** Position in the list, from 0. */
  index: number;
  /** Thumbnail with the crop and adjustments; without it, the original image shows up. */
  preview?: Preview;
  /** The document is on display. */
  active: boolean;
  /** Called when the document is tapped. Without it, the tile is not selectable. */
  onSelect?(id: string): void;
  /** Called on the remove button. */
  onRemove(id: string): void;
}

/**
 * One document of the carousel: thumbnail, position, and remove button. When selectable, it
 * flags documents whose crop still needs fixing.
 */
export function DocumentTile({
  document: doc,
  index,
  preview,
  active,
  onSelect,
  onRemove,
}: Props): JSX.Element {
  const { t } = useTranslate();
  const invalid: boolean = !!onSelect && (!doc.corners || !doc.valid);
  const number: number = index + 1;
  const label: string = t(
    invalid ? 'carousel.documentNeedsCrop' : 'carousel.document',
    { number },
  );

  const content: JSX.Element = (
    <>
      <img
        className={preview?.url ? 'is-preview' : undefined}
        src={preview?.url ?? doc.source.url}
        alt=""
        draggable={false}
      />
      {preview?.pending && <span className="doc-tile-spinner" aria-hidden />}
      <span className="doc-tile-n" aria-hidden>
        {number}
      </span>
      {invalid && (
        <span className="doc-tile-alert" aria-hidden>
          !
        </span>
      )}
    </>
  );

  return (
    <div
      className={`doc-tile${active ? ' is-active' : ''}${preview?.pending ? ' is-pending' : ''}`}
    >
      {onSelect ? (
        <button
          type="button"
          className="doc-tile-body"
          onClick={() => {
            onSelect(doc.id);
          }}
          aria-label={label}
          aria-current={active ? 'true' : undefined}
          aria-busy={preview?.pending || undefined}
          title={t('carousel.tileHint')}
          data-testid={`doc-${index}`}
        >
          {content}
        </button>
      ) : (
        <div
          className="doc-tile-body"
          role="img"
          aria-label={label}
          data-testid={`doc-${index}`}
        >
          {content}
        </div>
      )}
      <button
        type="button"
        className="doc-tile-remove"
        onClick={() => {
          onRemove(doc.id);
        }}
        aria-label={t('carousel.remove', { number })}
        title={t('carousel.removeShort')}
        data-testid={`remove-${index}`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
