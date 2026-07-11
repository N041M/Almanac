import type { Messages } from '@almanac/core';

/** English — the guaranteed-complete namespace every other locale falls back to (L7). */
export const en: Messages = {
  title: 'Cycle',
  flow: 'Flow',
  flow_light: 'Light',
  flow_medium: 'Medium',
  flow_heavy: 'Heavy',
  setFlow: 'Set flow to {{level}}',
  clearFlow: 'Clear flow',
  ovulationTest: 'LH test',
  test_positive: 'Positive',
  test_negative: 'Negative',
  setTest: 'Log a {{result}} ovulation test',
  clearTest: 'Clear the ovulation test',
  avgCycle: 'Average cycle {{days}} days',
  dayOfCycle: 'Day {{day}}',
  fertileWindow: 'Fertile window',
  nextPeriod: 'Next period around {{date}}',
  nextPeriodBetween: 'Next period between {{from}} and {{to}}',
  irregularNote: 'Recent cycles vary too much for an estimate — history and logging continue.',
  phase_menstrual: 'Menstrual phase',
  phase_follicular: 'Follicular phase',
  phase_ovulation: 'Around ovulation',
  phase_luteal: 'Luteal phase',
  informational: 'A personal estimate, informational only.',
  predictionSetting: 'Cycle predictions',
};
