import './ResultSteps.css';

import { type JSX, useMemo } from 'react';

import { StepLayout } from '@/components/layout/StepLayout';
import { DocumentStrip } from '@/features/scan/DocumentStrip';
import { useActiveDocument, useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useTranslate } from '@/i18n';
import { type PdfPagePreview, pdfPagePreview } from '@/lib/export';
import type { DocumentItem, ExportSettings } from '@/lib/types';

import { EnhancePanel } from './EnhancePanel';
import { ExportPanel } from './ExportPanel';
import { ResultPreview } from './ResultPreview';
import { useResultPreview } from './useResultPreview';

/**
 * Enhance and Export steps: the preview of the document on display, the carousel, and the panel
 * of the step. Both steps share the preview, so moving between them does not render it again.
 * Exporting to PDF, the preview shows the document on the page it will have in the PDF.
 */
export function ResultSteps(): JSX.Element {
  const { t } = useTranslate();
  const { step } = useSteps();
  const { documents, exportSettings } = useScan();
  const doc: DocumentItem = useActiveDocument();
  const { result, ready, busy, failed, rendering } = useResultPreview(doc);
  const index: number = documents.indexOf(doc);
  const page: PdfPagePreview | undefined = usePdfPagePreview(
    step === 'export' ? exportSettings : null,
    result,
  );

  const size: string =
    !ready || !result
      ? t('result.applying')
      : `${result.width} × ${result.height} px`;
  const status: string =
    documents.length > 1
      ? t('result.position', {
          current: index + 1,
          total: documents.length,
          detail: size,
        })
      : size;

  return (
    <StepLayout
      label={t('result.stage')}
      mainClassName="stage-result"
      footer={<DocumentStrip />}
      panel={
        step === 'enhance' ? (
          <EnhancePanel status={status} />
        ) : (
          <ExportPanel status={status} ready={ready && !failed && !!result} />
        )
      }
    >
      <ResultPreview
        result={result}
        busy={busy}
        rendering={rendering}
        label={
          page
            ? t('result.pagePreview', {
                number: index + 1,
                page: t(`export.pageFormat.values.${page.pageFormat}`),
              })
            : t('result.preview', { number: index + 1 })
        }
        filter={doc.options.filter}
        page={page}
      />
    </StepLayout>
  );
}

/**
 * The PDF page to show the render on, when the export settings make a PDF.
 *
 * @param settings The export settings, or null outside the Export step.
 */
function usePdfPagePreview(
  settings: ExportSettings | null,
  result: HTMLCanvasElement | null,
): PdfPagePreview | undefined {
  const format: ExportSettings['format'] | undefined = settings?.format;
  const pageFormat: ExportSettings['pageFormat'] | undefined =
    settings?.pageFormat;
  const margins: number | undefined = settings?.margins;
  // Only what the page depends on: toggling "combine" or typing past the 10 cm limit leaves the
  // same page, and must not redraw the whole render
  return useMemo(
    () =>
      format === 'pdf' && pageFormat && margins !== undefined && result
        ? pdfPagePreview({ pageFormat, margins }, result)
        : undefined,
    [format, pageFormat, margins, result],
  );
}
