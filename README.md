# Almanac

A **personal calendar** with an offline-capable local store and (eventually)
cross-device sync. The calendar is the core; every feature is an independent
**module** that plugs into a shared hub and never depends on another module.
Multilingual from day one. Meal-planning is the first module.

## Quickstart

```sh
pnpm install
pnpm check        # typecheck + lint + test
```

Individually: `pnpm typecheck`, `pnpm lint`, `pnpm test`.

## Stack

pnpm workspaces · TypeScript (strict) · React + Vite · **Tauri** desktop app
(system webview — lightweight) + a **web port** sharing the renderer · Vitest ·
ESLint `boundaries` · i18next (EN + CS) · Open Food Facts · Open-Meteo.

## Docs

- **[docs/ROADMAP.md](docs/ROADMAP.md)** — the authoritative 12-phase build
  sequence, incl. the L5 degradation matrix for every planned feature.
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — the laws, the dependency star, and UML diagrams.
- **[docs/DECISIONS.md](docs/DECISIONS.md)** — decision log (D0–D9).
- **[docs/BUILD_JOURNAL.md](docs/BUILD_JOURNAL.md)** — per-phase narrative.
- **[CHANGELOG.md](CHANGELOG.md)** — what shipped, per phase.
- **[ALMANAC_DESIGN_DOC.md](ALMANAC_DESIGN_DOC.md)** — the full handoff spec.

## License

[MIT](LICENSE) © 2026 Ronald Karel Grant.

## Status

**Phases 0–9 complete; Phase 10 (sync) next.** The calendar is livable-in
daily: month/week/timeline/day/agenda/year views · recurrence v2 with
per-instance overrides and series splits · timed/multi-day/timezone events ·
drag & drop, undo, copy/paste · a ⌘K palette with ranked search · multiple
calendars · secondary time zone + working hours · tasks/events/habits with NL
quick entry, unbounded numbered priority (D9), and reminders · meal planning
(several meals a day, lock/re-roll, "why this pick" breakdown) · macros ·
shopping · ICS import/export + read-only feed subscriptions · printing · vault
backup.

**Eleven modules**, each independently removable (a show/hide setting in
Settings proves it): meals · tasks · shopping · macros · search ·
calendar-interop · check-in · cycle (median stats, informational phase/fertile
estimates, LH-test anchoring) · body & weight trend · workouts · weather
(Open-Meteo behind a port) · birthdays · insights (descriptive analytics that
own no data) · planner (deterministic timeboxing — suggestions you confirm,
never silent moves).

Desktop = Tauri v2 over the shared renderer with a SQLite store. ~440 tests.
Sequence: [docs/ROADMAP.md](docs/ROADMAP.md).

## The one-line why

Star-modularity (modules depend on the core, never each other) + composition
over inheritance keeps every feature independently buildable, testable, and
removable — and there's no base class to override, so none to break. Full laws
in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md#the-laws).
