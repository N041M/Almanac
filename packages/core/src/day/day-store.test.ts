import { describe, it, expect } from 'vitest';
import { getSlice } from './day.js';
import type { SliceCodec } from './slice-codec.js';
import { createDayStore } from './day-store.js';
import { createMemoryStorage } from './memory-storage.js';

interface Mood {
  energy: number;
}

const moodCodec: SliceCodec<Mood> = {
  namespace: 'checkin',
  version: 1,
  default: () => ({ energy: 0 }),
  decode: (raw) => {
    if (typeof raw !== 'object' || raw === null || typeof (raw as Mood).energy !== 'number') {
      throw new Error('bad mood slice');
    }
    return raw as Mood;
  },
  encode: (value) => value,
};

const tasksCodec: SliceCodec<string[]> = {
  namespace: 'tasks',
  version: 1,
  default: () => [],
  decode: (raw) => {
    if (!Array.isArray(raw)) throw new Error('bad tasks slice');
    return raw as string[];
  },
  encode: (value) => value,
};

describe('DayStore', () => {
  it('round-trips a slice and returns defaults for unwritten ones (sparse, L5)', async () => {
    const store = createDayStore(createMemoryStorage());
    expect(await store.readSlice('2026-07-01', moodCodec)).toEqual({ energy: 0 });

    await store.writeSlice('2026-07-01', moodCodec, { energy: 4 });
    expect(await store.readSlice('2026-07-01', moodCodec)).toEqual({ energy: 4 });

    const day = await store.getDay('2026-07-01', [moodCodec, tasksCodec]);
    expect(getSlice<Mood>(day, 'checkin')).toEqual({ energy: 4 });
    expect(getSlice<string[]>(day, 'tasks')).toEqual([]); // never written → default
  });

  it('isolates a corrupt slice: it degrades to default, neighbours are fine', async () => {
    const storage = createMemoryStorage({
      // hand-written corrupt payload for one slice
      'day:2026-07-01:checkin': '{"v":1,"d":{"energy":"not-a-number"}}',
    });
    const store = createDayStore(storage);
    await store.writeSlice('2026-07-01', tasksCodec, ['buy milk']);

    const day = await store.getDay('2026-07-01', [moodCodec, tasksCodec]);
    expect(getSlice<Mood>(day, 'checkin')).toEqual({ energy: 0 }); // corrupt → default
    expect(getSlice<string[]>(day, 'tasks')).toEqual(['buy milk']); // unaffected
  });

  it('falls back to default on an unknown stored version', async () => {
    const storage = createMemoryStorage({
      'day:2026-07-01:tasks': '{"v":99,"d":["stale"]}',
    });
    const store = createDayStore(storage);
    expect(await store.readSlice('2026-07-01', tasksCodec)).toEqual([]);
  });

  it('reads an inclusive date range', async () => {
    const store = createDayStore(createMemoryStorage());
    const days = await store.getRange('2026-07-01', '2026-07-03', [tasksCodec]);
    expect(days.map((d) => d.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03']);
  });
});
