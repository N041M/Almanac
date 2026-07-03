import { useTranslation } from 'react-i18next';
import { EN_US, CS_CZ } from '@almanac/core';
import { useCalendar } from './state/store';
import { CalendarView } from './calendar/CalendarView';
import { DayPanel } from './calendar/DayPanel';

export function App() {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const setLocale = useCalendar((s) => s.setLocale);
  const view = useCalendar((s) => s.view);

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <label className="flex items-center gap-2 text-sm text-ink-muted">
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
    </div>
  );
}
