import type { JSX } from 'react';

import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  CloseIcon,
  type IconProps,
  InfoIcon,
} from '@/components/icons';
import { useTranslate } from '@/i18n';

import type { ToastAction, ToastKind } from './ToastContext';

type IconComponent = (props: IconProps) => JSX.Element;

const ICONS: {
  readonly success: IconComponent;
  readonly info: IconComponent;
  readonly warning: IconComponent;
  readonly error: IconComponent;
} = {
  success: CheckCircleIcon,
  info: InfoIcon,
  warning: AlertTriangleIcon,
  error: AlertCircleIcon,
} as const;

interface Props {
  kind: ToastKind;
  message: string;
  action?: ToastAction;
  onClose(): void;
}

/**
 * One toast: icon, message, an optional action button, and the close button. Errors are
 * announced right away.
 */
export function Toast({ kind, message, action, onClose }: Props): JSX.Element {
  const { t } = useTranslate();
  const Icon: IconComponent = ICONS[kind];

  return (
    <div
      className={`toast is-${kind}`}
      role={kind === 'error' ? 'alert' : 'status'}
      data-testid="toast"
      data-kind={kind}
    >
      <Icon className="toast-icon" />
      <p>{message}</p>
      {action && (
        <button
          type="button"
          className="toast-action"
          onClick={action.onClick}
          data-testid="toast-action"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="toast-close"
        onClick={onClose}
        aria-label={t('common.closeNotice')}
      >
        <CloseIcon />
      </button>
    </div>
  );
}
