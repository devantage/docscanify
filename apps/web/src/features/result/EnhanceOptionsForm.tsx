import type { ChangeEvent, JSX } from 'react';

import { RotateLeftIcon, RotateRightIcon } from '@/components/icons';
import { Segmented, type SegmentedItem } from '@/components/Segmented';
import { useTranslate } from '@/i18n';
import type { EnhanceOptions, Filter, Sharpen } from '@/lib/types';

interface Props {
  options: EnhanceOptions;
  onChange(options: EnhanceOptions): void;
}

const FILTERS: Filter[] = ['none', 'grayscale', 'bw'];
const SHARPENS: Sharpen[] = ['off', 'soft', 'strong'];

/** Fields of the adjustments of a document: color, rotation, sharpness, and noise reduction. */
export function EnhanceOptionsForm({ options, onChange }: Props): JSX.Element {
  const { t } = useTranslate();
  const filters: SegmentedItem<Filter>[] = FILTERS.map((value: Filter) => ({
    value,
    label: t(`enhance.filter.${value}`),
  }));
  const sharpens: SegmentedItem<Sharpen>[] = SHARPENS.map((value: Sharpen) => ({
    value,
    label: t(`enhance.sharpen.${value}`),
  }));

  const change = (patch: Partial<EnhanceOptions>): void => {
    onChange({ ...options, ...patch });
  };

  return (
    <>
      <Segmented
        legend={t('enhance.color')}
        name="filter"
        items={filters}
        value={options.filter}
        onChange={(filter: Filter) => {
          change({ filter });
        }}
      />

      <fieldset className="field">
        <legend>{t('enhance.rotate')}</legend>
        <div className="row">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              change({ turns: options.turns - 1 });
            }}
          >
            <RotateLeftIcon className="btn-icon" />
            {t('enhance.left')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => {
              change({ turns: options.turns + 1 });
            }}
          >
            <RotateRightIcon className="btn-icon" />
            {t('enhance.right')}
          </button>
        </div>
      </fieldset>

      <Segmented
        legend={t('enhance.sharpness')}
        name="sharpen"
        items={sharpens}
        value={options.sharpen}
        onChange={(sharpen: Sharpen) => {
          change({ sharpen });
        }}
      />

      <label className="check">
        <input
          type="checkbox"
          checked={options.denoise}
          onChange={(e: ChangeEvent<HTMLInputElement>) => {
            change({ denoise: e.target.checked });
          }}
          data-testid="denoise"
        />
        {t('enhance.denoise')}
      </label>
    </>
  );
}
