# Roadmap

The authoritative build sequence. Extends the design doc's §13 with the
calendar-completeness features a mainstream calendar app is expected to have
(gap analysis, 2026-07-03) — each placed as **core primitive, module, or view**
per the laws (L1–L8). §2 (laws) and §6 (meal engine) remain exact contracts.

Status: ✅ done · 🔨 in progress · — planned.

---

## Phase summary

| # | Phase | Contents | Status |
|---|---|---|---|
| 0 | Scaffold | workspaces, boundary lint, strict TS, CI, i18n rig | ✅ |
| 1 | Core | day record/store, calendar model, recurrence v1, units, registry, i18n, ports | ✅ |
| 2 | Calendar shell | tokens/dark UI, month/week/day views, keyboard grid, EN+CS, localStorage; **remaining:** SQLite `StoragePort` + a `tauri dev` sanity run | 🔨 |
| 3 | Food kernel | Ingredient/Recipe/NutritionFacts; OFF adapter + caching + degradation | — |
| 4 | Meals module | §6 engine exactly, TDD + statistical suite; **module-manifest seam defined first** | — |
| 5 | Macros + Shopping | both modules + UI; two-trigger aggregation (§8.1) | — |
| 6 | Calendar core v2 | recurrence v2 · timed/multi-day/timezone events · `NotificationPort` · hour-grid + agenda views · drag & drop · undo | — |
| 7 | Tasks module | tasks/events/habits on v2 primitives; NL quick entry; command palette; notifications wired | — |
| 8 | Interop & findability | ICS import/export · calendar subscriptions · search · year view · printing | — |
| 9 | Life modules | check-in · cycle · body · workouts · weather · insights · birthdays | — |
| 10 | Sync | D1/D4: accounts, per-slice LWW revision sync, server-durable | — |
| 11 | Mobile + surfaces | Expo client · widgets · tray mini-calendar · polish | — |
| 12 | Multi-user | shared calendars · attendees/invites/RSVP · free-busy + find-a-time · booking pages · conferencing links | — |

Rationale for the order: meals-first stays (D0). Phase 6 must precede Phase 7 —
the tasks module stores recurring/timed events, so their **shape must be final
before the first event is persisted** (migrations are the tax for deciding
late).

---

## Phase 6 — Calendar core v2 (the two early contracts + notifications + views)

### 6.1 Recurrence v2 (core `schedule/`)
Extends `Recurrence` **additively** (v1 rules keep working):
- `freq: 'yearly'` (birthdays, anniversaries).
- `byWeekdayPos` — nth weekday of month ("2nd Tuesday"), incl. `-1` for last.
- `exDates: ISODate[]` — "delete just this occurrence".
- **Per-instance overrides**, the series-vs-instance contract: an override is a
  small record `{ seriesId, occurrenceDate, changes | 'cancelled' }` stored in
  the owning module's slice; `occurrencesInRange` output is post-processed by
  an `applyOverrides` helper. The series stays one rule; instances stay cheap.
- Same L5 posture: malformed input → `[]`, never throws.

### 6.2 Timed, multi-day, timezone-aware events (core `time/` + conventions)
- **All-day events** stay pure `ISODate` (timezone-free — the current model).
- **Timed events** store `{ startUtc: number, endUtc: number, zone: string }` —
  the instant is absolute (UTC ms), `zone` is the *display intent* (IANA id).
  Rendering resolves via `Intl` in the viewer's or the event's zone; travel
  doesn't corrupt anything because the instant never changes.
- **Multi-day spans** derive per-day presence: a span contributes to every day
  record it touches (the calendar asks "what touches this date range?" —
  one query helper in core, `daysCovered(span)`); month/week views render
  banners from contiguous runs.
- Degrade (L5): missing/unknown `zone` → render in the viewer's local zone.

### 6.3 `NotificationPort` (core `ports/`)
`schedule(id, atUtc, payload)` / `cancel(id)` / `requestPermission()`.
Adapters: Tauri notification plugin (desktop), Expo notifications (mobile),
Web Notifications (web port, best-effort). Reminder *rules* (offset before
event, task due, habit nudge) live in the owning modules; the core only fires.
Degrade: permission denied/unsupported → quiet in-app badges; never nags (L5).

