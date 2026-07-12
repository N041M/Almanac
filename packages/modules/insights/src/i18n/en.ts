import type { Messages } from '@almanac/core';

/** English — the guaranteed-complete namespace every other locale falls back to (L7). */
export const en: Messages = {
  title: 'Insights',
  windowNote: 'From the last {{days}} days on this device. Descriptive only.',
  empty: 'Not much here yet — log check-ins, plan events, or track the cycle and insights appear.',
  timeAllocation: 'Time this week',
  hoursValue: '{{hours}} h',
  eventsCount: '{{count}} events',
  tasksDone: '{{count}} tasks done',
  moodEnergy: 'Mood & energy',
  avgMood: 'Mood {{value}}/5',
  avgEnergy: 'Energy {{value}}/5',
  corrTogether: '{{a}} and {{b}} tend to move together ({{strength}}).',
  corrOpposite: '{{a}} and {{b}} tend to move in opposite directions ({{strength}}).',
  strength_weak: 'weak',
  strength_moderate: 'moderate',
  strength_strong: 'strong',
  labelMood: 'Mood',
  labelEnergy: 'Energy',
  energyByPhase: 'Energy by cycle phase',
  phaseAvg: '{{value}}/5',
};
