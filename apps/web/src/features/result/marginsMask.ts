/** Hundredths in a centimeter: the margins field takes exactly 2 decimal places. */
const HUNDREDTHS_PER_CM: number = 100;

/** Step of the margins field, so its arrows change the margins by 0.01 cm. */
export const MARGINS_STEP: number = 1 / HUNDREDTHS_PER_CM;

/**
 * Changes that come from the keyboard text, which follow the mask. Pasting, dropping and
 * replacing (autocorrect) give a whole number instead, like the step arrows.
 */
const TYPED_INPUT_TYPES: RegExp = /^(insert(Text|CompositionText)?|delete\w*)$/;

/**
 * Value of the margins number field: always 2 decimal places (`"1.50"`). The browser shows it with
 * the decimal separator of its own language.
 *
 * @param margins Margins in centimeters.
 */
export function formatMargins(margins: number): string {
  return margins.toFixed(2);
}

/**
 * Whether a change of the field was typed or deleted, and so follows the mask. The step arrows
 * and the mouse wheel send a plain `Event`, with no `inputType`.
 */
export function isTypedChange(event: Event): boolean {
  return TYPED_INPUT_TYPES.test((event as Partial<InputEvent>).inputType ?? '');
}

/**
 * Whether a key would type something other than a digit, which the masked field ignores. Number
 * fields accept `e`, `+`, `-` and separators, which would leave them invalid and empty. Shortcuts
 * (copy, paste, select all) and keys such as arrows and Backspace stay allowed.
 */
export function isNonDigitKey(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'>,
): boolean {
  return (
    event.key.length === 1 &&
    !/\d/.test(event.key) &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.altKey
  );
}

/**
 * Reads a typed change, which fills from the right like a money field: only the digits count,
 * and the last two are the decimal places. Typing `1`, `2`, `5` gives 0.01, 0.12 and 1.25;
 * deleting the last digit of 1.25 gives 0.12. An empty field is 0.
 *
 * @param value Value of the field after the user typed or deleted.
 * @param max Largest margins accepted, in centimeters; larger values become `max`.
 * @returns Margins in centimeters.
 */
export function parseTypedMargins(value: string, max: number): number {
  const hundredths: number = Number(value.replace(/\D/g, '') || 0);
  return Math.min(hundredths, max * HUNDREDTHS_PER_CM) / HUNDREDTHS_PER_CM;
}

/**
 * Reads a change that gives a whole number: the step arrows (which drop trailing zeros, so 1.29
 * goes up to `"1.3"`), the mouse wheel, or a paste. It is rounded to 2 decimal places and kept
 * between 0 and `max`; an empty or invalid value is 0.
 *
 * @param value Value of the field after the change.
 * @param max Largest margins accepted, in centimeters.
 * @returns Margins in centimeters.
 */
export function parseSteppedMargins(value: string, max: number): number {
  const margins: number = Math.min(max, Math.max(0, Number(value) || 0));
  return Math.round(margins * HUNDREDTHS_PER_CM) / HUNDREDTHS_PER_CM;
}
