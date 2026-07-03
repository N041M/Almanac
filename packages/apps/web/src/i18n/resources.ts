// UI strings for the shell. Module namespaces (meals, tasks, …) ship their own
// bundles later; here the app namespace covers the calendar chrome. Missing
// keys fall back to English (L7). Weekday/month names come from Intl, not here.
export const resources = {
  en: {
    app: {
      title: 'Almanac',
      today: 'Today',
      prevMonth: 'Previous month',
      nextMonth: 'Next month',
      language: 'Language',
      selectDay: 'Select a day to see details.',
      noEntries: 'Nothing planned yet.',
      star: 'Star this day',
      unstar: 'Remove star',
      starredLegend: 'Starred day',
    },
  },
  cs: {
    app: {
      title: 'Almanac',
      today: 'Dnes',
      prevMonth: 'Předchozí měsíc',
      nextMonth: 'Další měsíc',
      language: 'Jazyk',
      selectDay: 'Vyberte den pro zobrazení detailů.',
      noEntries: 'Zatím nic v plánu.',
      star: 'Označit den hvězdičkou',
      unstar: 'Odebrat hvězdičku',
      starredLegend: 'Označený den',
    },
  },
} as const;
