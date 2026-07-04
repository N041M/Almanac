import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EN_US, CS_CZ } from '@almanac/core';
import { useCalendar } from './state/store';
import { CalendarView } from './calendar/CalendarView';
import { DayPanel } from './calendar/DayPanel';
import { MealsView } from './meals/MealsView';

type Screen = 'calendar' | 'meals';

export function App() {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const setLocale = useCalendar((s) => s.setLocale);
  const view = useCalendar((s) => s.view);
  const [screen, setScreen] = useState<Screen>('calendar');

  const tab = (target: Screen, label: string) => (
    <button
      type="button"
      onClick={() => setScreen(target)}
      aria-current={screen === target ? 'page' : undefined}
      className={[
        'rounded-lg px-3 py-1.5 text-sm transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent',
        screen === target ? 'bg-accent text-accent-ink' : 'text-ink-muted hover:bg-accent-soft/60',
      ].join(' ')}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-4 border-b border-line px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <nav aria-label={t('navigation')} className="flex gap-1">
          {tab('calendar', t('navCalendar'))}
          {tab('meals', t('meals:title'))}
        </nav>
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-muted">
          {t('language')}
          <select
            aria-label={t('language')}
            value={locale.language}
            onChange={(e) => {
              setLocale(e.target.value === 'cs' ? CS_CZ : EN_US);
            }}
            className="rounded-lg border border-line bg-surface-raised px-2 py-1 text-ink focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
        </label>
      </header>

      {screen === 'meals' ? (
        <main className="mx-auto max-w-5xl p-6">
          <MealsView />
        </main>
      ) : (
        <main
          className={[
            'mx-auto grid max-w-5xl gap-6 p-6',
            // Day view IS the day detail — no sidebar duplicating it.
            view === 'day' ? '' : 'md:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]',
          ].join(' ')}
        >
          <div className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
            <CalendarView />
          </div>
          {view !== 'day' && (
            <aside className="rounded-2xl border border-line bg-surface-raised p-4 shadow-sm">
              <DayPanel />
            </aside>
          )}
        </main>
      )}
    </div>
  );
}
