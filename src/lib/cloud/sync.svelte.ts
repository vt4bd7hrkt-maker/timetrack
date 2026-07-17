/**
 * Invisible background sync between IndexedDB (source of truth for the UI)
 * and Supabase. No manual sync button anywhere, by design.
 *
 * Push: every record with `updatedAt` newer than the per-table watermark —
 *   the watermark IS the offline queue: anything not yet pushed stays
 *   pending across crashes and restarts, and the server applies rows
 *   conditionally (last-updated-wins), so re-pushing is always safe.
 * Pull: every row with `synced_at` (server clock) newer than the pull
 *   watermark, merged into local state last-updated-wins.
 * Timers: replaced as a whole set (a user has at most a handful) — pushed
 *   only when the local set changed, so a stop on one device wins.
 *
 * Triggers: local data changes (debounced), login, coming online, app
 * becoming visible, and a slow heartbeat. Failures retry automatically.
 */
import { supabase } from './supabase';
import { auth } from './auth.svelte';
import * as db from '../db.js';
import { data, settings, applyRemote, applyRemoteTimers, applyRemoteSettings } from '../store.svelte.js';

const DEBOUNCE_MS = 2500;
const HEARTBEAT_MS = 60000;
const PAGE = 1000;
const CHUNK = 500;

export const sync = $state({
  active: false, // configured + logged in
  status: 'idle' as 'idle' | 'syncing' | 'offline' | 'error',
  lastSync: null as number | null,
  error: '',
  /** Non-null → ask the user whether to import pre-existing local data. */
  importOffer: null as null | { projects: number; entries: number }
});

/* ------------------------------ row mapping ------------------------------ */

type Rec = Record<string, unknown>;

const projToRow = (p: any): Rec => ({
  id: p.id, title: p.title ?? '', client: p.client ?? '', description: p.description ?? '',
  quota_hours: p.quotaHours ?? 0, hourly_rate: p.hourlyRate ?? null,
  color: p.color ?? '#39ff14', status: p.status ?? 'active',
  archived: !!p.archived, deleted: !!p.deleted,
  created_at: p.createdAt ?? 0, updated_at: p.updatedAt ?? 0
});

const rowToProj = (r: any): Rec => ({
  id: r.id, title: r.title, client: r.client, description: r.description,
  quotaHours: r.quota_hours, hourlyRate: r.hourly_rate, color: r.color,
  status: r.status, archived: r.archived, deleted: r.deleted,
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at)
});

const entryToRow = (e: any): Rec => ({
  id: e.id, project_id: e.projectId, start_ms: e.start, end_ms: e.end,
  note: e.note ?? '', breaks: e.breaks ?? [], deleted: !!e.deleted,
  created_at: e.createdAt ?? 0, updated_at: e.updatedAt ?? 0
});

const rowToEntry = (r: any): Rec => ({
  id: r.id, projectId: r.project_id, start: Number(r.start_ms), end: Number(r.end_ms),
  note: r.note, breaks: r.breaks ?? [], deleted: r.deleted,
  createdAt: Number(r.created_at), updatedAt: Number(r.updated_at)
});

/* -------------------------------- helpers -------------------------------- */

const uid = (): string | null => auth.user?.id ?? null;
const chunks = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
};
const isOfflineError = (e: unknown): boolean =>
  !navigator.onLine || (e instanceof TypeError && /fetch|network/i.test(String(e.message)));

/* --------------------------------- push ---------------------------------- */

async function pushTable(store: string, rpc: string, map: (x: any) => Rec, metaKey: string): Promise<void> {
  const watermark: number = (await db.getMeta(metaKey)) ?? 0;
  const all: any[] = await db.all(store); // includes tombstones
  const pending = all.filter((r) => (r.updatedAt ?? 0) > watermark);
  if (!pending.length) return;
  for (const chunk of chunks(pending, CHUNK)) {
    const { error } = await supabase!.rpc(rpc, { rows: chunk.map(map) });
    if (error) throw error;
  }
  await db.setMeta(metaKey, Math.max(...pending.map((r) => r.updatedAt ?? 0)));
}

