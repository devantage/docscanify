import './Spinner.css';

import type { JSX } from 'react';

interface Props {
  /** `inline` sits in the flow; `centered` sits in the middle of its positioned parent. */
  placement?: 'inline' | 'centered';
  'data-testid'?: string;
}

/** Decorative loading indicator; pair it with text or an `aria-busy` region. */
export function Spinner({
  placement = 'centered',
  'data-testid': testId,
}: Props): JSX.Element {
  return (
    <span
      className={`spinner is-${placement}`}
      aria-hidden
      data-testid={testId}
    />
  );
}
