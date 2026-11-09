import type { AriaRole, JSX, ReactNode } from 'react';

import { useTranslate } from '@/i18n';

/**
 * Side panel of a step: a `PanelBody` with the options and, pinned to the bottom, `PanelActions`
 * or `StepNav`.
 */
export function Panel({ children }: { children: ReactNode }): JSX.Element {
  return <aside className="panel">{children}</aside>;
}

/** Scrolling content of a `Panel`. */
export function PanelBody({ children }: { children: ReactNode }): JSX.Element {
  return <div className="panel-body">{children}</div>;
}

interface HeaderProps {
  title: string;
  /** Text under the title. Without it, only the title shows up. */
  text?: ReactNode;
  /** Role of the text, such as `status` when it changes as the user works. */
  textRole?: AriaRole;
  'data-testid'?: string;
}

export function PanelHeader({
  title,
  text,
  textRole,
  'data-testid': testId,
}: HeaderProps): JSX.Element {
  return (
    <>
      <h2 className="panel-title">{title}</h2>
      {text != null && (
        <p className="panel-text" role={textRole} data-testid={testId}>
          {text}
        </p>
      )}
    </>
  );
}

interface ActionsProps {
  children: ReactNode;
  /** On phones, puts a back button and a primary button side by side, back first. */
  nav?: boolean;
}

/** Buttons pinned to the bottom of a `Panel`, so the main one stays visible while it scrolls. */
export function PanelActions({
  children,
  nav = false,
}: ActionsProps): JSX.Element {
  return (
    <div className={nav ? 'panel-actions panel-nav' : 'panel-actions'}>
      {children}
    </div>
  );
}

interface NavProps {
  onContinue(): void;
  onBack(): void;
  continueDisabled?: boolean;
  continueTestId?: string;
}

/** The continue and back buttons of a step, at the bottom of its `Panel`. */
export function StepNav({
  onContinue,
  onBack,
  continueDisabled,
  continueTestId,
}: NavProps): JSX.Element {
  const { t } = useTranslate();
  return (
    <PanelActions nav>
      <button
        type="button"
        className="btn btn-primary"
        disabled={continueDisabled}
        onClick={onContinue}
        data-testid={continueTestId}
      >
        {t('common.continue')}
      </button>
      <button type="button" className="btn btn-ghost" onClick={onBack}>
        {t('common.back')}
      </button>
    </PanelActions>
  );
}
