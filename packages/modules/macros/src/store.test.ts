import { describe, expect, it } from 'vitest';
import { createDayStore, createMemoryStorage } from '@almanac/core';
import { createMacrosStore } from './store.js';
import { macrosDayCodec } from './slice.js';

function makeStore() {
  const storage = createMemoryStorage();
  return { storage, store: createMacrosStore(storage, createDayStore(storage)) };
}

describe('macros store — targets + day log (§11 slice isolation)', () => {
  it('round-trips targets, keeping only finite non-negative fields', async () => {
    const { store } = makeStore();
    await store.saveTargets({ kcal: 2000, proteinG: 150 });
    expect(await store.getTargets()).toEqual({ kcal: 2000, proteinG: 150 });
  });

  it('returns empty targets when nothing is stored (first-run, L5)', async () => {
    const { store } = makeStore();
    expect(await store.getTargets()).toEqual({});
  });

  it('degrades a corrupt targets payload to empty without throwing (L5)', async () => {
    const { storage, store } = makeStore();
    await storage.write('macros:targets', '{ not json');
    expect(await store.getTargets()).toEqual({});
  });

  it('round-trips a day log', async () => {
    const { store } = makeStore();
    await store.writeDay('2026-07-06', {
      entries: [{ id: 'a', label: 'Apple', macros: { kcal: 95 } }],
      plannedServings: 2,
    });
    expect(await store.readDay('2026-07-06')).toEqual({
      entries: [{ id: 'a', label: 'Apple', macros: { kcal: 95 } }],
      plannedServings: 2,
    });
  });

  it('drops one malformed log entry but keeps the rest (L5)', () => {
    const decoded = macrosDayCodec.decode({
      entries: [
        { id: 'a', label: 'Apple', macros: { kcal: 95 } },
        { label: 'no id' },
        { id: 'b', label: 'Egg', macros: { proteinG: 6, junk: 'x' } },
      ],
      plannedServings: -3,
    });
    expect(decoded.entries).toEqual([
      { id: 'a', label: 'Apple', macros: { kcal: 95 } },
      { id: 'b', label: 'Egg', macros: { proteinG: 6 } },
    ]);
    // Negative servings degrade to the default of 1.
    expect(decoded.plannedServings).toBe(1);
  });
});
