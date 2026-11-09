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

/** Maximum margin, in mm: on A4 and Letter, 100 mm per side still leaves room for the image. */
const MAX_MARGIN: number = 100;

/**
 * The margin typed in the field, in mm, kept between 0 and {@link MAX_MARGIN}; an empty or
 * invalid value becomes 0.
 */
const clampMargin = (value: string): number =>
  Math.min(MAX_MARGIN, Math.max(0, Number(value) || 0));

/**
 * Fields of the export options: format and, for PDF, page and margin, side by side on phones.
 * With several documents as PDF, it chooses between a single PDF with every page and one PDF per
 * document (ZIP); PNG and JPG are one file per document, all in a ZIP.
 */
export function ExportOptionsForm({
  settings,
  onChange,
  count,
}: Props): JSX.Element {
  const { t } = useTranslate();
  const { pageFormat, margin, format, combine } = settings;

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
              <span className="field-label">{t('export.margin')}</span>
              <input
                type="number"
                min={0}
                max={MAX_MARGIN}
                value={margin}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  change({ margin: clampMargin(e.target.value) });
                }}
                data-testid="margin"
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
