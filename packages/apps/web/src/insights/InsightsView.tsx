import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  MS_PER_DAY,
  addDays,
  dateFromISO,
  getSlice,
  type Day,
  type ISODate,
  type SliceCodec,
} from '@almanac/core';
import { CHECKIN_NAMESPACE, checkinDayCodec, type CheckinDaySlice } from '@almanac/checkin';
import {
  CYCLE_NAMESPACE,
  cycleDayCodec,
  cycleStats,
  phaseInHistory,
  type CycleDaySlice,
} from '@almanac/cycle';
import {
  MIN_GROUP_SAMPLES,
  allocateMinutes,
  averageByGroup,
  correlate,
} from '@almanac/insights';
import { dayStore } from '../state/persistence';
import { useTasks } from '../state/tasks';
import { useCalendars, DEFAULT_CALENDAR_ID } from '../state/calendars';
import { useModuleVisible } from '../state/module-visibility';
import { today } from '../clock';

// Windows (exported per the constants convention).
export const INSIGHTS_WINDOW_DAYS = 90;
export const ALLOCATION_WINDOW_DAYS = 7;

/**
 * Insights (§8): descriptive cross-day analytics. The view is the app-side
 * assembler — it reads the shared day records and task state, shapes them
 * into neutral inputs, and hands them to the pure insights module (which
 * imports nothing). A panel without enough data simply isn't there; an
 * entirely thin history gets one actionable empty line (L5).
 */
