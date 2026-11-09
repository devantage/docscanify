import { describe, expect, it } from 'vitest';

import { type Step, stepIndex, STEPS } from './steps';

describe('STEPS', (): void => {
  it('lists the four steps of the top bar in the order of the flow', (): void => {
    expect(STEPS).toEqual([
      { id: 'upload', label: 'app.step.upload' },
      { id: 'crop', label: 'app.step.crop' },
      { id: 'enhance', label: 'app.step.enhance' },
      { id: 'export', label: 'app.step.export' },
    ]);
  });
});

describe('stepIndex', (): void => {
  it.each([
    ['upload', 0],
    ['crop', 1],
    ['enhance', 2],
    ['export', 3],
  ] as [Step, number][])(
    'puts %s at position %i',
    (step: Step, index: number): void => {
      expect(stepIndex(step)).toBe(index);
    },
  );

  it('orders the steps so that later steps have higher positions', (): void => {
    const order: number[] = STEPS.map((s: (typeof STEPS)[number]): number =>
      stepIndex(s.id),
    );

    expect(order).toEqual([0, 1, 2, 3]);
  });
});
