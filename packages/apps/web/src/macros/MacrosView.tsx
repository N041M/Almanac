import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { bcp47, isValidISODate, type ISODate } from '@almanac/core';
import type { MacroSet } from '@almanac/food';
import { computeDayMacros, MACRO_FIELDS, type MacroField } from '@almanac/macros';
import { useCalendar } from '../state/store';
import { useMacros } from '../state/macros';
import { Button } from '../ui/Button';

const UNIT_KEY: Record<MacroField, 'unitKcal' | 'unitGram'> = {
  kcal: 'unitKcal',
  proteinG: 'unitGram',
  carbsG: 'unitGram',
  fatG: 'unitGram',
};

function numberFormat(locale: string) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
}

/** One macro's progress toward its target, or a plain intake readout when untargeted. */
function MacroBar({
  field,
  intake,
  target,
  remaining,
}: {
  field: MacroField;
  intake: number;
  target: number | undefined;
  remaining: number | undefined;
}) {
  const { t } = useTranslation('macros');
  const locale = useCalendar((s) => s.locale);
  const num = numberFormat(bcp47(locale));
  const unit = t(UNIT_KEY[field]);
  const pct = target !== undefined && target > 0 ? Math.min(100, (intake / target) * 100) : 0;
  const over = remaining !== undefined && remaining < 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span>{t(field)}</span>
        <span className="text-ink-muted">
          {num.format(intake)}
          {target !== undefined && ` / ${num.format(target)}`} {unit}
          {remaining !== undefined && (
            <span className={over ? 'ml-2 text-mark' : 'ml-2'}>
              {over
                ? `${num.format(-remaining)} ${unit} ${t('over')}`
                : `${num.format(remaining)} ${unit} ${t('remaining').toLowerCase()}`}
            </span>
          )}
        </span>
      </div>
      {target !== undefined && (
        <div className="h-2 overflow-hidden rounded-full bg-accent-soft/40">
          <div
            className={over ? 'h-full bg-mark' : 'h-full bg-accent'}
            style={{ width: `${over ? 100 : pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The macros module's screen (§8): editable daily targets, the planned meal's
 * auto-filled contribution, manual logging, and intake-vs-target bars. All
 * numbers derive from the day's plan + log — nothing is double-stored.
 */
export function MacrosView() {
  const { t } = useTranslation('macros');
  const locale = useCalendar((s) => s.locale);
  const loaded = useMacros((s) => s.loaded);
  const load = useMacros((s) => s.load);
  const date = useMacros((s) => s.date);
  const setDate = useMacros((s) => s.setDate);
  const targets = useMacros((s) => s.targets);
  const slice = useMacros((s) => s.slice);
  const plannedRecipes = useMacros((s) => s.plannedRecipes);
  const setTarget = useMacros((s) => s.setTarget);
  const setPlannedServings = useMacros((s) => s.setPlannedServings);
  const addEntry = useMacros((s) => s.addEntry);
  const removeEntry = useMacros((s) => s.removeEntry);
  const ingredients = useMacros((s) => s.ingredients);
  // Derived, not stored — recomputed from the day's plan + log (a stable memo,
  // never a fresh object per render, which would loop zustand's snapshot).
  const macros = useMemo(
    () =>
      computeDayMacros({
        plannedRecipes,
        ingredientsById: new Map(Object.entries(ingredients)),
        entries: slice.entries,
        plannedServings: slice.plannedServings,
        targets,
      }),
    [plannedRecipes, ingredients, slice, targets],
  );
  const [label, setLabel] = useState('');
  const [amounts, setAmounts] = useState<Record<MacroField, string>>({
    kcal: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
  });

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded) return null;

  const num = numberFormat(bcp47(locale));
  const hasTargets = MACRO_FIELDS.some((f) => targets[f] !== undefined);

  function submitEntry(e: React.FormEvent) {
    e.preventDefault();
    const macroSet: MacroSet = {};
    for (const field of MACRO_FIELDS) {
      const n = Number(amounts[field]);
      if (amounts[field] !== '' && Number.isFinite(n) && n >= 0) macroSet[field] = n;
    }
    void addEntry(label, macroSet);
    setLabel('');
    setAmounts({ kcal: '', proteinG: '', carbsG: '', fatG: '' });
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3">
        <h2 className="mr-auto text-base font-semibold">{t('title')}</h2>
        <input
          type="date"
          aria-label={t('title')}
          value={date}
          onChange={(e) => {
            if (isValidISODate(e.target.value)) void setDate(e.target.value as ISODate);
          }}
          className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
        />
      </section>

      {/* Targets — always editable (§8). */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-ink-muted">{t('targets')}</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {MACRO_FIELDS.map((field) => (
            <label key={field} className="flex flex-col gap-1 text-xs text-ink-muted">
              {t(field)} ({t(UNIT_KEY[field])})
              <input
                type="number"
                min={0}
                aria-label={`${t('targets')}: ${t(field)}`}
                value={targets[field] ?? ''}
                onChange={(e) =>
                  void setTarget(field, e.target.value === '' ? null : Number(e.target.value))
                }
                className="rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          ))}
        </div>
      </section>

      {/* Intake vs targets. */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        <h3 className="mb-3 text-sm font-medium text-ink-muted">{t('intake')}</h3>
        {!hasTargets && macros.intake.kcal === undefined && (
          <p className="text-sm text-ink-muted">{t('noTargets')}</p>
        )}
        <div className="space-y-3">
          {MACRO_FIELDS.map((field) => (
            <MacroBar
              key={field}
              field={field}
              intake={macros.intake[field] ?? 0}
              target={targets[field]}
              remaining={macros.remaining[field]}
            />
          ))}
        </div>
      </section>

      {/* Sources: the planned meal (auto) + manual entries. */}
      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        {plannedRecipes.length > 0 && (
          <div className="mb-3 flex items-center gap-3 text-sm">
            <span className="text-ink-muted">{t('fromPlan')}:</span>
            <span className="font-medium">{plannedRecipes.map((r) => r.name).join(' · ')}</span>
            <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
              {t('plannedServings')}
              <input
                type="number"
                min={0}
                step={0.5}
                aria-label={t('plannedServings')}
                value={slice.plannedServings}
                onChange={(e) => void setPlannedServings(Number(e.target.value))}
                className="w-16 rounded-lg border border-line bg-surface px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
              />
            </label>
          </div>
        )}

        {slice.entries.length === 0 && plannedRecipes.length === 0 && (
          <p className="mb-3 text-sm text-ink-muted">{t('noData')}</p>
        )}

        {slice.entries.length > 0 && (
          <ul className="mb-3 divide-y divide-line/60">
            {slice.entries.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span>{entry.label}</span>
                <span className="text-ink-muted">
                  {MACRO_FIELDS.filter((f) => entry.macros[f] !== undefined)
                    .map((f) => `${num.format(entry.macros[f] ?? 0)} ${t(UNIT_KEY[f])}`)
                    .join(' · ')}
                </span>
                <Button
                  variant="ghost"
                  className="ml-auto"
                  aria-label={t('removeEntry', { name: entry.label })}
                  onClick={() => void removeEntry(entry.id)}
                >
                  ✕
                </Button>
              </li>
            ))}
          </ul>
        )}

        <form className="flex flex-wrap items-end gap-2" onSubmit={submitEntry}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={t('entryNamePlaceholder')}
            aria-label={t('logFood')}
            className="min-w-40 flex-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          {MACRO_FIELDS.map((field) => (
            <input
              key={field}
              type="number"
              min={0}
              value={amounts[field]}
              onChange={(e) => setAmounts((a) => ({ ...a, [field]: e.target.value }))}
              placeholder={t(field)}
              aria-label={`${t('logFood')}: ${t(field)}`}
              className="w-20 rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
            />
          ))}
          <Button type="submit" variant="outline">
            {t('addEntry')}
          </Button>
        </form>
      </section>
    </div>
  );
}