async function pushTimers(u: string): Promise<void> {
  const local: any[] = await db.all('timers');
  const snapshot = JSON.stringify(local.map((t) => [t.projectId, t.startedAt]).sort());
  const lastPushed = await db.getMeta(`timersPushed:${u}`);
  if (snapshot === lastPushed) return; // unchanged since last push

  const del = supabase!.from('timers').delete().eq('user_id', u);
  const ids = local.map((t) => t.projectId as string);
  const { error: delErr } = ids.length
    ? await del.not('project_id', 'in', `(${ids.map((i) => `"${i}"`).join(',')})`)
    : await del;
  if (delErr) throw delErr;
  if (local.length) {
    const { error } = await supabase!
      .from('timers')
      .upsert(local.map((t) => ({ user_id: u, project_id: t.projectId, started_at: t.startedAt })));
    if (error) throw error;
  }
  await db.setMeta(`timersPushed:${u}`, snapshot);
}

/* --------------------------------- pull ---------------------------------- */

async function pullTable(table: string, metaKey: string, tiebreak: string = 'id'): Promise<any[]> {
  const since: string = (await db.getMeta(metaKey)) ?? '1970-01-01T00:00:00Z';
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase!
      .from(table)
      .select('*')
      .gt('synced_at', since)
      .order('synced_at', { ascending: true })
      .order(tiebreak, { ascending: true }) // stable page order (settings has no id)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(page ?? []));
    if (!page || page.length < PAGE) break;
  }
  return rows;
}

const maxSyncedAt = (rows: any[]): string | null =>
  rows.length ? rows.reduce((m, r) => (r.synced_at > m ? r.synced_at : m), rows[0].synced_at) : null;

/* ------------------------------- sync cycle ------------------------------ */

let running = false;
let rerun = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;

export function requestSync(delay: number = DEBOUNCE_MS): void {
  if (!sync.active) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void syncNow(), delay);
}

export async function syncNow(): Promise<void> {
  const u = uid();
  if (!supabase || !u || sync.importOffer) return; // wait for import decision
  if (running) {
    rerun = true;
    return;
  }
  running = true;
  sync.status = 'syncing';
  try {
    const setupDone = await db.getMeta(`setup:${u}`);

    // 1) push local changes (skipped until the first-login decision is made)
    if (setupDone) {
      await pushTable('projects', 'sync_push_projects', projToRow, `push:${u}:projects`);
      await pushTable('entries', 'sync_push_entries', entryToRow, `push:${u}:entries`);
      await pushTable('settings', 'sync_push_settings',
        (s: any) => ({ key: s.key, value: s.value ?? null, updated_at: s.updatedAt ?? 0 }),
        `push:${u}:settings`);
      await pushTimers(u);
    }

    // 2) pull remote changes
    const timerSnapshot = JSON.stringify(data.timers.map((t: any) => [t.projectId, t.startedAt]).sort());

    const projRows = await pullTable('projects', `pull:${u}:projects`);
    await applyRemote('projects', projRows.map(rowToProj));
    const pm = maxSyncedAt(projRows);
    if (pm) await db.setMeta(`pull:${u}:projects`, pm);

    const entryRows = await pullTable('time_entries', `pull:${u}:time_entries`);
    await applyRemote('entries', entryRows.map(rowToEntry));
    const em = maxSyncedAt(entryRows);
    if (em) await db.setMeta(`pull:${u}:time_entries`, em);

    const settingRows = await pullTable('settings', `pull:${u}:settings`, 'key');
    await applyRemoteSettings(
      settingRows.map((r: any) => ({ key: r.key, value: r.value, updatedAt: Number(r.updated_at) }))
    );
    const sm = maxSyncedAt(settingRows);
    if (sm) await db.setMeta(`pull:${u}:settings`, sm);

    if (setupDone) {
      const { data: timerRows, error } = await supabase.from('timers').select('*');
      if (error) throw error;
      // Only apply if the user didn't start/stop a timer while we synced.
      const current = JSON.stringify(data.timers.map((t: any) => [t.projectId, t.startedAt]).sort());
      if (current === timerSnapshot) {
        const list = (timerRows ?? []).map((r: any) => ({
          projectId: r.project_id,
          startedAt: Number(r.started_at)
        }));
        await applyRemoteTimers(list);
        await db.setMeta(`timersPushed:${u}`, JSON.stringify(list.map((t) => [t.projectId, t.startedAt]).sort()));
      }
    }

    sync.lastSync = Date.now();
    sync.status = 'idle';
    sync.error = '';
  } catch (e: any) {
    if (isOfflineError(e)) {
      sync.status = 'offline'; // retried on 'online' event + heartbeat
    } else {
      sync.status = 'error';
      sync.error = String(e?.message ?? e);
      console.error('[sync]', e);
    }
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      requestSync(500);
    }
  }
}

