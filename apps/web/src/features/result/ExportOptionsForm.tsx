import type { PageFormat } from '@devantage/docscanify';
import type { ChangeEvent, FocusEvent, JSX, KeyboardEvent } from 'react';

import { Segmented, type SegmentedItem } from '@/components/Segmented';
import { useTranslate } from '@/i18n';
import type { ExportFormat, ExportSettings } from '@/lib/types';

import {
  formatMargins,
  isNonDigitKey,
  isTypedChange,
  MARGINS_STEP,
  parseSteppedMargins,
  parseTypedMargins,
} from './marginsMask';

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
 * Fields of the export options: format and, for PDF, page and margins, side by side on phones.
 * The margins field is a number field masked with 2 decimal places: typed digits fill from the
 * right, and its arrows step by 0.01 cm. Focusing it selects the value, since a number field
 * cannot move its caret to the end, where the mask types.
 * With several documents as PDF, it chooses between a single PDF with every page and one PDF per
 * document (ZIP); PNG and JPG are one file per document, all in a ZIP.
 */
export function ExportOptionsForm({
  settings,
  onChange,
  count,
}: Props): JSX.Element {
  const { t, locale } = useTranslate();
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
              <span className="field-label">
                {t('export.pageFormat.label')}
              </span>
              <select
                value={pageFormat}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                  change({ pageFormat: e.target.value as PageFormat });
                }}
              >
                {PAGE_FORMATS.map((curPageFormat: PageFormat) => (
                  <option key={curPageFormat} value={curPageFormat}>
                    {t(`export.pageFormat.values.${curPageFormat}`)}
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
                step={MARGINS_STEP}
                inputMode="numeric"
                lang={locale}
                value={formatMargins(margins)}
                onFocus={(e: FocusEvent<HTMLInputElement>) => {
                  e.currentTarget.select();
                }}
                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                  if (isNonDigitKey(e)) e.preventDefault();
                }}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const read: typeof parseTypedMargins = isTypedChange(
                    e.nativeEvent,
                  )
                    ? parseTypedMargins
                    : parseSteppedMargins;
                  change({ margins: read(e.target.value, MAX_MARGINS) });
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
          {t(`export.imageHint.${format}`)}
        </p>
      )}
    </>
  );
}
