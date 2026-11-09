import {
  type AriaRole,
  type Context,
  createContext,
  type JSX,
  type PointerEvent,
  type ReactNode,
  type RefObject,
  useContext,
  useId,
  useRef,
} from 'react';

import { ChevronDownIcon } from '@/components/icons';
import { useTranslate } from '@/i18n';

import { usePanelCollapsed } from './usePanelCollapsed';

/** A vertical swipe on the handle shorter than this, in px, is a tap. */
const SWIPE_DISTANCE: number = 24;

interface PanelContextValue {
  /** Id of the {@link PanelOptions}, which the handle controls; undefined outside a panel. */
  optionsId: string | undefined;
}

const PanelContext: Context<PanelContextValue> =
  createContext<PanelContextValue>({
    optionsId: undefined,
  });

/**
 * Side panel of a step: a {@link PanelBody} with the options and, pinned to the bottom,
 * {@link PanelActions} or {@link StepNav}. On phones it is a sheet at the bottom of the screen, and
 * a handle on top collapses its {@link PanelOptions} to leave more room for the document: tap it,
 * or swipe it down to collapse and up to open. The choice holds for every step (see
 * {@link usePanelCollapsed}).
 */
export function Panel({ children }: { children: ReactNode }): JSX.Element {
  const { t } = useTranslate();
  const optionsId: string = useId();
  const [collapsed, setCollapsed] = usePanelCollapsed();
  const swipeStart: RefObject<number | null> = useRef<number | null>(null);
  // A swipe ends with a click on the handle, which must not toggle the panel back
  const swiped: RefObject<boolean> = useRef<boolean>(false);

  const handlePointerDown = (e: PointerEvent<HTMLButtonElement>): void => {
    swipeStart.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerUp = (e: PointerEvent<HTMLButtonElement>): void => {
    if (swipeStart.current === null) return;
    const distance: number = e.clientY - swipeStart.current;
    swipeStart.current = null;
    if (Math.abs(distance) < SWIPE_DISTANCE) return;
    swiped.current = true;
    setCollapsed(distance > 0);
  };

  const handleClick = (): void => {
    if (swiped.current) {
      swiped.current = false;
      return;
    }
    setCollapsed(!collapsed);
  };

  return (
    <aside className="panel" data-collapsed={collapsed || undefined}>
      <button
        type="button"
        className="panel-toggle"
        aria-expanded={!collapsed}
        aria-controls={optionsId}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          swipeStart.current = null;
        }}
        onClick={handleClick}
        data-testid="panel-toggle"
      >
        <span className="panel-handle" aria-hidden />
        <span className="panel-toggle-label">
          {t(collapsed ? 'panel.showOptions' : 'panel.hideOptions')}
          <ChevronDownIcon className="btn-icon panel-toggle-icon" />
        </span>
      </button>
      <PanelContext.Provider value={{ optionsId }}>
        {children}
      </PanelContext.Provider>
    </aside>
  );
}

/**
 * Content of a {@link Panel} above its actions, usually a {@link PanelHeader} and the
 * {@link PanelOptions}. It scrolls under the actions, which stay pinned to the bottom.
 */
export function PanelBody({ children }: { children: ReactNode }): JSX.Element {
  return <div className="panel-body">{children}</div>;
}

/** The options of a step, which the handle of the {@link Panel} collapses on phones. */
export function PanelOptions({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const { optionsId } = useContext(PanelContext);
  return (
    <div id={optionsId} className="panel-options">
      <div className="panel-options-content">{children}</div>
    </div>
  );
}

interface HeaderProps {
  title: string;
  /** Text under the title. Without it, only the title shows up. */
  text?: ReactNode;
  /** Role of the text, such as `status` when it changes as the user works. */
  textRole?: AriaRole;
  'data-testid'?: string;
}

/**
 * Title of a step's panel and, under it, an optional text such as the status of the step. On phones
 * the title is left to screen readers, as the top bar already shows the step, and the text shares
 * the first row with the handle.
 */
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

/**
 * Buttons pinned to the bottom of a {@link Panel}, so the main one stays visible while it scrolls.
 */
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

/**
 * The continue and back buttons of a step, at the bottom of its {@link Panel}. On phones they share
 * a row, back first.
 */
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
