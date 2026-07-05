import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, dateFromISO } from '@almanac/core';
import { useCalendar } from '../state/store';
import { useMeals } from '../state/meals';
import { Button } from '../ui/Button';
import { MealWeekList } from './MealWeekList';
import { MealBreakdown } from './MealBreakdown';
import { MealsManager } from './MealsManager';

/**
 * Variety as three honest choices instead of a 0–1 slider; the engine keeps
 * its continuous contract (§6.4) — this is purely a UI simplification.
 * "Balanced" is the sweet spot the design doc names.
 */
const VARIETY_PRESETS = [
  { key: 'varietyPredictable', value: 0.15 },
  { key: 'varietyBalanced', value: 0.5 },
  { key: 'varietySurprising', value: 0.85 },
] as const;

/** Stored variety (possibly a legacy slider value) → the nearest preset. */
function closestVariety(variety: number): number {
  return VARIETY_PRESETS.reduce((best, preset) =>
    Math.abs(preset.value - variety) < Math.abs(best.value - variety) ? preset : best,
  ).value;
}

/**
 * The meals module's screen (§6 UX): the 7-day plan with lock/re-roll, the
 * variety control, generate/commit, the "why this pick" panel, and the meal
 * manager. All engine calls flow through the meals state — the view renders.
 */
export function MealsView() {
  const { t } = useTranslation('meals');
  const locale = useCalendar((s) => s.locale);
  const loaded = useMeals((s) => s.loaded);
  const load = useMeals((s) => s.load);
  const settings = useMeals((s) => s.settings);
  const items = useMeals((s) => s.items);
  const generate = useMeals((s) => s.generate);
  const commit = useMeals((s) => s.commit);
  const updateSettings = useMeals((s) => s.updateSettings);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded || settings === null) return null;

  const weekLabel = new Intl.DateTimeFormat(bcp47(locale), {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(dateFromISO(settings.weekStart));

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-base font-semibold">{t('weekOf', { date: weekLabel })}</h2>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-ink-muted">{t('variety')}</span>
          <div role="radiogroup" aria-label={t('variety')} className="flex gap-1.5">
            {VARIETY_PRESETS.map(({ key, value }) => {
              const active = closestVariety(settings.variety) === value;
              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => void updateSettings({ variety: value })}
                  className={[
                    'rounded-full border px-3 py-1 transition-colors',
                    'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
                    active
                      ? 'border-accent bg-accent font-medium text-accent-ink'
                      : 'border-line text-ink-muted hover:bg-accent-soft/60',
                  ].join(' ')}
                >
                  {t(key)}
                </button>
              );
            })}
          </div>
        </div>
        <Button variant="solid" onClick={() => void generate()} disabled={items.length === 0}>
          {t('generateWeek')}
        </Button>
        <Button onClick={() => void commit()}>{t('nextWeek')}</Button>
      </section>

      <section className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(14rem,2fr)]">
        <div className="rounded-2xl border border-line bg-surface-raised p-2 shadow-sm">
          <MealWeekList />
        </div>
        <aside className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
          <h3 className="mb-3 text-sm font-medium text-ink-muted">{t('whyThisPick')}</h3>
          <MealBreakdown />
        </aside>
      </section>

      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <MealsManager />
      </section>
    </div>
  );
}
