/**
 * Thin promise-based IndexedDB wrapper.
 *
 * Sync-readiness: every record carries `updatedAt` and soft-delete flag
 * `deleted`. A future cloud sync layer can diff on updatedAt and replicate
 * tombstones without schema changes.
 */
const DB_NAME = 'timetrack';
const DB_VERSION = 2; // v2: adds 'meta' (sync watermarks & flags)

let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('entries')) {
        const s = db.createObjectStore('entries', { keyPath: 'id' });
        s.createIndex('projectId', 'projectId');
        s.createIndex('start', 'start');
      }
      if (!db.objectStoreNames.contains('timers')) {
        db.createObjectStore('timers', { keyPath: 'projectId' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, mode);
        const s = t.objectStore(store);
        const out = fn(s);
        t.oncomplete = () => resolve(out && out.result !== undefined ? out.result : undefined);
        t.onerror = () => reject(t.error);
      })
  );
}

export const all = (store) =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction(store).objectStore(store).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      })
  );

export const put = (store, value) => tx(store, 'readwrite', (s) => s.put(value));
export const del = (store, key) => tx(store, 'readwrite', (s) => s.delete(key));
export const clear = (store) => tx(store, 'readwrite', (s) => s.clear());

export const bulkPut = (store, values) =>
  tx(store, 'readwrite', (s) => {
    values.forEach((v) => s.put(v));
  });

/* --- tiny key/value helpers on the 'meta' store (sync watermarks etc.) --- */

export const getMeta = (key) =>
  open().then(
    (db) =>
      new Promise((resolve, reject) => {
        const req = db.transaction('meta').objectStore('meta').get(key);
        req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
        req.onerror = () => reject(req.error);
      })
  );

export const setMeta = (key, value) => put('meta', { key, value });
