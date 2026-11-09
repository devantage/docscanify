import type { JSX, ReactNode } from 'react';

export interface IconProps {
  className?: string;
}

/** Decorative 24×24 stroke icon; its accessible name comes from the surrounding control. */
function Icon({
  className,
  children,
}: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      {children}
    </svg>
  );
}

/** Camera: takes photos of documents. */
export const CameraIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
    <circle cx="12" cy="13" r="3.5" />
  </Icon>
);

/** Tray with an arrow going up: uploads images from the device. */
export const UploadIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="M17 8l-5-5-5 5" />
    <path d="M12 3v12" />
  </Icon>
);

/** Plus sign: adds more documents. */
export const PlusIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

/** Cross: closes or removes something, such as a toast or a document. */
export const CloseIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </Icon>
);

/** Check mark: a finished step or the chosen option. */
export const CheckIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
);

/** Padlock: the images stay on the device. */
export const LockIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <rect x="4" y="11" width="16" height="10" rx="2" />
    <path d="M8 11V7a4 4 0 0 1 8 0v4" />
  </Icon>
);

/** Scan frame with a sparkle: automatic edge detection. */
export const AutoDetectIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M12 7.5l1.1 3.4 3.4 1.1-3.4 1.1-1.1 3.4-1.1-3.4-3.4-1.1 3.4-1.1z" />
  </Icon>
);

/** Arrow turning counterclockwise: rotates the document a quarter turn to the left. */
export const RotateLeftIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M2.5 2v6h6" />
    <path d="M2.66 15.57a10 10 0 1 0 .57-8.38L2.5 8" />
  </Icon>
);

/** Arrow turning clockwise: rotates the document a quarter turn to the right. */
export const RotateRightIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M21.5 2v6h-6" />
    <path d="M21.34 15.57a10 10 0 1 1-.57-8.38L21.5 8" />
  </Icon>
);

/** Two overlapping sheets: applies the options to every document. */
export const CopyIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <rect x="8" y="8" width="13" height="13" rx="2" />
    <path d="M4 16V5a2 2 0 0 1 2-2h11" />
  </Icon>
);

/** Chevron pointing down: a list that opens, or the panel handle (turned up while collapsed). */
export const ChevronDownIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
);

/** Circle with an exclamation mark: an error. */
export const AlertCircleIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.5v5M12 16h.01" />
  </Icon>
);

/** Circle with an "i": a neutral notice. */
export const InfoIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </Icon>
);

/** Triangle with an exclamation mark: a warning. */
export const AlertTriangleIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <path d="M10.3 3.9 2.4 17.6A2 2 0 0 0 4.1 20.6h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Icon>
);

/** Circle with a check mark: a success. */
export const CheckCircleIcon = (props: IconProps): JSX.Element => (
  <Icon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12.5 2.7 2.7L16 9.8" />
  </Icon>
);
