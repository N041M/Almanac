import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO, type ISODate } from '@almanac/core';
import {
  MIN_CYCLES_FOR_PREDICTION,
  cycleDayInfo,
  cycleStats,
  predictNextStart,
  predictionWindow,
  type FlowLevel,
  type OvulationTestResult,
} from '@almanac/cycle';
import { useCalendar } from '../state/store';
import { useCycle } from '../state/cycle';

const FLOW_LEVELS: ReadonlyArray<FlowLevel> = ['light', 'medium', 'heavy'];
const TEST_RESULTS: ReadonlyArray<OvulationTestResult> = ['positive', 'negative'];

/**
 * The cycle log (§8) on the day's detail surface: the day's flow, plus — with
 * enough history and predictions on — the averages, the estimated next start,
 * and the date's phase. All of it is a personal estimate, informational only;
 * with predictions off or thin history, logging alone is the whole feature (L5).
 */
export function CycleSection({ date }: { date: ISODate }) {
  const { t } = useTranslation('cycle');
  const locale = useCalendar((s) => s.locale);
  const days = useCycle((s) => s.days);
  const predictionEnabled = useCycle((s) => s.predictionEnabled);
  const load = useCycle((s) => s.load);
  const setFlow = useCycle((s) => s.setFlow);
  const setOvulationTest = useCycle((s) => s.setOvulationTest);
  const flow = days[date]?.flow ?? null;
  const test = days[date]?.ovulationTest ?? null;

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const entries = Object.entries(days);
    return cycleStats(
      entries.filter(([, slice]) => slice.flow !== null).map(([d]) => d),
      entries.filter(([, slice]) => slice.ovulationTest === 'positive').map(([d]) => d),
    );
  }, [days]);
  const nextStart = predictionEnabled ? predictNextStart(stats) : null;
  const window = predictionEnabled ? predictionWindow(stats) : null;
  const info = predictionEnabled ? cycleDayInfo(date, stats) : null;
  // Irregularity is only worth a note once there was enough history to try.
  const irregular =
    predictionEnabled &&
    stats.irregular &&
    stats.recentLengths.length >= MIN_CYCLES_FOR_PREDICTION;
  const dateFormat = new Intl.DateTimeFormat(bcp47(locale), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const fmt = (iso: string) => dateFormat.format(dateFromISO(iso));

  return (
    <section aria-label={t('title')} className="space-y-2.5 border-t border-line pt-4">
      <h4 className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t('title')}</h4>
      <div className="flex items-center gap-1.5">
        <span className="w-16 shrink-0 text-sm text-ink-muted">{t('flow')}</span>
        {FLOW_LEVELS.map((level) => {
          const active = flow === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={active}
              aria-label={
                active ? t('clearFlow') : t('setFlow', { level: t(`flow_${level}`) })
              }
              // Clicking the active level clears it — not logged is normal (L5).
              onClick={() => void setFlow(date, active ? null : level)}
              className={[
                'rounded-full px-2.5 py-1 text-xs transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                active
                  ? 'bg-accent font-semibold text-white'
                  : 'bg-accent-soft/60 text-ink-muted hover:bg-accent-soft',
              ].join(' ')}
            >
              {t(`flow_${level}`)}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-1.5">
        <span className="w-16 shrink-0 text-sm text-ink-muted">{t('ovulationTest')}</span>
        {TEST_RESULTS.map((result) => {
          const active = test === result;
          return (
            <button
              key={result}
              type="button"
              aria-pressed={active}
              aria-label={
                active ? t('clearTest') : t('setTest', { result: t(`test_${result}`) })
              }
              // Clicking the active result clears it — not logged is normal (L5).
              onClick={() => void setOvulationTest(date, active ? null : result)}
              className={[
                'rounded-full px-2.5 py-1 text-xs transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                active
                  ? 'bg-accent font-semibold text-white'
                  : 'bg-accent-soft/60 text-ink-muted hover:bg-accent-soft',
              ].join(' ')}
            >
              {t(`test_${result}`)}
            </button>
          );
        })}
      </div>
      {(nextStart !== null || info !== null || irregular) && (
        <p className="text-xs text-ink-muted">
          {info !== null && <span className="mr-2">{t('dayOfCycle', { day: info.day })}</span>}
          {info !== null && info.phase !== null && (
            <span className="mr-2">{t(`phase_${info.phase}`)}</span>
          )}
          {info?.fertile === true && (
            <span className="mr-2 rounded-full bg-accent-soft px-1.5 py-0.5">
              {t('fertileWindow')}
            </span>
          )}
          {stats.avgCycleDays !== null && (
            <span className="mr-2">
              {t('avgCycle', { days: Math.round(stats.avgCycleDays) })}
            </span>
          )}
          {irregular && <span className="mr-2">{t('irregularNote')}</span>}
          {nextStart !== null &&
            (window !== null && window.earliest !== window.latest ? (
              <span>
                {t('nextPeriodBetween', { from: fmt(window.earliest), to: fmt(window.latest) })}
              </span>
            ) : (
              <span>{t('nextPeriod', { date: fmt(nextStart) })}</span>
            ))}
          <span className="block">{t('informational')}</span>
        </p>
      )}
    </section>
  );
}
