# Timetrack

One-tap time tracking PWA for freelancers. Svelte 5 (runes) + Vite 7,
local-first (IndexedDB), installable on the iOS home screen, fully
offline-capable.

## Quick start

```bash
npm install
npm run icons     # regenerate PWA icons (already committed in public/icons)
npm run dev       # dev server
npm run build     # production build -> dist/
npm run preview   # serve the build locally
```

Deploy: upload `dist/` to any static host (Netlify, Vercel, GitHub Pages, …).
The app uses relative paths (`base: './'`), so it works from any sub-path.
**Note:** service workers require HTTPS (or localhost).

### Install on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**.
Runs standalone, works offline, data stays on the device.

## Features

- One-tap start/stop per project card; multiple timers can run concurrently
- Running timers survive reloads / iOS killing the tab (elapsed time is derived
  from the persisted start timestamp, never from an in-memory counter)
- Long press a card → bottom sheet: add time manually, retroactive start
  ("forgot to track"), edit, archive
- Projects: client, description, hour quota, hourly rate, color, status
- Stats: today / week / month / year / custom range, KPIs, bar + donut + line charts (SVG, animated)
- Calendar month view with per-day hours and per-project breakdown
- Project detail: quota progress, earnings, 14-day chart, full entry history
- Exports: CSV, Excel (xlsx), PDF report — per project or date range
- JSON backup export/import (merge by `updatedAt`)
- Light / dark / system theme, English + German UI, daily hour goal

## Architecture

Built on Svelte 5 runes throughout: shared state lives in `.svelte.js`
modules as `$state` objects (universal reactivity — no `svelte/store`),
components use `$props` / `$derived` / `$effect`, callback props instead of
`createEventDispatcher`, snippets (`{@render}`) instead of slots, and event
attributes (`onclick`) instead of `on:` directives.

```
src/
  lib/
    db.js             IndexedDB wrapper (promise-based)
    store.svelte.js   $state app data + all mutations (single write path)
    router.svelte.js  tiny runes-based tab router
    i18n.svelte.js    EN/DE dictionaries, reactive t()
    time.js           date/duration math & formatting
    export.js         CSV/XLSX/PDF (xlsx & jspdf are lazy-loaded)
    longpress.js      use:longpress={callback} action (click-suppressing)
  components/         presentational, reusable
  views/              one file per tab + project detail
public/
  sw.js               service worker (offline caching)
  manifest.webmanifest
```

**Cloud-sync ready:** every record carries `id` (UUID), `updatedAt` and a
soft-delete `deleted` flag (tombstones). A sync layer only needs to diff on
`updatedAt` and push/pull through the same `store.svelte.js` mutation functions —
no schema or UI changes required. The JSON backup import already implements
the merge strategy (`newer updatedAt wins`).

## Data model

```js
project: { id, title, client, description, quotaHours, hourlyRate,
           color, status: 'active'|'paused'|'completed',
           archived, createdAt, updatedAt, deleted }
entry:   { id, projectId, start, end, note, createdAt, updatedAt, deleted }  // epoch ms
timer:   { projectId, startedAt }  // persisted → survives restarts
```
