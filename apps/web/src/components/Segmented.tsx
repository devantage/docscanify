import './Segmented.css';

import type { JSX } from 'react';

export interface SegmentedItem<T> {
  value: T;
  label: string;
}

interface Props<T> {
  legend: string;
  /** Radio group name; must be unique on the page. */
  name: string;
  /** Options, in display order. */
  items: SegmentedItem<T>[];
  value: T;
  onChange(value: T): void;
}

/**
 * Picks one option out of a few, shown side by side. Built on native radio buttons, so it works
 * with the keyboard and screen readers.
 */
export function Segmented<T extends string | number>({
  legend,
  name,
  items,
  value,
  onChange,
}: Props<T>): JSX.Element {
  return (
    <fieldset className="field">
      <legend>{legend}</legend>
      <div
        className="segmented"
        style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}
      >
        {items.map((item: SegmentedItem<T>) => (
          <label
            key={item.value}
            className={value === item.value ? 'is-on' : ''}
          >
            <input
              type="radio"
              name={name}
              value={item.value}
              checked={value === item.value}
              onChange={() => {
                onChange(item.value);
              }}
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