/* --------------------------- first-login import -------------------------- */

async function checkFirstLogin(u: string): Promise<void> {
  if (await db.getMeta(`setup:${u}`)) return;
  const projects: any[] = await db.all('projects');
  const entries: any[] = await db.all('entries');
  const counts = {
    projects: projects.filter((x) => !x.deleted).length,
    entries: entries.filter((x) => !x.deleted).length
  };
  if (counts.projects || counts.entries) {
    sync.importOffer = counts; // AccountSheet shows the question
  } else {
    await db.setMeta(`setup:${u}`, 'auto');
  }
}

/** User said yes: everything local uploads (watermarks start at 0). */
export async function acceptImport(): Promise<void> {
  const u = uid();
  if (!u) return;
  await db.setMeta(`setup:${u}`, 'imported');
  sync.importOffer = null;
  await syncNow();
}

/** User said no: existing local data stays device-only; new changes sync. */
export async function declineImport(): Promise<void> {
  const u = uid();
  if (!u) return;
  const now = Date.now();
  await db.setMeta(`push:${u}:projects`, now);
  await db.setMeta(`push:${u}:entries`, now);
  await db.setMeta(`push:${u}:settings`, now);
  await db.setMeta(`setup:${u}`, 'declined');
  sync.importOffer = null;
  await syncNow();
}

/* -------------------------------- wiring --------------------------------- */

/** Cheap change fingerprint over everything that syncs. */
function fingerprint(): string {
  let m = 0;
  for (const p of data.projects as any[]) if ((p.updatedAt ?? 0) > m) m = p.updatedAt;
  for (const e of data.entries as any[]) if ((e.updatedAt ?? 0) > m) m = e.updatedAt;
  const timers = (data.timers as any[]).map((t) => `${t.projectId}:${t.startedAt}`).join(',');
  return [
    (data.projects as any[]).length, (data.entries as any[]).length, m, timers,
    settings.theme, settings.language, settings.dailyGoal, settings.reminders
  ].join('|');
}

export function initSync(): void {
  let lastFp: string | null = null;
  let lastUser: string | null = null;

  $effect.root(() => {
    // react to login / logout
    $effect(() => {
      const u = auth.user?.id ?? null;
      if (u === lastUser) return;
      lastUser = u;
      sync.active = !!u && !!supabase;
      sync.importOffer = null;
      lastFp = null;
      if (u) {
        void (async () => {
          await checkFirstLogin(u);
          void syncNow();
        })();
      } else {
        sync.status = 'idle';
        sync.lastSync = null;
      }
    });

    // react to local data changes
    $effect(() => {
      const fp = fingerprint(); // establishes reactive deps
      if (!data.ready || !sync.active) return;
      if (lastFp === null) {
        lastFp = fp;
        return;
      }
      if (fp === lastFp) return;
      lastFp = fp;
      requestSync();
    });
  });

  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
    else if (debounceTimer) void syncNow(); // flush pending before iOS freezes us
  });
  heartbeat = setInterval(() => {
    if (sync.active && document.visibilityState === 'visible') void syncNow();
  }, HEARTBEAT_MS);
}
