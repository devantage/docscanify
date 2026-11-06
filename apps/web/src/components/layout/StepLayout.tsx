import type { JSX, ReactNode } from 'react';

interface Props {
  /** Accessible name of the stage. */
  label: string;
  /** Content of the stage: the editor or the preview. */
  children: ReactNode;
  /** Extra class of the stage content area. */
  mainClassName?: string;
  /** Shown under the stage content, such as the document carousel. */
  footer?: ReactNode;
  /** Panel beside the stage (a sheet at the bottom on phones), usually a `Panel`. */
  panel: ReactNode;
}

/** Layout of a step with a stage on the left and a panel on the right. */
export function StepLayout({
  label,
  children,
  mainClassName,
  footer,
  panel,
}: Props): JSX.Element {
  return (
    <>
      <section className="stage stage-split" aria-label={label}>
        <div
          className={
            mainClassName ? `stage-main ${mainClassName}` : 'stage-main'
          }
        >
          {children}
        </div>
        {footer}
      </section>
      {panel}
    </>
  );
}
