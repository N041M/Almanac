import { create } from 'zustand';
import { createPersistedList } from './persisted-list';
import { useCalendar } from './store';

/**
 * Multiple calendars (P6, D7): a calendar is a named color + visibility
 * toggle; entries carry `calendarId`. Hiding is a **view filter, never
 * deletion** — and an entry with an unknown calendarId renders on the default
 * calendar rather than being dropped (L5 matrix).
 */
export interface UserCalendar {
  id: string;
  name: string;
  /** Hue 0–359 — rendered theme-safely like tag colors. */
  hue: number;
  visible: boolean;
}

export const DEFAULT_CALENDAR_ID = 'default';
const DEFAULT_CALENDAR: UserCalendar = {
  id: DEFAULT_CALENDAR_ID,
  name: '',
  hue: 220,
  visible: true,
};

/**
 * A named swatch palette (Apple-style) — one accent hue each, rendered
 * theme-safely as `hsl(hue 65% 50%)`. Keys resolve to localized colour names.
 */
export const CALENDAR_COLORS: ReadonlyArray<{ key: string; hue: number }> = [
  { key: 'colorRed', hue: 5 },
  { key: 'colorOrange', hue: 35 },
  { key: 'colorYellow', hue: 55 },
  { key: 'colorGreen', hue: 140 },
  { key: 'colorTeal', hue: 180 },
  { key: 'colorBlue', hue: 220 },
  { key: 'colorPurple', hue: 285 },
  { key: 'colorPink', hue: 330 },
];

const persisted = createPersistedList<UserCalendar>({
  key: 'calendars:list',
  version: 1,
  defaultEntity: DEFAULT_CALENDAR,
  isEntity: (value): value is UserCalendar =>
    typeof value === 'object' &&
    value !== null &&
    typeof (value as UserCalendar).id === 'string' &&
    typeof (value as UserCalendar).name === 'string' &&
    typeof (value as UserCalendar).hue === 'number',
});

interface CalendarsState {
  loaded: boolean;
  calendars: UserCalendar[];

  load: () => Promise<void>;
  add: (name: string, hue: number) => Promise<void>;
  rename: (id: string, name: string) => Promise<void>;
  recolor: (id: string, hue: number) => Promise<void>;
  toggleVisible: (id: string) => Promise<void>;
  /** Show or hide every calendar at once (the popover's Show/Hide all). */
  setAllVisible: (visible: boolean) => Promise<void>;
  /** Entries keep their calendarId; they degrade to the default calendar. */
  remove: (id: string) => Promise<void>;
  /** Resolve an entry's calendar: unknown/hidden-aware helper. */
  calendarOf: (calendarId: string | undefined) => UserCalendar;
  /** Ids whose entries are currently filtered out of every view. */
  hiddenIds: () => Set<string>;
}

export const useCalendars = create<CalendarsState>((set, get) => {
  // `reload` re-reads the visible day range — needed when a change affects what
  // the grid shows (visibility, add/remove), skipped for cosmetic edits
  // (rename/recolor) so typing a name doesn't thrash the calendar.
  async function persist(calendars: UserCalendar[], reload = true): Promise<void> {
    set({ calendars });
    await persisted.write(calendars);
    if (reload) void useCalendar.getState().invalidateDays();
  }

  return {
    loaded: false,
    calendars: persisted.withDefault([]),

    load: async () => {
      if (get().loaded) return;
      const calendars = (await persisted.read()).map((c) => ({
        ...c,
        visible: c.visible !== false,
      }));
      set({ loaded: true, calendars });
    },

    add: (name, hue) =>
      persist([
        ...get().calendars,
        { id: crypto.randomUUID(), name: name.trim(), hue, visible: true },
      ]),

    rename: (id, name) =>
      persist(
        get().calendars.map((c) => (c.id === id ? { ...c, name: name.trim() } : c)),
        false,
      ),

    recolor: (id, hue) =>
      persist(
        get().calendars.map((c) => (c.id === id ? { ...c, hue } : c)),
        false,
      ),

    toggleVisible: (id) =>
      persist(get().calendars.map((c) => (c.id === id ? { ...c, visible: !c.visible } : c))),

    setAllVisible: (visible) => persist(get().calendars.map((c) => ({ ...c, visible }))),

    remove: (id) => {
      if (id === DEFAULT_CALENDAR_ID) return Promise.resolve(); // the fallback stays
      return persist(get().calendars.filter((c) => c.id !== id));
    },

    calendarOf: (calendarId) => {
      const { calendars } = get();
      return (
        calendars.find((c) => c.id === calendarId) ??
        calendars.find((c) => c.id === DEFAULT_CALENDAR_ID) ??
        DEFAULT_CALENDAR
      );
    },

    hiddenIds: () => new Set(get().calendars.filter((c) => !c.visible).map((c) => c.id)),
  };
});

/** Is this entry visible under the current calendar filters? (L5: unknown → default's visibility.) */
export function isEntryVisible(calendarId: string | undefined): boolean {
  return useCalendars.getState().calendarOf(calendarId).visible;
}
