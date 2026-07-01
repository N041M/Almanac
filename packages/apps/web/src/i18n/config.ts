import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resources } from './resources';

// Framework wiring for react-i18next; the core i18n service stays framework-
// agnostic. English is the guaranteed-complete fallback (L7).
void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  defaultNS: 'app',
  interpolation: { escapeValue: false },
});

export default i18n;
