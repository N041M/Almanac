import { describe, it, expect } from 'vitest';
import { createI18n, EN_US, CS_CZ, type LocaleBundles } from './index.js';

const bundles: LocaleBundles = {
  en: {
    app: { name: 'Almanac', greeting: 'Hello, {{who}}' },
    meals: { title: 'Meal planning' },
  },
  cs: {
    // deliberately missing `meals:title` to prove English fallback
    app: { name: 'Almanac', greeting: 'Ahoj, {{who}}' },
  },
};

describe('i18n', () => {
  it('resolves keys for the active language and interpolates params', () => {
    const i18n = createI18n({ locale: CS_CZ, bundles });
    expect(i18n.t('app:name')).toBe('Almanac');
    expect(i18n.t('app:greeting', { who: 'Ronald' })).toBe('Ahoj, Ronald');
  });

  it('falls back to English for a missing key (L7)', () => {
    const i18n = createI18n({ locale: CS_CZ, bundles });
    expect(i18n.t('meals:title')).toBe('Meal planning');
  });

  it('last resort is the key itself', () => {
    const i18n = createI18n({ locale: EN_US, bundles });
    expect(i18n.t('unknown:missing')).toBe('unknown:missing');
    expect(i18n.t('not-a-namespaced-key')).toBe('not-a-namespaced-key');
  });

  it('formats dates and numbers per locale/region', () => {
    const cs = createI18n({ locale: CS_CZ, bundles });
    const us = createI18n({ locale: EN_US, bundles });
    // region-specific separators/order (exact strings depend on ICU, so assert shape)
    expect(cs.formatNumber(1234.5)).not.toBe(us.formatNumber(1234.5));
    expect(us.formatDate('2026-07-01')).toContain('2026');
    expect(us.formatDate('2026-07-01', { month: '2-digit', day: '2-digit', year: 'numeric' }))
      .toMatch(/07\/01\/2026/);
  });
});