export function InsightsView() {
  const { t } = useTranslation('insights');
  const { t: tApp } = useTranslation();
  const occurrences = useTasks((s) => s.occurrences);
  const items = useTasks((s) => s.items);
  const loadTasks = useTasks((s) => s.load);
  const calendars = useCalendars((s) => s.calendars);
  const tasksVisible = useModuleVisible('tasks');
  const cycleVisible = useModuleVisible('cycle');
  const checkinVisible = useModuleVisible('checkin');
  const [days, setDays] = useState<Day[]>([]);

  useEffect(() => {
    void loadTasks();
    const to = today();
    void dayStore
      .getRange(addDays(to, -INSIGHTS_WINDOW_DAYS), to, [
        checkinDayCodec as SliceCodec<unknown>,
        cycleDayCodec as SliceCodec<unknown>,
      ])
      .then(setDays);
  }, [loadTasks]);

  // Mood & energy from the check-in slices (hidden module ⇒ absent, L5).
  const checkin = useMemo(() => {
    if (!checkinVisible) return { moods: [], energies: [], pairs: [] as { x: number; y: number }[], byDate: new Map<ISODate, CheckinDaySlice>() };
    const moods: number[] = [];
    const energies: number[] = [];
    const pairs: { x: number; y: number }[] = [];
    const byDate = new Map<ISODate, CheckinDaySlice>();
    for (const day of days) {
      const slice = getSlice<CheckinDaySlice>(day, CHECKIN_NAMESPACE);
      if (slice === undefined) continue;
      byDate.set(day.date, slice);
      if (slice.mood !== null) moods.push(slice.mood);
      if (slice.energy !== null) energies.push(slice.energy);
      if (slice.mood !== null && slice.energy !== null) pairs.push({ x: slice.mood, y: slice.energy });
    }
    return { moods, energies, pairs, byDate };
  }, [days, checkinVisible]);

  // Energy grouped by (historical) cycle phase — both modules' data required.
  const phaseAverages = useMemo(() => {
    if (!cycleVisible || !checkinVisible) return [];
    const flows: ISODate[] = [];
    const positives: ISODate[] = [];
    for (const day of days) {
      const slice = getSlice<CycleDaySlice>(day, CYCLE_NAMESPACE);
      if (slice?.flow != null) flows.push(day.date);
      if (slice?.ovulationTest === 'positive') positives.push(day.date);
    }
    if (flows.length === 0) return [];
    const stats = cycleStats(flows, positives);
    const entries: { group: string; value: number }[] = [];
    for (const [date, slice] of checkin.byDate) {
      if (slice.energy === null) continue;
      const phase = phaseInHistory(date, stats);
      if (phase !== null) entries.push({ group: phase, value: slice.energy });
    }
    return averageByGroup(entries);
  }, [days, checkin, cycleVisible, checkinVisible]);

  // Time allocation over the last week: timed-event hours per calendar.
  const allocation = useMemo(() => {
    if (!tasksVisible) return { hours: [], events: 0, tasksDone: 0 };
    const to = today();
    const from = addDays(to, -(ALLOCATION_WINDOW_DAYS - 1));
    const name = (calendarId: string | undefined): string => {
      const id = calendarId ?? DEFAULT_CALENDAR_ID;
      if (id === DEFAULT_CALENDAR_ID) return tApp('defaultCalendarName');
      return calendars.find((c) => c.id === id)?.name ?? tApp('defaultCalendarName');
    };
    const spans: { key: string; minutes: number }[] = [];
    let events = 0;
    for (const [date, list] of occurrences(from, to)) {
      for (const occurrence of list) {
        if (occurrence.item.kind !== 'event') continue;
        events += 1;
        if (!('span' in occurrence.item.when)) continue;
        const { startUtc, endUtc } = occurrence.item.when.span;
        const dayStart = dateFromISO(date).getTime();
        const overlap =
          Math.min(endUtc, dayStart + MS_PER_DAY) - Math.max(startUtc, dayStart);
        spans.push({ key: name(occurrence.item.calendarId), minutes: overlap / 60_000 });
      }
    }
    const tasksDone = items.filter(
      (item) => item.kind === 'task' && item.doneAt !== null && item.doneAt >= from,
    ).length;
    return { hours: allocateMinutes(spans), events, tasksDone };
    // `items` also feeds the map so new/changed tasks re-derive.
  }, [occurrences, items, calendars, tasksVisible, tApp]);

  const moodEnergyCorr = correlate(checkin.pairs);
  const showMood = checkin.moods.length >= MIN_GROUP_SAMPLES;
  const showEnergy = checkin.energies.length >= MIN_GROUP_SAMPLES;
  const showAllocation = allocation.hours.length > 0 || allocation.tasksDone > 0;
  const anything =
    showMood || showEnergy || moodEnergyCorr !== null || phaseAverages.length > 0 || showAllocation;

  const mean = (xs: number[]): string =>
    (xs.reduce((a, b) => a + b, 0) / Math.max(xs.length, 1)).toFixed(1);
  const hours = (minutes: number): string => (minutes / 60).toFixed(1);

  const card = 'space-y-2 rounded-2xl border border-line bg-surface-raised p-4 shadow-sm';

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-semibold">{t('title')}</h2>
        <span className="text-xs text-ink-muted">
          {t('windowNote', { days: INSIGHTS_WINDOW_DAYS })}
        </span>
      </div>

      {!anything && <p className="text-sm text-ink-muted">{t('empty')}</p>}

      {showAllocation && (
        <section aria-label={t('timeAllocation')} className={card}>
          <h3 className="text-sm font-medium">{t('timeAllocation')}</h3>
          <ul className="space-y-1 text-sm">
            {allocation.hours.map(({ key, minutes }) => (
              <li key={key} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate">{key}</span>
                <span className="tabular-nums text-ink-muted">
                  {t('hoursValue', { hours: hours(minutes) })}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">
            {t('eventsCount', { count: allocation.events })} ·{' '}
            {t('tasksDone', { count: allocation.tasksDone })}
          </p>
        </section>
      )}

      {(showMood || showEnergy || moodEnergyCorr !== null) && (
        <section aria-label={t('moodEnergy')} className={card}>
          <h3 className="text-sm font-medium">{t('moodEnergy')}</h3>
          <p className="text-sm text-ink-muted">
            {showMood && <span className="mr-3">{t('avgMood', { value: mean(checkin.moods) })}</span>}
            {showEnergy && <span>{t('avgEnergy', { value: mean(checkin.energies) })}</span>}
          </p>
          {moodEnergyCorr !== null && (
            <p className="text-sm">
              {t(moodEnergyCorr.r > 0 ? 'corrTogether' : 'corrOpposite', {
                a: t('labelMood'),
                b: t('labelEnergy'),
                strength: t(`strength_${moodEnergyCorr.strength}`),
              })}
            </p>
          )}
        </section>
      )}

      {phaseAverages.length > 0 && (
        <section aria-label={t('energyByPhase')} className={card}>
          <h3 className="text-sm font-medium">{t('energyByPhase')}</h3>
          <ul className="space-y-1 text-sm">
            {phaseAverages.map(({ group, mean: value }) => (
              <li key={group} className="flex items-baseline justify-between gap-3">
                <span>{t(`cycle:phase_${group}`)}</span>
                <span className="tabular-nums text-ink-muted">
                  {t('phaseAvg', { value: value.toFixed(1) })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
