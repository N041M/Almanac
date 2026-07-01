import { useTranslation } from 'react-i18next';
import { EN_US, CS_CZ } from '@almanac/core';
import { useCalendar } from './state/store';
import { MonthView } from './calendar/MonthView';
import { DayPanel } from './calendar/DayPanel';

export function App() {
  const { t } = useTranslation();
  const locale = useCalendar((s) => s.locale);
  const setLocale = useCalendar((s) => s.setLocale);

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <label className="text-sm text-neutral-600">
          {t('language')}{' '}
          <select
            aria-label={t('language')}
            value={locale.language}
            onChange={(e) => {
              setLocale(e.target.value === 'cs' ? CS_CZ : EN_US);
            }}
            className="rounded border border-neutral-300 px-1 py-0.5"
          >
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
        </label>
      </header>

      <main className="grid gap-6 p-4 md:grid-cols-[2fr_1fr]">
        <MonthView />
        <aside className="border-t border-neutral-200 pt-4 md:border-l md:border-t-0 md:pl-4 md:pt-0">
          <DayPanel />
        </aside>
      </main>
    </div>
  );
}
