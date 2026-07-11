/**
 * Automatic cloud backup to a private GitHub repository (runes module).
 *
 * Every data change is pushed (debounced) as a full JSON snapshot to
 * `backup.json` in the user's private backup repo via the GitHub Contents
 * API. Each backup is a commit, so the repo keeps full history for free.
 *
 * The only credential is a fine-grained personal access token scoped to the
 * backup repo (Contents: read/write). It lives in localStorage, so wiping
 * website data also wipes it — the restore flow asks for it again.
 */
import { data, settings, exportBackup, importBackup, saveSetting } from './store.svelte.js';

const OWNER = 'vt4bd7hrkt-maker';
const REPO = 'timetrack-backup';
const FILE_API = `https://api.github.com/repos/${OWNER}/${REPO}/contents/backup.json`;
const REPO_API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const TOKEN_KEY = 'tt.cloudToken';
const LAST_KEY = 'tt.cloudLastBackup';

const DEBOUNCE_MS = 4000;
const RETRY_MS = 60000;

export const cloud = $state({
  enabled: false,
  status: 'idle', // idle | saving | offline | error
  lastBackup: null,
  error: ''
});

let token = '';
let sha; // undefined = unknown, null = no remote backup yet, string = current file sha
let timer = null;
let lastFp = null;

const headers = () => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28'
});

/** Unicode-safe base64, chunked so large backups don't blow the call stack. */
function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/** Cheap change fingerprint: any mutation bumps a length or an updatedAt. */
function fingerprint() {
  let m = 0;
  for (const p of data.projects) if ((p.updatedAt || 0) > m) m = p.updatedAt;
  for (const e of data.entries) if ((e.updatedAt || 0) > m) m = e.updatedAt;
  return [
    data.projects.length, data.entries.length, m,
    settings.theme, settings.language, settings.dailyGoal, settings.reminders
  ].join(':');
}

async function refreshSha() {
  const res = await fetch(FILE_API, { headers: headers() });
  if (res.status === 404) { sha = null; return; }
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  sha = (await res.json()).sha;
}

function scheduleBackup(delay = DEBOUNCE_MS) {
  clearTimeout(timer);
  timer = setTimeout(backupNow, delay);
}

export async function backupNow() {
  if (!token) return;
  clearTimeout(timer);
  timer = null;
  cloud.status = 'saving';
  cloud.error = '';
  try {
    if (sha === undefined) await refreshSha();
    const body = { message: `Backup ${new Date().toISOString()}`, content: b64(exportBackup()) };
    if (sha) body.sha = sha;
    let res = await fetch(FILE_API, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    if (res.status === 409 || res.status === 422) {
      await refreshSha();
      if (sha) body.sha = sha; else delete body.sha;
      res = await fetch(FILE_API, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    }
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    sha = (await res.json()).content.sha;
    cloud.lastBackup = Date.now();
    localStorage.setItem(LAST_KEY, String(cloud.lastBackup));
    cloud.status = 'idle';
  } catch (err) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      cloud.status = 'offline';
    } else {
      cloud.status = 'error';
      cloud.error = String(err.message || err);
    }
    scheduleBackup(RETRY_MS); // data unchanged on failure, so retry until it lands
  }
}

/** Validates the token against the backup repo and enables auto-backup. */
export async function connect(newToken) {
  const res = await fetch(REPO_API, {
    headers: { Authorization: `Bearer ${newToken}`, Accept: 'application/vnd.github+json' }
  });
  if (!res.ok) {
    const err = new Error(`GitHub ${res.status}`);
    err.status = res.status;
    throw err;
  }
  token = newToken;
  localStorage.setItem(TOKEN_KEY, token);
  cloud.enabled = true;
  sha = undefined;
  await refreshSha();
  return { hasBackup: !!sha };
}

export function disconnect() {
  token = '';
  sha = undefined;
  clearTimeout(timer);
  timer = null;
  localStorage.removeItem(TOKEN_KEY);
  cloud.enabled = false;
  cloud.status = 'idle';
  cloud.error = '';
}

/** Pulls the cloud snapshot, merges it in, applies settings, re-uploads the merge. */
export async function restoreNow() {
  const res = await fetch(FILE_API, {
    headers: { ...headers(), Accept: 'application/vnd.github.raw+json' }
  });
  if (res.status === 404) throw new Error('no backup');
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const text = await res.text();
  await importBackup(text);
  const parsed = JSON.parse(text);
  for (const key of ['theme', 'language', 'dailyGoal', 'reminders']) {
    if (parsed.settings && parsed.settings[key] !== undefined) {
      await saveSetting(key, parsed.settings[key]);
    }
  }
  lastFp = fingerprint(); // the merge itself shouldn't count as a new change…
  await backupNow(); // …but the merged state should become the new snapshot
}

/** Call once from App.svelte — restores connection state and starts the watcher. */
export function initCloudBackup() {
  token = localStorage.getItem(TOKEN_KEY) || '';
  cloud.enabled = !!token;
  const last = Number(localStorage.getItem(LAST_KEY));
  cloud.lastBackup = last || null;

  $effect.root(() => {
    $effect(() => {
      const fp = fingerprint(); // read first so the effect tracks the data
      if (!data.ready || !cloud.enabled) return;
      if (lastFp === null) { lastFp = fp; return; } // baseline right after load
      if (fp === lastFp) return;
      lastFp = fp;
      scheduleBackup();
    });
  });

  window.addEventListener('online', () => {
    if (cloud.enabled && (timer || cloud.status === 'offline')) backupNow();
  });
  // iOS may kill a backgrounded PWA — flush a pending backup when we hide.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) backupNow();
  });
}
