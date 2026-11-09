import './ResultSteps.css';

import type { JSX } from 'react';

import { StepLayout } from '@/components/layout/StepLayout';
import { DocumentStrip } from '@/features/scan/DocumentStrip';
import { useActiveDocument, useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { EnhancePanel } from './EnhancePanel';
import { ExportPanel } from './ExportPanel';
import { ResultPreview } from './ResultPreview';
import { useResultPreview } from './useResultPreview';

/**
 * Enhance and Export steps: the preview of the document on display, the carousel, and the panel
 * of the step. Both steps share the preview, so moving between them does not render it again.
 */
export function ResultSteps(): JSX.Element {
  const { t } = useTranslate();
  const { step } = useSteps();
  const { documents } = useScan();
  const doc: DocumentItem = useActiveDocument();
  const { result, ready, busy, failed, rendering } = useResultPreview(doc);
  const index: number = documents.indexOf(doc);

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
        label={t('result.preview', { number: index + 1 })}
        filter={doc.options.filter}
      />
    </StepLayout>
  );
}
