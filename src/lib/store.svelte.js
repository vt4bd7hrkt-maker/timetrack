/**
 * Central app state + actions (Svelte 5 runes module).
 *
 * Data model (all timestamps = epoch ms):
 *  project: { id, title, client, description, quotaHours, hourlyRate, color,
 *             status: 'active'|'paused'|'completed', archived, createdAt, updatedAt, deleted }
 *  entry:   { id, projectId, start, end, note, createdAt, updatedAt, deleted }
 *  timer:   { projectId, startedAt }   — several may run concurrently
 *
 * Timers are persisted, so a running timer survives reloads and iOS killing
 * the PWA: elapsed time is always derived from Date.now() - startedAt.
 *
 * All reads in components go through these $state objects, so any template
 * or $derived that touches them updates automatically.
 */
import * as db from './db.js';
import { entryMs } from './time.js';

export const data = $state({
  projects: [],
  entries: [],
  timers: [],
  ready: false
});

export const settings = $state({
  theme: 'system',
  language: 'en',
  dailyGoal: 8,
  reminders: false
});

/** Ticks every second — drives live timer displays. */
export const clock = $state({ now: Date.now() });
setInterval(() => (clock.now = Date.now()), 1000);

const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Deep-plain copy for IndexedDB. Records held in `data`/`settings` are Svelte
 * $state proxies; nested arrays/objects (e.g. an entry's `breaks`) stay proxies
 * across a shallow `{...spread}` and IndexedDB refuses to structured-clone them
 * (DataCloneError). Snapshotting right before every write makes all persistence
 * proxy-safe in one place.
 */
const plain = (v) => $state.snapshot(v);
const put = (store, value) => db.put(store, plain(value));
const bulkPut = (store, values) => db.bulkPut(store, values.map(plain));

/* ------------------------------- init ---------------------------------- */

export async function init() {
  const [p, e, tm, st] = await Promise.all([
    db.all('projects'),
    db.all('entries'),
    db.all('timers'),
    db.all('settings')
  ]);
  data.projects = p.filter((x) => !x.deleted);
  data.entries = e.filter((x) => !x.deleted);
  data.timers = tm;
  Object.assign(settings, Object.fromEntries(st.map((s) => [s.key, s.value])));
  data.ready = true;
}

export async function saveSetting(key, value) {
  settings[key] = value;
  await put('settings', { key, value, updatedAt: Date.now() });
}

/* ----------------------------- projects -------------------------------- */

export async function saveProject(input) {
  const nowTs = Date.now();
  const p = input.id
    ? { ...input, updatedAt: nowTs }
    : {
        id: uid(),
        title: '',
        client: '',
        description: '',
        quotaHours: 0,
        hourlyRate: null,
        color: '#39ff14',
        status: 'active',
        archived: false,
        deleted: false,
        createdAt: nowTs,
        updatedAt: nowTs,
        ...input
      };
  await put('projects', p);
  const i = data.projects.findIndex((x) => x.id === p.id);
  if (i >= 0) data.projects[i] = p;
  else data.projects.push(p);
  return p;
}

export async function setArchived(projectId, archived) {
  const p = data.projects.find((x) => x.id === projectId);
  if (!p) return;
  await stopTimer(projectId).catch(() => {});
  await saveProject({ ...p, archived });
}

/**
 * Permanently delete a project.
 * deleteEntries=false keeps its time entries: they stay in the data as
 * "unassigned" (their projectId no longer resolves) and views bucket them
 * under an Unassigned label.
 */
export async function deleteProject(projectId, { deleteEntries = true } = {}) {
  const p = data.projects.find((x) => x.id === projectId);
  if (!p) return;
  // A running timer either becomes a kept entry or is discarded with the rest.
  if (deleteEntries) {
    await db.del('timers', projectId).catch(() => {});
    data.timers = data.timers.filter((x) => x.projectId !== projectId);
  } else {
    await stopTimer(projectId).catch(() => {});
  }
  await put('projects', { ...p, deleted: true, updatedAt: Date.now() }); // tombstone for sync
  data.projects = data.projects.filter((x) => x.id !== projectId);
  if (deleteEntries) {
    const dead = data.entries.filter((e) => e.projectId === projectId);
    for (const e of dead) await put('entries', { ...e, deleted: true, updatedAt: Date.now() });
    data.entries = data.entries.filter((e) => e.projectId !== projectId);
  }
}

/* ------------------------------ timers --------------------------------- */

export async function startTimer(projectId, startedAt = Date.now()) {
  if (data.timers.some((t) => t.projectId === projectId)) return;
  const t = { projectId, startedAt };
  await put('timers', t);
  data.timers.push(t);
}

/** Stops a timer and writes the tracked interval as an entry. */
export async function stopTimer(projectId) {
  const t = data.timers.find((x) => x.projectId === projectId);
  if (!t) return null;
  await db.del('timers', projectId);
  data.timers = data.timers.filter((x) => x.projectId !== projectId);
  const end = Date.now();
  if (end - t.startedAt < 3000) return null; // ignore accidental taps under 3s
  return addEntry({ projectId, start: t.startedAt, end });
}

export const isRunning = (projectId) => data.timers.some((t) => t.projectId === projectId);

/* ------------------------------ entries -------------------------------- */

export async function addEntry({ projectId, start, end, note = '', breaks = [] }) {
  const nowTs = Date.now();
  const e = { id: uid(), projectId, start, end, note, breaks, deleted: false, createdAt: nowTs, updatedAt: nowTs };
  await put('entries', e);
  data.entries.push(e);
  return e;
}

export async function updateEntry(entry) {
  const e = { ...entry, updatedAt: Date.now() };
  await put('entries', e);
  const i = data.entries.findIndex((x) => x.id === e.id);
  if (i >= 0) data.entries[i] = e;
}

export async function deleteEntry(id) {
  const e = data.entries.find((x) => x.id === id);
  if (!e) return;
  await put('entries', { ...e, deleted: true, updatedAt: Date.now() });
  data.entries = data.entries.filter((x) => x.id !== id);
}

/* ---------------------------- derived math ----------------------------- */

/** Total tracked ms for a project incl. a currently running timer. Reactive. */
export function trackedMs(projectId) {
  let ms = 0;
  for (const e of data.entries) if (e.projectId === projectId) ms += entryMs(e);
  const t = data.timers.find((x) => x.projectId === projectId);
  if (t) ms += Math.max(0, clock.now - t.startedAt);
  return ms;
}

/* ------------------------------ backup --------------------------------- */

export function exportBackup() {
  return JSON.stringify(
    {
      app: 'timetrack',
      version: 1,
      exportedAt: new Date().toISOString(),
      projects: data.projects,
      entries: data.entries,
      settings: { ...settings }
    },
    null,
    2
  );
}

/** Merge a backup: newer updatedAt wins; unknown ids are added. */
export async function importBackup(json) {
  const parsed = JSON.parse(json);
  if (parsed.app !== 'timetrack') throw new Error('Not a Timetrack backup');
  const merge = async (storeName, incoming, key) => {
    // $state proxies are not structured-cloneable — IndexedDB would throw
    // DataCloneError, so merge on plain snapshots.
    const byId = new Map($state.snapshot(data[key]).map((x) => [x.id, x]));
    for (const item of incoming || []) {
      const existing = byId.get(item.id);
      if (!existing || (item.updatedAt || 0) > (existing.updatedAt || 0)) byId.set(item.id, item);
    }
    await bulkPut(storeName, [...byId.values()]);
    data[key] = [...byId.values()].filter((x) => !x.deleted);
  };
  await merge('projects', parsed.projects, 'projects');
  await merge('entries', parsed.entries, 'entries');
}

/* ------------------------------ cloud sync ------------------------------ */

/**
 * Merge remote records into local state, last-updated-wins.
 * kind: 'projects' | 'entries'. Records are plain objects in the local
 * shape (already mapped from DB rows), including tombstones.
 */
export async function applyRemote(kind, records) {
  if (!records.length) return;
  const storeName = kind === 'projects' ? 'projects' : 'entries';
  const existing = await db.all(storeName); // includes tombstones
  const byId = new Map(existing.map((x) => [x.id, x]));
  const winners = [];
  for (const r of records) {
    const cur = byId.get(r.id);
    if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) {
      byId.set(r.id, r);
      winners.push(r);
    }
  }
  if (!winners.length) return;
  await bulkPut(storeName, winners);
  data[kind === 'projects' ? 'projects' : 'entries'] = [...byId.values()].filter((x) => !x.deleted);
}

/** Replace the local running-timer set with the server's state. */
export async function applyRemoteTimers(list) {
  const local = await db.all('timers');
  const incoming = new Map(list.map((t) => [t.projectId, t]));
  for (const t of local) if (!incoming.has(t.projectId)) await db.del('timers', t.projectId);
  for (const t of list) await put('timers', t);
  data.timers = list;
}

/** Merge remote settings, last-updated-wins per key. */
export async function applyRemoteSettings(records) {
  const existing = await db.all('settings');
  const byKey = new Map(existing.map((s) => [s.key, s]));
  for (const r of records) {
    const cur = byKey.get(r.key);
    if (!cur || (r.updatedAt || 0) > (cur.updatedAt || 0)) {
      await put('settings', r);
      settings[r.key] = r.value;
    }
  }
}

export async function eraseAll() {
  await Promise.all([db.clear('projects'), db.clear('entries'), db.clear('timers')]);
  data.projects = [];
  data.entries = [];
  data.timers = [];
}
