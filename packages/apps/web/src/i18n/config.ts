import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { mealsManifest } from '@almanac/meals';
import type { ModuleManifest } from '@almanac/core';
import { resources } from './resources';

// Framework wiring for react-i18next; the core i18n service stays framework-
// agnostic. English is the guaranteed-complete fallback (L7). Each module's
// namespace comes from its manifest — the shell wires modules, never the
// other way round (L1).
const manifests: ReadonlyArray<ModuleManifest> = [mealsManifest];

const withModules = structuredClone(resources) as Record<
  string,
  Record<string, Record<string, string>>
>;
for (const manifest of manifests) {
  for (const [language, messages] of Object.entries(manifest.messages ?? {})) {
    (withModules[language] ??= {})[manifest.id] = messages;
  }
}

void i18n.use(initReactI18next).init({
  resources: withModules,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'app',
  interpolation: { escapeValue: false },
});

// Keep the document language in sync so screen readers switch pronunciation.
i18n.on('languageChanged', (lng) => {
  if (typeof document !== 'undefined') document.documentElement.lang = lng;
});

export default i18n;
