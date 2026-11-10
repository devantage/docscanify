import type { PageFormat } from '@devantage/docscanify';
import type { ChangeEvent, JSX } from 'react';

import { Segmented, type SegmentedItem } from '@/components/Segmented';
import { useTranslate } from '@/i18n';
import type { ExportFormat, ExportSettings } from '@/lib/types';

interface Props {
  settings: ExportSettings;
  onChange(settings: ExportSettings): void;
  /** How many documents will be exported. */
  count: number;
}

/** Format names are the same in every language. */
const FORMATS: SegmentedItem<ExportFormat>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
];

const PAGE_FORMATS: PageFormat[] = ['a4', 'letter', 'image'];

/** Maximum margins, in cm: on A4 and Letter, 10 cm per side still leaves room for the image. */
const MAX_MARGINS: number = 10;

/**
 * The margins field takes centimeters with up to 2 decimal places, so values are rounded in
 * hundredths of a centimeter. Multiplying by the 0.01 step instead would add float noise
 * (1.13 would become 1.1300000000000001).
 */
const MARGINS_SCALE: number = 100;

/**
 * The margins typed in the field, in cm, rounded to 2 decimal places and kept between 0 and
 * {@link MAX_MARGINS}; an empty or invalid value becomes 0.
 */
const clampMargins = (value: string): number => {
  const margins: number = Math.min(
    MAX_MARGINS,
    Math.max(0, Number(value) || 0),
  );
  return Math.round(margins * MARGINS_SCALE) / MARGINS_SCALE;
};

/**
 * Fields of the export options: format and, for PDF, page and margins, side by side on phones.
 * With several documents as PDF, it chooses between a single PDF with every page and one PDF per
 * document (ZIP); PNG and JPG are one file per document, all in a ZIP.
 */
export function ExportOptionsForm({
  settings,
  onChange,
  count,
}: Props): JSX.Element {
  const { t } = useTranslate();
  const { pageFormat, margins, format, combine } = settings;

  const change = (patch: Partial<ExportSettings>): void => {
    onChange({ ...settings, ...patch });
  };

  return (
    <>
      <Segmented
        legend={t('export.format')}
        name="format"
        items={FORMATS}
        value={format}
        onChange={(value: ExportFormat) => {
          change({ format: value });
        }}
      />

      {count > 1 && format === 'pdf' && (
        <Segmented
          legend={t('export.file')}
          name="combine"
          items={[
            { value: 'one', label: t('export.fileOne') },
            { value: 'many', label: t('export.fileMany') },
          ]}
          value={combine ? 'one' : 'many'}
          onChange={(value: 'one' | 'many') => {
            change({ combine: value === 'one' });
          }}
        />
      )}

      {format === 'pdf' ? (
        <>
          <div className="field-pair">
            <label className="field">
              <span className="field-label">{t('export.page')}</span>
              <select
                value={pageFormat}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  change({ pageFormat: e.target.value as PageFormat });
                }}
              >
                {PAGE_FORMATS.map((page: PageFormat) => (
                  <option key={page} value={page}>
                    {t(`export.pageFormat.${page}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">{t('export.margins')}</span>
              <input
                type="number"
                min={0}
                max={MAX_MARGINS}
                step={1 / MARGINS_SCALE}
                inputMode="decimal"
                value={margins}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  change({ margins: clampMargins(e.target.value) });
                }}
                data-testid="margins"
              />
            </label>
          </div>
          {count > 1 && !combine && (
            <p className="panel-hint">{t('export.pdfZipHint')}</p>
          )}
        </>
      ) : (
        <p className="panel-hint">
          {count > 1 && `${t('export.imageZipHint')} `}
          {t('export.imageHint')}
        </p>
      )}
    </>
  );
}
