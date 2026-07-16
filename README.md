# Timetrack

One-tap time tracking for freelancers. A local-first progressive web app
(PWA): it runs entirely on your device, works offline, installs to the
iPhone Home Screen like a native app — and, when connected to a (free)
Supabase project, syncs automatically and invisibly across all your devices.

**Stack**: Svelte 5 · Vite · TypeScript (cloud modules) · IndexedDB ·
Supabase (Auth + Postgres + Row Level Security)

---

## 1. Local development

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the build locally
npx tsc --noEmit   # type-check
```

No configuration is required to develop: without Supabase environment
variables the app runs in pure local mode (no accounts, no sync — exactly
the original Timetrack).

### Install on iPhone

Open the deployed URL in Safari → Share → **Add to Home Screen**. Runs
standalone and fully offline; with an account, changes sync in the
background whenever the device is online.

## 2. Architecture

```
Views/Components (Svelte 5 runes)
   │   read reactive state, call actions
store.svelte.js          ← the repository: the ONLY data access layer
   │                       backed by IndexedDB (source of truth on-device)
cloud/sync.svelte.ts     ← background sync engine (invisible, no buttons)
cloud/auth.svelte.ts     ← session state + auth flows
cloud/supabase.ts        ← client; null when env vars are missing
Supabase                 ← Postgres with Row Level Security + Auth
```

Key properties:

- **Local-first**: every read and write hits IndexedDB first; the UI is
  never blocked by the network (optimistic by construction).
- **Sync = watermarks**: each record carries `updatedAt`; anything newer
  than the last successful push is pending — that IS the offline queue,
  and it survives crashes and restarts. Pulls use the server-side
  `synced_at` timestamp, so client clock skew can't cause missed changes.
- **Conflicts**: last-updated-wins, enforced on the server by conditional
  upserts (`where updated_at < excluded.updated_at`) — a device that was
  offline can never overwrite newer data with older edits.
- **Deletes** are soft (tombstones with `deleted: true`), so they sync.
- **Breaks** live inside their entry (jsonb column), keeping each entry's
  sync atomic. Deliberate deviation from a normalized `entry_breaks`
  table: breaks have no independent identity or queries.
- **User isolation**: every table has `user_id` with RLS policies scoping
  select/insert/update/delete to `auth.uid()`. Primary keys are
  `(user_id, id)`, so users cannot even collide on record ids.
- **Sync metadata** (watermarks, first-login flags) is device-local state
  and lives in IndexedDB (`meta` store), not in a server table.

## 3. Creating the Supabase project (one time, ~10 minutes)

1. Sign up at [supabase.com](https://supabase.com) (the free tier
   comfortably covers a few hundred users).
2. **New project** → name it (e.g. `timetrack`), pick a region near your
   users, store the generated database password in your password manager
   (you rarely need it again).
3. When the project is ready, open **SQL Editor**, paste the entire
   contents of [`supabase/schema.sql`](supabase/schema.sql), and **Run**.
   The script is idempotent — safe to run again after schema updates.
4. Go to **Project Settings → API** and copy two values:
   - *Project URL* → `VITE_SUPABASE_URL`
   - *anon public* key → `VITE_SUPABASE_ANON_KEY`

   The anon key is safe to embed in the shipped app — it only grants what
   Row Level Security allows. **Never** expose the `service_role` key.
5. **Authentication → URL Configuration**:
   - *Site URL*: your app's public URL
     (e.g. `https://YOURNAME.github.io/timetrack/`)
   - Add the same URL under *Redirect URLs*; add `http://localhost:5173`
     too if you want to test sign-in during development.

### Configuring authentication

Email + password works out of the box (Authentication → Sign In /
Providers → Email). Keep *Confirm email* ON — it's the secure default.

#### Google login (optional, free)

