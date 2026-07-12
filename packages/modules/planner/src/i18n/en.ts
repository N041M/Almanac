import type { Messages } from '@almanac/core';

/** English — the guaranteed-complete namespace every other locale falls back to (L7). */
export const en: Messages = {
  title: 'Plan my day',
  confirm: 'Add block',
  dismiss: 'Dismiss {{title}}',
  slotAt: '{{time}} · {{date}}',
  whyDue: 'due {{date}}',
  whyOverdue: 'overdue',
  whyPriority: 'P{{priority}}',
  empty: 'Nothing to place — every task is scheduled, done, or the day is full.',
  note: 'Suggestions only — nothing moves unless you add it.',
};
