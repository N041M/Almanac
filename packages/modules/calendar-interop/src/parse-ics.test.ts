import { describe, expect, it } from 'vitest';
import { parseIcs } from './parse-ics.js';

/** ICS uses CRLF; build fixtures from lines so the folding/unfolding is exercised. */
function ics(...lines: string[]): string {
  return lines.join('\r\n');
}

describe('parseIcs (RFC 5545 subset, P8)', () => {
  it('parses an all-day event', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VCALENDAR',
        'BEGIN:VEVENT',
        'UID:a@x',
        'SUMMARY:Birthday',
        'DTSTART;VALUE=DATE:20260706',
        'DTEND;VALUE=DATE:20260707',
        'END:VEVENT',
        'END:VCALENDAR',
      ),
    );
    expect(skipped).toBe(0);
    expect(events).toEqual([{ uid: 'a@x', title: 'Birthday', when: { allDay: '2026-07-06' } }]);
  });

  it('parses a UTC timed event with description + location', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:b@x',
        'SUMMARY:Standup',
        'DESCRIPTION:Daily sync\\, room 2',
        'LOCATION:HQ',
        'DTSTART:20260706T090000Z',
        'DTEND:20260706T093000Z',
        'END:VEVENT',
      ),
    );
    const event = events[0];
    expect(event?.title).toBe('Standup');
    expect(event?.description).toBe('Daily sync, room 2');
    expect(event?.location).toBe('HQ');
    expect(event?.when).toEqual({
      span: { startUtc: Date.UTC(2026, 6, 6, 9, 0, 0), endUtc: Date.UTC(2026, 6, 6, 9, 30, 0), zone: 'UTC' },
    });
  });

  it('resolves a TZID datetime to the correct absolute instant', () => {
    // Prague is UTC+2 in July (DST): 09:00 local = 07:00 UTC.
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:c@x',
        'SUMMARY:Prague',
        'DTSTART;TZID=Europe/Prague:20260706T090000',
        'END:VEVENT',
      ),
    );
    const when = events[0]?.when;
    expect(when).toEqual({
      span: { startUtc: Date.UTC(2026, 6, 6, 7, 0, 0), endUtc: Date.UTC(2026, 6, 6, 7, 0, 0), zone: 'Europe/Prague' },
    });
  });

  it('maps a weekly RRULE with BYDAY + EXDATE to a core Recurrence', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:d@x',
        'SUMMARY:Gym',
        'DTSTART;VALUE=DATE:20260706',
        'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;COUNT=10',
        'EXDATE;VALUE=DATE:20260720',
        'END:VEVENT',
      ),
    );
    expect(events[0]?.recurrence).toEqual({
      freq: 'weekly',
      start: '2026-07-06',
      interval: 2,
      count: 10,
      byWeekday: [1, 3],
      exDates: ['2026-07-20'],
    });
  });

  it('unfolds long folded lines before parsing', () => {
    const { events } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:e@x',
        'SUMMARY:A very long title that spilled over the seventy-five octet fold bound',
        ' ary',
        'DTSTART;VALUE=DATE:20260706',
        'END:VEVENT',
      ),
    );
    expect(events[0]?.title).toBe('A very long title that spilled over the seventy-five octet fold boundary');
  });

  it('ignores a VALARM sub-component without treating it as an event', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:f@x',
        'SUMMARY:With alarm',
        'DTSTART;VALUE=DATE:20260706',
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'TRIGGER:-PT15M',
        'END:VALARM',
        'END:VEVENT',
      ),
    );
    expect(skipped).toBe(0);
    expect(events).toHaveLength(1);
    expect(events[0]?.title).toBe('With alarm');
  });

  it('skips and counts an event with no DTSTART; the rest still import (L5)', () => {
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:g@x',
        'SUMMARY:No start',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'UID:h@x',
        'SUMMARY:Fine',
        'DTSTART;VALUE=DATE:20260706',
        'END:VEVENT',
      ),
    );
    expect(skipped).toBe(1);
    expect(events.map((e) => e.uid)).toEqual(['h@x']);
  });

  it('never throws on garbage input', () => {
    expect(parseIcs('not an ics file at all')).toEqual({ events: [], skipped: 0 });
    expect(parseIcs('')).toEqual({ events: [], skipped: 0 });
  });

  it('parses a realistic export (VTIMEZONE, DTSTAMP, X-props, two events)', () => {
    // Shaped like a Google Calendar export: a VTIMEZONE block that must be
    // ignored, DTSTAMP/SEQUENCE/STATUS/X- props, and a TZID datetime.
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VCALENDAR',
        'PRODID:-//Google Inc//Google Calendar 70.9054//EN',
        'VERSION:2.0',
        'CALSCALE:GREGORIAN',
        'BEGIN:VTIMEZONE',
        'TZID:Europe/Prague',
        'BEGIN:DAYLIGHT',
        'TZOFFSETFROM:+0100',
        'TZOFFSETTO:+0200',
        'DTSTART:19700329T020000',
        'END:DAYLIGHT',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        'DTSTART;TZID=Europe/Prague:20260706T100000',
        'DTEND;TZID=Europe/Prague:20260706T110000',
        'DTSTAMP:20260601T120000Z',
        'UID:evt1@google.com',
        'SEQUENCE:2',
        'STATUS:CONFIRMED',
        'SUMMARY:Planning meeting',
        'X-GOOGLE-CONFERENCE:https://meet.google.com/abc',
        'END:VEVENT',
        'BEGIN:VEVENT',
        'DTSTART;VALUE=DATE:20261225',
        'DTEND;VALUE=DATE:20261226',
        'DTSTAMP:20260601T120000Z',
        'UID:evt2@google.com',
        'SUMMARY:Christmas',
        'END:VEVENT',
        'END:VCALENDAR',
      ),
    );
    expect(skipped).toBe(0);
    expect(events.map((e) => e.uid)).toEqual(['evt1@google.com', 'evt2@google.com']);
    // 10:00 Prague (UTC+2 in July) = 08:00 UTC.
    expect(events[0]?.when).toEqual({
      span: { startUtc: Date.UTC(2026, 6, 6, 8, 0), endUtc: Date.UTC(2026, 6, 6, 9, 0), zone: 'Europe/Prague' },
    });
    expect(events[1]?.when).toEqual({ allDay: '2026-12-25' });
  });

  it('documents DST-boundary handling for a TZID wall time', () => {
    // 2026-03-29 02:30 Prague is inside the spring-forward gap; the offset
    // resolves via Intl and never throws — the instant is defined, not dropped.
    const { events, skipped } = parseIcs(
      ics(
        'BEGIN:VEVENT',
        'UID:dst@x',
        'SUMMARY:Edge',
        'DTSTART;TZID=Europe/Prague:20260329T023000',
        'END:VEVENT',
      ),
    );
    expect(skipped).toBe(0);
    const when = events[0]?.when;
    expect(when !== undefined && 'span' in when && Number.isFinite(when.span.startUtc)).toBe(true);
  });
});
