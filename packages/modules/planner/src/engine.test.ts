import { describe, expect, it } from 'vitest';
import { freeSlots, suggestBlocks, taskScore, type PlannableTask } from './engine.js';

const T = (id: string, priority: number | null, dueDate: string | null): PlannableTask => ({
  id,
  title: id,
  priority,
  dueDate,
});

const NO_BUSY = new Map<string, never[]>();

describe('free slots', () => {
  it('carves working hours around busy blocks; slivers are dropped', () => {
    const slots = freeSlots(
      [
        { startMin: 600, endMin: 660 }, // 10:00–11:00
        { startMin: 665, endMin: 720 }, // 11:05–12:00 (5-min sliver before it)
      ],
      540, // 09:00
      1020, // 17:00
      60,
    );
    expect(slots).toEqual([
      { startMin: 540, endMin: 600 },
      { startMin: 720, endMin: 1020 },
    ]);
  });

  it('respects "now" on the first day and overlapping blocks', () => {
    expect(freeSlots([{ startMin: 500, endMin: 700 }], 540, 720, 60, 650)).toEqual([]);
    expect(freeSlots([], 540, 1020, 60, 900)).toEqual([{ startMin: 900, endMin: 1020 }]);
  });
});

describe('scoring — deadline pressure × D9 priority, explained', () => {
  it('overdue and due-today saturate; further-out decays; priority divides', () => {
    const overdue = taskScore(T('a', null, '2026-07-10'), '2026-07-12');
    const dueToday = taskScore(T('b', null, '2026-07-12'), '2026-07-12');
    const nextWeek = taskScore(T('c', null, '2026-07-19'), '2026-07-12');
    const p1Today = taskScore(T('d', 1, '2026-07-12'), '2026-07-12');
    expect(overdue.daysUntilDue).toBe(-2);
    expect(overdue.score).toBe(dueToday.score);
    expect(nextWeek.score).toBeLessThan(dueToday.score);
    expect(p1Today.score).toBeGreaterThan(dueToday.score); // P1 beats no-priority
  });
});

describe('suggestBlocks — greedy earliest fit, deterministic, quiet on overflow', () => {
  it('places the most pressing task earliest, then fills forward', () => {
    const suggestions = suggestBlocks(
      [T('later', null, '2026-07-20'), T('urgent', 1, '2026-07-12')],
      { dates: ['2026-07-12'], busyByDate: NO_BUSY },
    );
    expect(suggestions.map((s) => s.taskId)).toEqual(['urgent', 'later']);
    expect(suggestions[0]).toMatchObject({ startMin: 540, endMin: 600 });
    expect(suggestions[1]).toMatchObject({ startMin: 600, endMin: 660 });
  });

  it('flows past busy blocks and into the next day when today is full', () => {
    const busy = new Map([
      ['2026-07-12', [{ startMin: 540, endMin: 960 }]], // 09:00–16:00 blocked
    ]);
    const suggestions = suggestBlocks([T('a', 1, '2026-07-12'), T('b', 2, '2026-07-12')], {
      dates: ['2026-07-12', '2026-07-13'],
      busyByDate: busy,
    });
    expect(suggestions[0]).toMatchObject({ date: '2026-07-12', startMin: 960 });
    expect(suggestions[1]).toMatchObject({ date: '2026-07-13', startMin: 540 });
  });

  it('a full window yields fewer suggestions, never a complaint (L5)', () => {
    const busy = new Map([['2026-07-12', [{ startMin: 0, endMin: 1440 }]]]);
    expect(
      suggestBlocks([T('a', 1, null)], { dates: ['2026-07-12'], busyByDate: busy }),
    ).toEqual([]);
  });

  it('is deterministic: identical input, identical output, stable tie-breaks', () => {
    const tasks = [T('b', 2, null), T('a', 2, null)];
    const once = suggestBlocks(tasks, { dates: ['2026-07-12'], busyByDate: NO_BUSY });
    const twice = suggestBlocks(tasks, { dates: ['2026-07-12'], busyByDate: NO_BUSY });
    expect(once).toEqual(twice);
    expect(once.map((s) => s.taskId)).toEqual(['a', 'b']); // id tie-break
  });

  it('honours "now": no suggestions in the past on the first day', () => {
    const suggestions = suggestBlocks([T('a', 1, null)], {
      dates: ['2026-07-12'],
      busyByDate: NO_BUSY,
      nowMin: 990, // 16:30 — only 30 min of the work day left
    });
    expect(suggestions).toEqual([]);
  });
});