1. In [Google Cloud Console](https://console.cloud.google.com): create a
   project → **APIs & Services → OAuth consent screen** (External; app
   name + support e-mail suffice) → **Credentials → Create credentials →
   OAuth client ID → Web application**.
2. Authorized redirect URI: `https://YOURPROJECT.supabase.co/auth/v1/callback`
   (Supabase shows the exact value under Authentication → Providers → Google).
3. Paste the client ID + secret into Supabase → Providers → Google, enable it.
4. Set `VITE_AUTH_GOOGLE=true` in `.env.local`, rebuild, redeploy. The
   "Continue with Google" button appears automatically.

#### Apple login (optional, requires the paid Apple Developer Program)

1. In the [Apple Developer portal](https://developer.apple.com): App ID +
   Services ID with *Sign in with Apple*, plus a private key.
2. Follow Supabase → Authentication → Providers → Apple for the exact
   fields (Services ID, key ID, team ID, private key).
3. Set `VITE_AUTH_APPLE=true`, rebuild, redeploy.

## 4. Environment variables

Copy `.env.example` to `.env.local` and fill it in — every variable is
explained in the file. Vite embeds `VITE_*` values at **build time**;
`.env.local` is git-ignored. There are no other secrets in the codebase.

## 5. Deployment

The app is a fully static site; the build output is `dist/`. Any static
host works.

### GitHub Pages (current setup)

```bash
npm run build
# publish dist/ to the gh-pages branch (repo Settings → Pages → gh-pages)
```

`vite.config.js` uses `base: './'`, so the app works from any sub-path.

### Cloudflare Pages (recommended for a fresh setup)

1. Free account at [pages.cloudflare.com](https://pages.cloudflare.com).
2. **Create a project → Connect to Git** → select this repository.
3. Build settings: build command `npm run build`, output directory `dist`.
4. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under
   *Settings → Environment variables* (needed at build time).
5. Every push to the production branch deploys automatically. The
   included `public/_headers` file ships security headers on Cloudflare.

### Vercel

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
2. Framework preset *Vite* (build `npm run build`, output `dist`).
3. Add the environment variables, deploy.

### Custom domain

All three hosts attach custom domains in their dashboard (Cloudflare
Pages → Custom domains · Vercel → Domains · GitHub Pages → Settings →
Pages). After the public URL changes, update Supabase → Authentication →
URL Configuration, or e-mail confirmation/recovery links will point to
the old address.

## 6. Updating the application

Deploy a new build — that's it. The service worker uses network-first
navigations with hashed immutable assets, so installed apps pick the
update up on the next launch with connectivity. Nothing to reinstall.

## 7. Backup, restore & data migration

- **Cloud sync** is the primary safety net: every signed-in device holds
  a full copy and Postgres holds the authoritative one (Supabase runs
  daily database backups on all plans).
- **First login**: if the device already holds local data, the app offers
  a one-time “Import your existing local data into your cloud account.”
  IDs, timestamps and full history are preserved; the upload upserts by
  id, so re-running can never create duplicates.
- **JSON export/import** (Settings → Backup) produces a complete snapshot
  of the device data; import merges last-updated-wins, duplicate-safe.
- **CSV / Excel / PDF** (Settings → Export) for reporting and invoicing.
- Signing out keeps the device's local data; it simply stops syncing.

## 8. Project layout

```
src/
  lib/
    store.svelte.js      repository + reactive state (all data access)
    db.js                IndexedDB wrapper (v2 adds the meta store)
    time.js              time math incl. breaks (entryMs, workedOverlapMs)
    cloud/               Supabase client, auth, sync engine (TypeScript)
    export.js            CSV/XLSX/PDF report generation
    i18n.svelte.js       EN/DE strings
  components/            cards, bottom sheets, forms, charts
  views/                 Home, Projects, Stats, Calendar, Settings, Detail
supabase/schema.sql      complete database schema incl. RLS + sync RPCs
public/                  manifest, service worker, icons, _headers
MIGRATION.md             the cloud-migration plan and design decisions
```

## 9. Future readiness

Every row is anchored to `profiles`, so teams/shared projects can arrive
as a `memberships` table plus widened RLS policies — without touching the
client's repository layer. The sync engine is table-generic: a new entity
needs one mapper pair, one RPC, and two watermark keys. Billing (Stripe)
would attach to `profiles`. The UI never talks to Supabase directly, so a
future desktop companion or web dashboard can reuse `cloud/` wholesale.
