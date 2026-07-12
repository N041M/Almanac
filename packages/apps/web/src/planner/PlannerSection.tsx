import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MS_PER_DAY, addDays, bcp47, dateFromISO, type ISODate } from '@almanac/core';
import type { EventItem } from '@almanac/tasks';
import {
  suggestBlocks,
  type BusyInterval,
  type PlanSuggestion,
  type PlannableTask,
} from '@almanac/planner';
import { useCalendar } from '../state/store';
import { useSettings } from '../state/settings';
import { useTasks, wallClockToUtc } from '../state/tasks';
import { viewerZone } from '../state/viewer-zone';
import { systemClock, today } from '../clock';
import { Button } from '../ui/Button';

/**
 * The planner (P9): a short list of suggested blocks for open tasks — today,
 * else tomorrow. Suggestions only: confirming creates an ordinary busy event
 * (which the next derivation treats as immovable); dismissing is session
 * state; when the day shifts, the list re-derives — it never rearranges
 * what's on the calendar. A full day means a shorter list, not a complaint (L5).
 */
export function PlannerSection() {
  const { t } = useTranslation('planner');
  const locale = useCalendar((s) => s.locale);
  const items = useTasks((s) => s.items);
  const occurrences = useTasks((s) => s.occurrences);
  const importEvents = useTasks((s) => s.importEvents);
  const loadTasks = useTasks((s) => s.load);
  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);
  const workStartHour = useSettings((s) => s.workStartHour);
  const workEndHour = useSettings((s) => s.workEndHour);
  const [handled, setHandled] = useState<ReadonlySet<string>>(new Set());

  const suggestions = useMemo((): PlanSuggestion[] => {
    const start = today();
    const dates: ISODate[] = [start, addDays(start, 1)];

    const tasks: PlannableTask[] = items
      .filter((item) => item.kind === 'task' && item.doneAt === null && !handled.has(item.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        priority: item.priority ?? null,
        dueDate: (item.kind === 'task' ? item.due?.date : undefined) ?? null,
      }));

    const busyByDate = new Map<ISODate, BusyInterval[]>();
    for (const [date, list] of occurrences(start, dates[dates.length - 1] ?? start)) {
      const dayStartUtc = wallClockToUtc(date, 0);
      const intervals: BusyInterval[] = [];
      for (const occurrence of list) {
        if (occurrence.item.kind !== 'event' || !('span' in occurrence.item.when)) continue;
        const { startUtc, endUtc } = occurrence.item.when.span;
        const startMin = Math.max((startUtc - dayStartUtc) / 60_000, 0);
        const endMin = Math.min((endUtc - dayStartUtc) / 60_000, MS_PER_DAY / 60_000);
        if (endMin > startMin) intervals.push({ startMin, endMin });
      }
      busyByDate.set(date, intervals);
    }

    const now = new Date(systemClock.now());
    return suggestBlocks(tasks, {
      dates,
      busyByDate,
      nowMin: now.getHours() * 60 + now.getMinutes(),
      ...(workStartHour !== null && { workStartHour }),
      ...(workEndHour !== null && { workEndHour }),
    });
  }, [items, occurrences, handled, workStartHour, workEndHour]);

  if (suggestions.length === 0) return null;

  const tag = bcp47(locale);
  const timeFormat = new Intl.DateTimeFormat(tag, { hour: 'numeric', minute: '2-digit' });
  const dayFormat = new Intl.DateTimeFormat(tag, { weekday: 'short', timeZone: 'UTC' });
  const timeLabel = (suggestion: PlanSuggestion): string => {
    const [y, m, d] = suggestion.date.split('-').map(Number);
    const at = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 0, suggestion.startMin);
    return t('slotAt', {
      time: timeFormat.format(at),
      date: dayFormat.format(dateFromISO(suggestion.date)),
    });
  };
  const why = (suggestion: PlanSuggestion): string => {
    const parts: string[] = [];
    if (suggestion.breakdown.priority !== null) {
      parts.push(t('whyPriority', { priority: suggestion.breakdown.priority }));
    }
    if (suggestion.breakdown.daysUntilDue !== null) {
      parts.push(
        suggestion.breakdown.daysUntilDue < 0
          ? t('whyOverdue')
          : t('whyDue', { date: suggestion.breakdown.dueDate }),
      );
    }
    return parts.join(' · ');
  };

  async function confirm(suggestion: PlanSuggestion): Promise<void> {
    const event: EventItem = {
      id: crypto.randomUUID(),
      title: suggestion.title,
      categories: [],
      contexts: [],
      kind: 'event',
      when: {
        span: {
          startUtc: wallClockToUtc(suggestion.date, suggestion.startMin),
          endUtc: wallClockToUtc(suggestion.date, suggestion.endMin),
          zone: viewerZone,
        },
      },
    };
    setHandled((was) => new Set([...was, suggestion.taskId]));
    await importEvents([event]);
  }

  return (
    <section
      aria-label={t('title')}
      className="space-y-2 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-medium">{t('title')}</h3>
        <span className="text-xs text-ink-muted">{t('note')}</span>
      </div>
      <ul className="space-y-1.5">
        {suggestions.map((suggestion) => (
          <li key={suggestion.taskId} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{suggestion.title}</span>
            {why(suggestion) !== '' && (
              <span className="shrink-0 text-xs text-ink-muted">{why(suggestion)}</span>
            )}
            <span className="shrink-0 tabular-nums text-ink-muted">{timeLabel(suggestion)}</span>
            <Button onClick={() => void confirm(suggestion)}>{t('confirm')}</Button>
            <button
              type="button"
              aria-label={t('dismiss', { title: suggestion.title })}
              onClick={() => setHandled((was) => new Set([...was, suggestion.taskId]))}
              className="shrink-0 text-xs text-ink-muted hover:text-ink"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
