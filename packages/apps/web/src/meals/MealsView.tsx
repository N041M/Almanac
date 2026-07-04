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
 * The meals module's screen (§6 UX): the 7-day plan with lock/re-roll, the
 * variety slider, generate/commit, the "why this pick" panel, and the meal
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
        <label className="flex items-center gap-2 text-sm text-ink-muted">
          <span className="sr-only">{t('variety')}</span>
          <span aria-hidden="true">{t('varietyPredictable')}</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.variety}
            aria-label={t('variety')}
            onChange={(e) => void updateSettings({ variety: Number(e.target.value) })}
            className="accent-accent"
          />
          <span aria-hidden="true">{t('varietySurprising')}</span>
        </label>
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
