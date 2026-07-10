# Timetrack

One-tap time tracking PWA for freelancers. Svelte 5 (runes) + Vite 7,
local-first (IndexedDB), installable on the iOS home screen, offline-capable.
No backend — all data lives on the device.

## Commands

```bash
npm run dev       # dev server
npm run build     # production build -> dist/ (deploy to any static host)
npm run preview   # serve the production build locally
npm run icons     # regenerate public/icons/ (uses pngjs)
```

There are no tests yet. Verify changes with `npm run build` at minimum.

## Architecture

- `src/lib/store.svelte.js` — **single write path.** All app data (`data.projects`,
  `data.entries`, `data.timers`) and `settings` are exported `$state` objects;
  every mutation goes through the exported functions here (which also persist
  to IndexedDB via `db.js`). Never write to IndexedDB from components.
- `src/lib/db.js` — thin promise-based IndexedDB wrapper. Stores: projects,
  entries, timers, settings.
- `src/lib/router.svelte.js` — in-memory tab router (`route`, `go()`); no URLs.
- `src/lib/i18n.svelte.js` — `t(key)`; EN + DE dictionaries. Add every new
  UI string to **both** languages.
- `src/lib/time.js` — all timestamps are **epoch milliseconds**; durations in ms.
- `src/lib/export.js` — CSV/XLSX/PDF; `xlsx` and `jspdf` are lazy-loaded via
  dynamic import — keep it that way (startup performance).
- `src/views/` — one component per tab (Home, Projects, Stats, Calendar,
  Settings) + ProjectDetail. `src/components/` — reusable pieces.
- `public/sw.js` — hand-rolled service worker; bump `VERSION` when caching
  behavior changes.

## Domain rules

- Multiple timers may run concurrently (one per project).
- Running timers are persisted as `{ projectId, startedAt }`; elapsed time is
  ALWAYS derived from `Date.now() - startedAt`, never from a counter — this is
  what makes timers survive reloads and iOS killing the PWA. Don't change this.
- Stopping a timer < 3 s after start discards it (accidental tap).
- "Forgot to track" = start a timer with a `startedAt` in the past.
- Records carry `id` (UUID), `updatedAt`, and soft-delete `deleted` flags
  (tombstones) to keep the model cloud-sync-ready. Deletions must write
  tombstones, not hard-delete.

## Conventions

- Svelte 5 runes only: `$state`, `$derived`, `$props`, `$effect`, callback
  props (`ondone`, `onclose`, …), snippets/`{@render}`, event attributes
  (`onclick`). No `svelte/store`, no `createEventDispatcher`, no `on:`/`$:`.
- Shared reactive state lives in `.svelte.js` modules.
- Styling: scoped component styles + design tokens (CSS custom properties) in
  `src/app.css`. Neon green `--accent` is the only accent color; support both
  themes (`html[data-theme]`, use `:global(...)` when selecting on it).
- UI must stay thumb-friendly: big tap targets, bottom sheets over modals,
  respect `--safe-bottom`/`--safe-top` (iOS safe areas).
- `<input>` font-size must stay ≥ 16px (prevents iOS focus zoom).
