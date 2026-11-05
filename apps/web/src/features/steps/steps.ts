import type { TranslationKey } from '@/i18n';

/** Step of the flow, in the order of the top bar. */
export type Step = 'upload' | 'crop' | 'enhance' | 'export';

/** Steps of the top bar, in order. */
export const STEPS: { id: Step; label: TranslationKey }[] = [
  { id: 'upload', label: 'app.step.upload' },
  { id: 'crop', label: 'app.step.crop' },
  { id: 'enhance', label: 'app.step.enhance' },
  { id: 'export', label: 'app.step.export' },
];

/** Position of a step in the top bar. */
export const stepIndex = (step: Step): number =>
  STEPS.findIndex((s: { id: Step; label: TranslationKey }) => s.id === step);
