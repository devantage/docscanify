import './ExportPanel.css';

import type { JSX } from 'react';

import {
  Panel,
  PanelActions,
  PanelBody,
  PanelHeader,
  PanelOptions,
} from '@/components/layout/Panel';
import { ProgressBar } from '@/components/ProgressBar';
import { useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useTranslate } from '@/i18n';

import { ExportOptionsForm } from './ExportOptionsForm';
import { useExportDocuments } from './useExportDocuments';

interface Props {
  /** Render status of the preview, shown under the title. */
  status: string;
  /** Whether export is enabled; false while the preview renders or after it fails. */
  ready: boolean;
}

/**
 * Panel of the Export step: the export options, which the user can collapse on phones, and the
 * export button, which builds and downloads the file. While the file is made, a progress bar takes
 * the place of the button.
 */
export function ExportPanel({ status, ready }: Props): JSX.Element {
  const { t } = useTranslate();
  const { goTo } = useSteps();
  const { documents, exportSettings, setExportSettings, restart } = useScan();
  const { progress, start, dismissProgress } = useExportDocuments();

  return (
    <Panel>
      <PanelBody>
        <PanelHeader
          title={t('export.title')}
          text={status}
          textRole="status"
          data-testid="result-size"
        />
        <PanelOptions>
          <ExportOptionsForm
            settings={exportSettings}
            onChange={setExportSettings}
            count={documents.length}
          />
        </PanelOptions>
      </PanelBody>

      <PanelActions>
        {progress ? (
          <div className="export-progress">
            <ProgressBar
              label={
                progress.total > 1 && progress.done < progress.total
                  ? t('export.generatingOf', {
                      current: progress.done + 1,
                      total: progress.total,
                    })
                  : t('export.generating')
              }
              // Each document is one step and putting the file together is the last one
              value={
                progress.finished ? 1 : progress.done / (progress.total + 1)
              }
              onComplete={dismissProgress}
              data-testid="export-progress"
            />
          </div>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              void start(documents, exportSettings);
            }}
            disabled={!ready}
            data-testid="download"
          >
            {t('export.action')}
          </button>
        )}
        <div className="row">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              goTo('enhance');
            }}
          >
            {t('common.back')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={restart}>
            {t('export.restart')}
          </button>
        </div>
      </PanelActions>
    </Panel>
  );
}
