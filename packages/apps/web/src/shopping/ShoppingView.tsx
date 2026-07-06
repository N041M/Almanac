import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { addDays, bcp47, dateFromISO, type ISODate, type Quantity, type Weekday } from '@almanac/core';
import { OTHER_AISLE, type ShoppingLine } from '@almanac/shopping';
import { useCalendar } from '../state/store';
import { useShopping, shoppingWeekday } from '../state/shopping';
import { Button } from '../ui/Button';

/** Sunday-based reference week so `Intl` can name each weekday (0 = Sunday). */
const WEEKDAY_REF = '2024-01-07' as ISODate;

function weekdayNames(locale: string): { value: Weekday; label: string }[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  return [0, 1, 2, 3, 4, 5, 6].map((w) => ({
    value: w as Weekday,
    label: fmt.format(dateFromISO(addDays(WEEKDAY_REF, w))),
  }));
}

function formatQuantities(quantities: Quantity[], locale: string): string {
  if (quantities.length === 0) return '';
  const num = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  return quantities.map((q) => `${num.format(q.value)} ${q.unit}`).join(' + ');
}

function LineRow({ line }: { line: ShoppingLine }) {
  const { t } = useTranslation('shopping');
  const locale = useCalendar((s) => s.locale);
  const checked = useShopping((s) => s.checked[line.ingredientId] ?? false);
  const toggle = useShopping((s) => s.toggleChecked);
  const qty = formatQuantities(line.quantities, bcp47(locale));

  return (
    <li className="flex items-center gap-3 py-1.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={() => toggle(line.ingredientId)}
        className="size-4 accent-accent"
        aria-label={line.name}
      />
      <span className={checked ? 'text-ink-muted line-through' : ''}>{line.name}</span>
      {qty !== '' && <span className="text-sm text-ink-muted">{qty}</span>}
      {line.flagged && (
        <span className="text-xs text-ink-muted" title={t('quantityUnknown')}>
          ⚠
        </span>
      )}
    </li>
  );
}

/**
 * The shopping module's screen (§8.1): one derived list, two triggers —
 * "shopping now" (ad-hoc) and scheduled trips. Checkboxes, a manual-add field,
 * and the schedule controls; the list itself is never stored, only recomputed.
 */
export function ShoppingView() {
  const { t } = useTranslation('shopping');
  const locale = useCalendar((s) => s.locale);
  const loaded = useShopping((s) => s.loaded);
  const load = useShopping((s) => s.load);
  const settings = useShopping((s) => s.settings);
  const window = useShopping((s) => s.window);
  const list = useShopping((s) => s.list);
  const trips = useShopping((s) => s.trips);
  const manual = useShopping((s) => s.manual);
  const shopNow = useShopping((s) => s.shopNow);
  const viewTrip = useShopping((s) => s.viewTrip);
  const setShoppingDay = useShopping((s) => s.setShoppingDay);
  const setHorizon = useShopping((s) => s.setHorizon);
  const addManual = useShopping((s) => s.addManual);
  const removeManual = useShopping((s) => s.removeManual);
  const toggleChecked = useShopping((s) => s.toggleChecked);
  const checked = useShopping((s) => s.checked);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    void load();
  }, [load]);

  if (!loaded || settings === null) return null;

  const bcp = bcp47(locale);
  const rangeFmt = new Intl.DateTimeFormat(bcp, { day: 'numeric', month: 'short', timeZone: 'UTC' });
  const rangeLabel = (w: { start: ISODate; end: ISODate }) =>
    rangeFmt.formatRange(dateFromISO(w.start), dateFromISO(w.end));
  const weekday = shoppingWeekday(settings);
  const isEmpty = list !== null && list.groups.length === 0 && manual.length === 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-3">
        <Button variant="solid" onClick={() => void shopNow()}>
          {t('shoppingNow')}
        </Button>
        {window !== null && <h2 className="text-base font-semibold">{rangeLabel(window)}</h2>}

        <label className="ml-auto flex items-center gap-2 text-xs text-ink-muted">
          {t('shoppingDays')}
          <select
            aria-label={t('shoppingDays')}
            value={weekday ?? ''}
            onChange={(e) =>
              void setShoppingDay(e.target.value === '' ? null : (Number(e.target.value) as Weekday))
            }
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="">—</option>
            {weekdayNames(bcp).map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2 text-xs text-ink-muted">
          {t('horizon')}
          <input
            type="number"
            min={1}
            aria-label={t('horizon')}
            value={settings.horizonDays}
            onChange={(e) => void setHorizon(Number(e.target.value))}
            className="w-16 rounded-lg border border-line bg-surface-raised px-2 py-1 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
      </section>

      {trips.length > 0 && (
        <section className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-muted">{t('scheduledTrips')}</span>
          {trips.map((trip) => (
            <Button key={trip.start} variant="ghost" onClick={() => void viewTrip(trip)}>
              {rangeLabel(trip)}
            </Button>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
        {list !== null && list.missingRecipes.length > 0 && (
          <p className="mb-3 text-xs text-ink-muted">
            {t('missingRecipes', { count: list.missingRecipes.length })}
          </p>
        )}

        {isEmpty && (
          <div className="py-6 text-center text-sm text-ink-muted">
            <p>{t('emptyList')}</p>
            <p className="mt-1">{t('emptyHint')}</p>
          </div>
        )}

        <div className="space-y-4">
          {list?.groups.map((group) => (
            <div key={group.aisle}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {group.aisle === OTHER_AISLE ? t('otherAisle') : group.aisle}
              </h3>
              <ul className="divide-y divide-line/60">
                {group.lines.map((line) => (
                  <LineRow key={line.ingredientId} line={line} />
                ))}
              </ul>
            </div>
          ))}

          {manual.length > 0 && (
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
                {t('addItem')}
              </h3>
              <ul className="divide-y divide-line/60">
                {manual.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 py-1.5">
                    <input
                      type="checkbox"
                      checked={checked[item.id] ?? false}
                      onChange={() => toggleChecked(item.id)}
                      className="size-4 accent-accent"
                      aria-label={item.name}
                    />
                    <span className={checked[item.id] ? 'text-ink-muted line-through' : ''}>
                      {item.name}
                    </span>
                    <Button
                      variant="ghost"
                      className="ml-auto"
                      aria-label={t('removeItem', { name: item.name })}
                      onClick={() => removeManual(item.id)}
                    >
                      ✕
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form
          className="mt-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addManual(draft);
            setDraft('');
          }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t('itemNamePlaceholder')}
            aria-label={t('addItem')}
            className="flex-1 rounded-lg border border-line bg-surface-raised px-3 py-1.5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-accent"
          />
          <Button type="submit" variant="outline">
            {t('addItem')}
          </Button>
        </form>
      </section>
    </div>
  );
}