### 6.4 Views & interactions (apps/web renderer)
- **Hour-grid day/week view**: time-axis columns (all-day lane on top), the
  view switcher grows Month · Week · **Timeline** · Day; drag to create,
  drag/resize to move timed events (pointer events; keyboard equivalents).
- **Agenda view**: flat upcoming list across modules (reads day records).
- **Drag & drop** in month/week: move an entry to another date = rewrite of
  that entry's date field via its module's slice.
- **Undo**: an app-level command stack (last N slice writes with inverse
  writes); `⌘Z` + a toast with "Undo". Trash/soft-delete is per-module state
  where destructive (tasks), not a core mechanism.

## Phase 7 — Tasks module additions (beyond the design doc §8)
- **NL quick entry** on top of the sigil parser: "lunch with Anna tomorrow
  13:00", EN + CS, pure logic + tests (dates/times/durations; locale-aware).
- Reminders per task/event (uses 6.3), default offsets in settings.
- Recurring events use 6.1 overrides for "edit this occurrence only".

## Phase 8 — Interop & findability
- **ICS import/export** (module `calendar-interop`): RFC 5545 parse/serialize
  (own small parser or vetted dep isolated in the module); import → events in
  the module's slice; export any date range. Degrade: unparseable components
  are skipped and reported, never abort the file.
- **Subscriptions**: read-only ICS feeds (holidays, school, partner's shared
  URL) behind a `FeedPort` (fetch + cache + refresh interval). Offline → last
  cached feed. CalDAV two-way is explicitly *not* attempted before sync (P10)
  exists; revisit after.
- **Search** (module `search`): on-demand index over shared day records +
  module-registered text extractors (a manifest capability); surfaced in the
  command palette. No provider registered for a module → its data simply
  isn't searchable (L5).
- **Year view** (12-month density grid) and **print stylesheet** for
  month/week/agenda.

## Phase 9 — Life modules (design doc §8, unchanged)
check-in · cycle · body · workouts · weather (signal provider) · insights ·
**birthdays** (new small module: manual entries + yearly recurrence from 6.1;
platform-contacts import later behind a capability port).

## Phase 11 — Mobile + surfaces
Expo client reusing everything; **home-screen widgets** (month glance, today
list) and **desktop tray/menu-bar mini calendar** (Tauri tray API). Native
barcode scanner (per §3).

## Phase 12 — Multi-user (decision D5; supersedes the design doc's §15 exclusion)
Builds strictly **on top of** the sync server (P10: accounts, per-slice
revisions) — every feature here is server-mediated and additive: a signed-out
or offline client keeps its full single-user behaviour (L5).

- **Shared calendars.** A calendar (a namespaced set of entries) gets a
  server-side ACL: owner / writer / reader. Sharing = the server replicating
  that namespace's slices to other accounts' pull streams; the client model is
  unchanged — shared entries arrive as ordinary slices tagged with their
  calendar id. Conflict rule stays per-slice LWW.
- **Attendees, invitations, RSVP.** Events gain an `attendees` list. In-app
  invites ride sync (an invite record → the invitee's stream); external
  invitees get **iMIP email invites** (the RFC 5546 flow), reusing P8's ICS
  serializer. RSVP state lands back on the event. Degrade: no email adapter
  configured → invites are copy-link/manual export.
- **Free-busy & find-a-time.** Accounts can expose availability (busy blocks
  only — no titles/details) per share-grant; the picker overlays attendees'
  busy blocks to suggest slots. Privacy default: nothing exposed until a grant
  is made explicitly.
- **Booking pages.** A public server endpoint per user: choose from published
  availability windows → creates a pending event + invite. Rate-limited,
  revocable link.
- **Conferencing links.** A `conferenceUrl` field on events (rendered as a
  join button) from day one of P12; provider integrations (auto-create
  Meet/Zoom) later behind a port, if ever.

Boundary note: all client logic lands as modules/UI over core seams (L1–L3
hold); the substantial new surface here is **server-side** (ACLs, invite
routing, availability, booking) — spec that service at P12 entry.

## Decide-at-phase-entry markers
- **P6 entry:** confirm 6.1/6.2 contracts (they're proposals until then).
- **P8 entry:** pick the ICS strategy (own minimal parser vs vetted dep in the
  module) after checking dep size/quality then.
- **P12 entry:** spec the server service (ACL model, invite routing,
  availability, booking endpoint) before client work.
