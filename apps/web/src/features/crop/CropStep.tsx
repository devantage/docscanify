import type { Corners } from '@devantage/docscanify';
import type { JSX } from 'react';

import { AutoDetectIcon } from '@/components/icons';
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelOptions,
  StepNav,
} from '@/components/layout/Panel';
import { StepLayout } from '@/components/layout/StepLayout';
import { DocumentStrip } from '@/features/scan/DocumentStrip';
import { useActiveDocument, useScan } from '@/features/scan/useScan';
import { useSteps } from '@/features/steps';
import { useCommandShortcut } from '@/hooks/useCommandShortcut';
import { useTranslate } from '@/i18n';
import type { DocumentItem } from '@/lib/types';

import { CornerEditor } from './CornerEditor';
import { useCropAlerts, type UseCropAlertsResult } from './useCropAlerts';

/**
 * Crop step: the corner editor over the document on display (or an error when the edge detector
 * could not be loaded), the carousel, and the panel with automatic detection (also on Ctrl + Z,
 * Cmd + Z on a Mac), whose options collapse on phones. Continuing needs every document with valid
 * corners.
 */
export function CropStep(): JSX.Element {
  const { t } = useTranslate();
  const { goTo } = useSteps();
  const { invalidCount, setCorners, setDraggingCorner, redetect } = useScan();
  const doc: DocumentItem = useActiveDocument();
  const alerts: UseCropAlertsResult = useCropAlerts(doc, invalidCount);
  const autoDetect = (): void => {
    redetect(doc.id);
  };
  useCommandShortcut('z', autoDetect);

  const handleDraggingChange = (dragging: boolean): void => {
    setDraggingCorner(dragging);
    if (!dragging) alerts.dragEnded();
  };

  return (
    <StepLayout
      label={t('crop.stage')}
      footer={<DocumentStrip />}
      panel={
        <Panel>
          <PanelBody>
            <PanelHeader
              title={t('crop.title')}
              text={doc.corners ? t('crop.instructions') : undefined}
              data-testid="detect-status"
            />
            <PanelOptions>
              <div className="row">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={autoDetect}
                  data-testid="auto-detect"
                >
                  <AutoDetectIcon className="btn-icon" />
                  {t('crop.autoDetect')}
                </button>
              </div>
            </PanelOptions>
          </PanelBody>
          <StepNav
            onContinue={() => {
              goTo('enhance');
            }}
            onBack={() => {
              goTo('upload');
            }}
            continueDisabled={invalidCount > 0}
            continueTestId="crop"
          />
        </Panel>
      }
    >
      {doc.corners ? (
        <CornerEditor
          key={doc.id}
          source={doc.source}
          corners={doc.corners}
          onChange={(corners: Corners) => {
            setCorners(doc.id, corners);
          }}
          onDraggingChange={handleDraggingChange}
        />
      ) : (
        <p className="stage-status">{t('crop.detectorError')}</p>
      )}
    </StepLayout>
  );
}
