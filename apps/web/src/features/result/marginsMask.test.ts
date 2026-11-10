import { describe, expect, it } from 'vitest';

import {
  formatMargins,
  isNonDigitKey,
  isTypedChange,
  MARGINS_STEP,
  parseSteppedMargins,
  parseTypedMargins,
} from './marginsMask';

describe('MARGINS_STEP', (): void => {
  it('steps by one hundredth of a centimeter', (): void => {
    expect(MARGINS_STEP).toBe(0.01);
  });
});

describe('formatMargins', (): void => {
  it.each([
    [0, '0.00'],
    [1.5, '1.50'],
    [3, '3.00'],
    [0.07, '0.07'],
    [10, '10.00'],
  ])(
    'always gives 2 decimal places: %s cm as %s',
    (margins: number, value: string): void => {
      expect(formatMargins(margins)).toBe(value);
    },
  );
});

describe('isTypedChange', (): void => {
  it.each([
    'insertText',
    'insertCompositionText',
    'deleteContentBackward',
    'deleteContentForward',
    'deleteByCut',
  ])('follows the mask for %s', (inputType: string): void => {
    expect(isTypedChange(new InputEvent('input', { inputType }))).toBe(true);
  });

  it.each(['insertFromPaste', 'insertFromDrop', 'insertReplacementText'])(
    'reads %s as a whole number',
    (inputType: string): void => {
      expect(isTypedChange(new InputEvent('input', { inputType }))).toBe(false);
    },
  );

  it('reads the step arrows and the mouse wheel, a plain Event, as a whole number', (): void => {
    expect(isTypedChange(new Event('input'))).toBe(false);
  });
});

describe('isNonDigitKey', (): void => {
  /** A key press with no modifier. */
  const press = (
    key: string,
  ): Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'altKey'> => ({
    key,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
  });

  it.each(['e', 'E', '+', '-', '.', ',', 'a', ' '])(
    'blocks "%s", which is not a digit',
    (key: string): void => {
      expect(isNonDigitKey(press(key))).toBe(true);
    },
  );

  it.each(['0', '5', '9', 'Backspace', 'Delete', 'ArrowUp', 'Tab', 'Enter'])(
    'lets "%s" through',
    (key: string): void => {
      expect(isNonDigitKey(press(key))).toBe(false);
    },
  );

  it.each([
    { ctrlKey: true, metaKey: false, altKey: false },
    { ctrlKey: false, metaKey: true, altKey: false },
    { ctrlKey: false, metaKey: false, altKey: true },
  ])('lets shortcuts through: %o', (modifiers: object): void => {
    expect(isNonDigitKey({ ...press('v'), ...modifiers })).toBe(false);
  });
});

describe('parseTypedMargins', (): void => {
  it('fills from the right: the last two digits are the decimal places', (): void => {
    expect(parseTypedMargins('0.001', 10)).toBe(0.01);
    expect(parseTypedMargins('0.012', 10)).toBe(0.12);
    expect(parseTypedMargins('0.125', 10)).toBe(1.25);
  });

  it('shifts the digits right when the last one is deleted', (): void => {
    expect(parseTypedMargins('1.2', 10)).toBe(0.12);
    expect(parseTypedMargins('0.1', 10)).toBe(0.01);
  });

  it('starts over when the selected value is replaced by a digit', (): void => {
    expect(parseTypedMargins('7', 10)).toBe(0.07);
  });

  it('is 0 when the field is emptied', (): void => {
    expect(parseTypedMargins('', 10)).toBe(0);
  });

  it.each(['0.35', '1.13', '0.57', '9.99'])(
    'keeps %s exact, without float noise',
    (value: string): void => {
      expect(parseTypedMargins(value, 10)).toBe(Number(value));
    },
  );

  it('limits the margins to the maximum', (): void => {
    expect(parseTypedMargins('10.001', 10)).toBe(10);
    expect(parseTypedMargins('99999999999999999999', 10)).toBe(10);
  });
});

describe('parseSteppedMargins', (): void => {
  it('reads a step that dropped its trailing zero as it is: 1.29 up to 1.3', (): void => {
    expect(parseSteppedMargins('1.3', 10)).toBe(1.3);
  });

  it.each([
    ['1.25', 1.25],
    ['1.5', 1.5],
    ['2', 2],
  ])('reads a pasted %s as %s cm', (value: string, margins: number): void => {
    expect(parseSteppedMargins(value, 10)).toBe(margins);
  });

  it.each([
    ['1.234', 1.23],
    ['1.236', 1.24],
    ['1.13', 1.13],
  ])(
    'rounds %s to 2 decimal places: %s',
    (value: string, margins: number): void => {
      expect(parseSteppedMargins(value, 10)).toBe(margins);
    },
  );

  it.each([
    ['-1', 0],
    ['', 0],
    ['10.01', 10],
    ['25', 10],
  ])(
    'keeps %s between 0 and the maximum: %s',
    (value: string, margins: number): void => {
      expect(parseSteppedMargins(value, 10)).toBe(margins);
    },
  );
});
