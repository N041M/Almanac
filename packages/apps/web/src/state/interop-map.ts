import type { CalendarEvent } from '@almanac/calendar-interop';
import type { EventItem } from '@almanac/tasks';

// The app is the only place that sees both the interop DTO and the tasks event
// shape (L1: modules never see each other). `when` is structurally identical in
// both — built on the same core ISODate/TimedSpan — so it maps by assignment.

/**
 * Imported events take a **stable id derived from the ICS UID** (`ics-<uid>`),
 * so re-importing the same file upserts instead of duplicating, and an
 * import→export→import round-trip preserves identity (export unwraps the prefix
 * back to the original UID). Events created in-app carry a uuid and get a
 * synthesized UID on first export.
 */
const IMPORT_PREFIX = 'ics-';

/** A tasks event → the neutral ICS DTO (for export). */
export function toCalendarEvent(event: EventItem): CalendarEvent {
  const dto: CalendarEvent = {
    uid: event.id.startsWith(IMPORT_PREFIX) ? event.id.slice(IMPORT_PREFIX.length) : `${event.id}@almanac`,
    title: event.title,
    when: event.when,
  };
  if (event.notes !== undefined) dto.description = event.notes;
  if (event.place !== undefined) dto.location = event.place;
  if (event.recurrence !== undefined) dto.recurrence = event.recurrence;
  return dto;
}

/** An imported ICS DTO → a tasks event with an id stable across re-imports. */
export function toEventItem(source: CalendarEvent): EventItem {
  const item: EventItem = {
    id: `${IMPORT_PREFIX}${source.uid}`,
    kind: 'event',
    title: source.title,
    categories: [],
    contexts: [],
    when: source.when,
  };
  if (source.description !== undefined) item.notes = source.description;
  if (source.location !== undefined) item.place = source.location;
  if (source.recurrence !== undefined) item.recurrence = source.recurrence;
  return item;
}
