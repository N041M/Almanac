import { diffDays, type ISODate } from '@almanac/core';

/**
 * The planner engine (P9 roadmap addition): deterministic timeboxing, no
 * "AI". It scores unscheduled tasks by deadline pressure and numbered
 * priority (D9), then places the best ones into open working-hour slots
 * around the existing busy blocks — earliest fit first. The meal engine's
 * posture applies throughout: pure logic over neutral inputs, exported
 * tuning constants, and a per-suggestion breakdown ("why this slot"). One
 * deliberate difference: no `Rng` — a plan suggestion must be reproducible
 * and explainable, so ties break by stable ordering, never by draw.
 *
 * Product rule (the trust line): these are **suggestions the user confirms —
 * never silent moves**. When the day shifts, callers re-derive; confirmed
 * blocks are ordinary events this engine treats as immovable busy input.
 * No slot fitting a task is a quiet, normal outcome (L5).
 */

// Tuning values (exported per the constants convention).
export const DEFAULT_BLOCK_MIN = 60;
export const DEFAULT_WORK_START_HOUR = 9;
export const DEFAULT_WORK_END_HOUR = 17;
/** Keep suggestions a short, quiet list — a planner, not a nag. */
export const SUGGESTION_LIMIT = 5;
/** Deadline pressure saturates this many days out (beyond ⇒ minimal urgency). */
export const URGENCY_HORIZON_DAYS = 14;

/** A minutes-of-day interval on one date (the app flattens spans to these). */
export interface BusyInterval {
  startMin: number;
  endMin: number;
}

export interface PlannableTask {
  id: string;
  title: string;
  /** D9 numbered priority: 1 = most important, unbounded; absent = none. */
  priority: number | null;
  /** Due date, if any — the deadline-pressure input. */
  dueDate: ISODate | null;
}

export interface SuggestionBreakdown {
  priority: number | null;
  dueDate: ISODate | null;
  /** Days from the planning day to the due date (negative = overdue). */
  daysUntilDue: number | null;
  score: number;
}

export interface PlanSuggestion {
  taskId: string;
  title: string;
  date: ISODate;
  startMin: number;
  endMin: number;
  breakdown: SuggestionBreakdown;
}

export interface PlanOptions {
  /** The days to plan, in order (typically today, or today + tomorrow). */
  dates: ReadonlyArray<ISODate>;
  /** Busy minute-intervals per date (confirmed blocks, meetings, focus). */
  busyByDate: ReadonlyMap<ISODate, ReadonlyArray<BusyInterval>>;
  workStartHour?: number;
  workEndHour?: number;
  blockMin?: number;
  /** Planning "now": on the first date, slots before it are gone (L4). */
  nowMin?: number;
}

/** Free intervals of at least `blockMin` inside working hours, minus busy. */
export function freeSlots(
  busy: ReadonlyArray<BusyInterval>,
  workStartMin: number,
  workEndMin: number,
  blockMin: number,
  fromMin = 0,
): BusyInterval[] {
  const sorted = [...busy]
    .filter((b) => b.endMin > b.startMin)
    .sort((a, b) => a.startMin - b.startMin);
  const out: BusyInterval[] = [];
  let cursor = Math.max(workStartMin, fromMin);
  for (const block of sorted) {
    if (block.startMin > cursor) {
      const end = Math.min(block.startMin, workEndMin);
      if (end - cursor >= blockMin) out.push({ startMin: cursor, endMin: end });
    }
    cursor = Math.max(cursor, block.endMin);
    if (cursor >= workEndMin) break;
  }
  if (workEndMin - cursor >= blockMin) out.push({ startMin: cursor, endMin: workEndMin });
  return out;
}

/**
 * Deadline pressure × priority, on the planning day. Higher = plan sooner.
 * Overdue and due-today saturate; no due date contributes baseline pressure;
 * priority divides (P1 strongest), clamped so deep priorities still surface.
 */
export function taskScore(task: PlannableTask, onDate: ISODate): SuggestionBreakdown {
  const daysUntilDue = task.dueDate === null ? null : diffDays(onDate, task.dueDate);
  const urgency =
    daysUntilDue === null
      ? 1 / (URGENCY_HORIZON_DAYS + 1)
      : daysUntilDue <= 0
        ? 1
        : Math.max(1 - daysUntilDue / URGENCY_HORIZON_DAYS, 1 / (URGENCY_HORIZON_DAYS + 1));
  const priorityFactor = task.priority === null ? 0.5 : 1 / Math.min(task.priority, 9);
  return {
    priority: task.priority,
    dueDate: task.dueDate,
    daysUntilDue,
    score: urgency * priorityFactor,
  };
}

/**
 * Greedy earliest-fit: best-scored tasks take the earliest open slot across
 * the window. Deterministic — ties break by due date, then priority, then id.
 * Tasks that fit nowhere are simply absent from the result (L5).
 */
export function suggestBlocks(
  tasks: ReadonlyArray<PlannableTask>,
  options: PlanOptions,
): PlanSuggestion[] {
  const workStart = (options.workStartHour ?? DEFAULT_WORK_START_HOUR) * 60;
  const workEnd = (options.workEndHour ?? DEFAULT_WORK_END_HOUR) * 60;
  const blockMin = options.blockMin ?? DEFAULT_BLOCK_MIN;
  const firstDate = options.dates[0];
  if (firstDate === undefined || workEnd - workStart < blockMin) return [];

  const ranked = tasks
    .map((task) => ({ task, breakdown: taskScore(task, firstDate) }))
    .sort((a, b) => {
      if (b.breakdown.score !== a.breakdown.score) return b.breakdown.score - a.breakdown.score;
      const dueA = a.task.dueDate ?? '9999-12-31';
      const dueB = b.task.dueDate ?? '9999-12-31';
      if (dueA !== dueB) return dueA < dueB ? -1 : 1;
      const priA = a.task.priority ?? Number.MAX_SAFE_INTEGER;
      const priB = b.task.priority ?? Number.MAX_SAFE_INTEGER;
      if (priA !== priB) return priA - priB;
      return a.task.id < b.task.id ? -1 : 1;
    })
    .slice(0, SUGGESTION_LIMIT);

  // Mutable free-slot state per date, consumed as suggestions land.
  const free = new Map<ISODate, BusyInterval[]>();
  options.dates.forEach((date, i) => {
    free.set(
      date,
      freeSlots(
        options.busyByDate.get(date) ?? [],
        workStart,
        workEnd,
        blockMin,
        i === 0 ? (options.nowMin ?? 0) : 0,
      ),
    );
  });

  const suggestions: PlanSuggestion[] = [];
  for (const { task, breakdown } of ranked) {
    for (const date of options.dates) {
      const slots = free.get(date) ?? [];
      const slot = slots[0];
      if (slot === undefined) continue;
      const startMin = slot.startMin;
      const endMin = startMin + blockMin;
      suggestions.push({ taskId: task.id, title: task.title, date, startMin, endMin, breakdown });
      // Consume the front of the slot; drop it when too small to host another.
      if (slot.endMin - endMin >= blockMin) slots[0] = { startMin: endMin, endMin: slot.endMin };
      else slots.shift();
      break;
    }
    // No slot on any date: the task stays unscheduled, quietly (L5).
  }
  return suggestions;
}
