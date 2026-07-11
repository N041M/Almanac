import { describe, expect, it } from 'vitest';
import { createMemoryStorage } from '@almanac/core';
import { createShoppingStore } from './store.js';
import { DEFAULT_SHOPPING_SETTINGS } from './settings.js';
import { decodeShoppingSettings } from './settings.js';

describe('shopping store — settings persistence (§11 slice isolation)', () => {
  it('round-trips the schedule', async () => {
    const store = createShoppingStore(createMemoryStorage());
    await store.saveSettings({
      recurrence: { freq: 'weekly', start: '2026-07-11' },
      horizonDays: 5,
    });
    expect(await store.getSettings()).toEqual({
      recurrence: { freq: 'weekly', start: '2026-07-11' },
      horizonDays: 5,
    });
  });

  it('returns defaults when nothing is stored (first-run empty state, L5)', async () => {
    const store = createShoppingStore(createMemoryStorage());
    expect(await store.getSettings()).toEqual(DEFAULT_SHOPPING_SETTINGS);
  });

  it('degrades a corrupt payload to defaults without throwing (L5)', async () => {
    const storage = createMemoryStorage();
    await storage.write('shopping:settings', '{ not json');
    const store = createShoppingStore(storage);
    expect(await store.getSettings()).toEqual(DEFAULT_SHOPPING_SETTINGS);
  });
});

describe('decodeShoppingSettings — per-field degradation', () => {
  it('drops a malformed recurrence but keeps a valid horizon', () => {
    expect(decodeShoppingSettings({ recurrence: { freq: 'weekly' }, horizonDays: 10 })).toEqual({
      horizonDays: 10,
    });
  });

  it('falls back to the default horizon for a non-positive value', () => {
    expect(decodeShoppingSettings({ horizonDays: 0 })).toEqual(DEFAULT_SHOPPING_SETTINGS);
  });
});
