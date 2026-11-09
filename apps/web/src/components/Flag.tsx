import './Flag.css';

import type { JSX, ReactNode } from 'react';

import type { FlagCode } from '@/i18n';

/**
 * Flags drawn at a 3:2 ratio (30 × 20) and simplified for small sizes. Inline SVG instead of
 * emoji: flag emoji do not render on Windows.
 */
const FLAGS: Record<FlagCode, ReactNode> = {
  br: (
    <>
      <rect width="30" height="20" fill="#009739" />
      <path d="M15 2.6 27.2 10 15 17.4 2.8 10z" fill="#fedd00" />
      <circle cx="15" cy="10" r="4.6" fill="#012169" />
      <path
        d="M10.6 9.2c3-.9 6.3-.6 8.9.9"
        fill="none"
        stroke="#fff"
        strokeWidth="0.9"
      />
    </>
  ),
  us: (
    <>
      <rect width="30" height="20" fill="#fff" />
      {[0, 2, 4, 6, 8, 10, 12].map((stripe: number) => (
        <rect
          key={stripe}
          y={(stripe * 20) / 13}
          width="30"
          height={20 / 13}
          fill="#b22234"
        />
      ))}
      <rect width="12" height={(7 * 20) / 13} fill="#3c3b6e" />
      <g fill="#fff">
        {[0, 1, 2, 3].map((row: number) =>
          [0, 1, 2, 3, 4].map((col: number) => (
            <circle
              key={`${row}-${col}`}
              cx={1.4 + col * 2.3 + (row % 2) * 1.15}
              cy={1.4 + row * 2.4}
              r="0.45"
            />
          )),
        )}
      </g>
    </>
  ),
  es: (
    <>
      <rect width="30" height="20" fill="#aa151b" />
      <rect y="5" width="30" height="10" fill="#f1bf00" />
    </>
  ),
};

interface Props {
  code: FlagCode;
}

/** Small decorative country flag; the language name next to it carries the meaning. */
export function Flag({ code }: Props): JSX.Element {
  return (
    <svg className="flag" viewBox="0 0 30 20" aria-hidden>
      {FLAGS[code]}
    </svg>
  );
}
