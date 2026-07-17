# Cloud Migration Plan

Goal: extend the local-first PWA into a multi-device SaaS with Supabase,
without changing how the app feels or works. This is a migration, not a
rewrite. Rollback point: git tag `rollback-local-only` on `main`.

## Current architecture (analysis)

- **UI**: Svelte 5 runes; views read reactive `$state` from
  `src/lib/store.svelte.js` — the store is already the single data access
  layer (a de-facto repository): every mutation goes through its functions.
- **Persistence**: IndexedDB (`src/lib/db.js`), object stores `projects`,
  `entries`, `timers`, `settings`. Every record already carries `id`,
  `updatedAt`, and soft-delete tombstones (`deleted: true`) — written with
  sync in mind from day one.
- **Durations**: entries may embed `breaks: [{start, end}]` (ms epochs).
- **PWA**: manifest + hand-written service worker (network-first
  navigations, cache-first hashed assets) — unchanged by this migration.
- **Cloud backup**: optional snapshot to a private GitHub repo
  (`cloudbackup.svelte.js`). Kept as an independent safety net.

## Target architecture

```
UI (views/components)
   │  reads $state, calls actions        (unchanged)
store.svelte.js  ←— single repository —→ IndexedDB (source of truth)
   │ change signal (updatedAt watermark)
sync engine (src/lib/cloud/sync.svelte.ts)
   │ push: rows with updatedAt > watermark (incl. tombstones)
   │ pull: rows with synced_at > watermark, merged last-updated-wins
supabase-js  →  Postgres (RLS: user_id = auth.uid()) + Supabase Auth
```

Design decisions (deliberately simple, sized for a few hundred users):

- **No outbox table**: the per-table `updatedAt` watermark IS the queue.
  Any row newer than the last successful push is pending. Retry = try
  again later with the same watermark. Deterministic and crash-safe.
- **Last-updated-wins** on `updatedAt` (client clock) for conflicts, the
  field the app already maintains everywhere.
- **Pull watermark uses server time** (`synced_at`, set by trigger), so
  client clock skew can never cause missed rows.
- **Breaks stay embedded** as a `jsonb` column on `time_entries` instead of
  a separate `entry_breaks` table: they have no independent identity, are
  always read/written with their entry, and jsonb keeps each entry's sync
  atomic. (Documented deviation from the suggested schema.)
- **Timers** sync by full-state replace (a user has at most a handful).
- **Logged-out mode = exactly today's app.** Supabase code paths activate
  only with a session; without configuration the app builds and runs 100%
  local. New code is TypeScript; existing JS files stay untouched.

## Auth

- Email + password (active), Google & Apple via Supabase OAuth —
  implemented but hidden behind config flags until the OAuth apps exist
  (Apple requires a paid developer account).
- Sign up / login / logout / forgot-password (recovery link redirects back
  to the app) / persistent sessions (supabase-js default).
- First login with existing local data → offer one-time import (IDs and
  timestamps preserved; duplicate-safe because import = upsert by id).

## Database (supabase/schema.sql)

`profiles`, `projects`, `time_entries` (jsonb `breaks`), `timers`,
`settings` — all with `user_id` default `auth.uid()`, RLS policies for
select/insert/update/delete scoped to `auth.uid()`, and a `synced_at`
trigger. Sync metadata (watermarks) lives client-side in IndexedDB.

## Steps

1. ✅ Branch `feature/cloud-migration`, tag `rollback-local-only`.
2. Plan (this file).
3. TypeScript wiring + `@supabase/supabase-js` + `.env.example`.
4. `supabase/schema.sql` (tables, RLS, triggers).
5. `src/lib/cloud/`: client, auth state, sync engine.
6. IndexedDB v2 (adds `meta` store), `settings.updatedAt`.
7. Auth UI: account section in Settings, auth sheet, recovery flow,
   local-data import offer. i18n EN/DE.
8. Verify logged-out behavior is byte-for-byte the current app; build.
9. Connect real Supabase project; e2e: signup, login, sync, two devices,
   offline queue, reconnect, conflict (LWW), import, logout.
10. README, Cloudflare Pages config (docs; hosting stays GitHub Pages).
11. Full QA sweep, deploy from the merged branch.
