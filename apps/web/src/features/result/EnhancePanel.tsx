import type { JSX } from 'react';

import { CopyIcon } from '@/components/icons';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelOptions,
  StepNav,
} from '@/components/layout/Panel';
import type { ToastContextValue } from '@/components/toast/ToastContext';
import { useActiveDocument, useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useToast } from '@/hooks/useToast';
import { useTranslate } from '@/i18n';
import type { DocumentItem, EnhanceOptions } from '@/lib/types';

import { EnhanceOptionsForm } from './EnhanceOptionsForm';

interface Props {
  /** Render status of the preview, shown under the title. */
  status: string;
}

/**
 * Panel of the Enhance step: the adjustments of the document on display, which the user can
 * collapse on phones. With several documents, "apply to all" copies color and sharpness to the
 * others; rotation stays per document.
 */
export function EnhancePanel({ status }: Props): JSX.Element {
  const { t } = useTranslate();
  const toast: ToastContextValue = useToast();
  const { goTo } = useSteps();
  const { documents, setOptions, applyOptionsToAll } = useScan();
  const doc: DocumentItem = useActiveDocument();
  const count: number = documents.length;

  const applyToAll = (): void => {
    applyOptionsToAll(doc.id);
    toast.success(t('enhance.applied', { count }), { id: 'apply-all' });
  };

  return (
    <Panel>
      <PanelBody>
        <PanelHeader
          title={t('enhance.title')}
          text={status}
          textRole="status"
          data-testid="result-size"
        />
        <PanelOptions>
          <EnhanceOptionsForm
            options={doc.options}
            onChange={(options: EnhanceOptions) => {
              setOptions(doc.id, options);
            }}
          />
          {count > 1 && (
            <div className="field">
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={applyToAll}
                data-testid="apply-all"
              >
                <CopyIcon className="btn-icon" />
                {t('enhance.applyAll')}
              </button>
              <p className="panel-hint">{t('enhance.applyAllHint')}</p>
            </div>
          )}
        </PanelOptions>
      </PanelBody>
      <StepNav
        onContinue={() => {
          goTo('export');
        }}
        onBack={() => {
          goTo('crop');
        }}
        continueTestId="continue"
      />
    </Panel>
  );
}
