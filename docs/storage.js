const DB_NAME = "gym-os";
const DB_VERSION = 1;
const STORE = "state";

const ACTIVE_KEY = "activeSession";
const HISTORY_KEY = "history";
const META_KEY = "meta";

const LEGACY_ACTIVE_KEY = "gymos.activeSession.v1";
const LEGACY_HISTORY_KEY = "gymos.history.v1";

function parseLegacy(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed."));
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB request failed."));
  });
}

function transactionDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error("IndexedDB transaction failed."));
    tx.onabort = () => reject(tx.error || new Error("IndexedDB transaction aborted."));
  });
}

async function readIndexedState(db) {
  const tx = db.transaction(STORE, "readonly");
  const store = tx.objectStore(STORE);

  const [activeSession, history, meta] = await Promise.all([
    requestToPromise(store.get(ACTIVE_KEY)),
    requestToPromise(store.get(HISTORY_KEY)),
    requestToPromise(store.get(META_KEY)),
  ]);

  return {
    activeSession: activeSession ?? null,
    history: Array.isArray(history) ? history : [],
    meta: meta ?? null,
  };
}

async function writeIndexedState(db, { activeSession, history }) {
  const tx = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);

  if (activeSession) store.put(activeSession, ACTIVE_KEY);
  else store.delete(ACTIVE_KEY);

  store.put(Array.isArray(history) ? history : [], HISTORY_KEY);
  store.put({ schemaVersion: 1, migratedAt: new Date().toISOString() }, META_KEY);

  await transactionDone(tx);
}

async function migrateLegacyIfNeeded(db) {
  const current = await readIndexedState(db);
  if (current.meta?.schemaVersion >= 1) return current;

  const legacyActive = parseLegacy(LEGACY_ACTIVE_KEY);
  const legacyHistory = parseLegacy(LEGACY_HISTORY_KEY);

  const next = {
    activeSession: current.activeSession ?? legacyActive ?? null,
    history:
      current.history.length > 0
        ? current.history
        : Array.isArray(legacyHistory)
          ? legacyHistory
          : [],
  };

  await writeIndexedState(db, next);

  localStorage.removeItem(LEGACY_ACTIVE_KEY);
  localStorage.removeItem(LEGACY_HISTORY_KEY);

  return { ...next, meta: { schemaVersion: 1 } };
}

function loadFallbackState() {
  return {
    activeSession: parseLegacy(LEGACY_ACTIVE_KEY),
    history: parseLegacy(LEGACY_HISTORY_KEY) || [],
    storageMode: "localStorage-fallback",
  };
}

function saveFallbackState({ activeSession, history }) {
  if (activeSession) {
    localStorage.setItem(LEGACY_ACTIVE_KEY, JSON.stringify(activeSession));
  } else {
    localStorage.removeItem(LEGACY_ACTIVE_KEY);
  }
  localStorage.setItem(LEGACY_HISTORY_KEY, JSON.stringify(history || []));
}

let dbPromise = null;

async function getDb() {
  if (!("indexedDB" in globalThis)) throw new Error("IndexedDB unavailable.");
  if (!dbPromise) dbPromise = openDatabase();
  return dbPromise;
}

export async function loadAppState() {
  try {
    const db = await getDb();
    const data = await migrateLegacyIfNeeded(db);
    return {
      activeSession: data.activeSession ?? null,
      history: Array.isArray(data.history) ? data.history : [],
      storageMode: "indexedDB",
    };
  } catch {
    return loadFallbackState();
  }
}

export async function saveAppState({ activeSession, history }) {
  try {
    const db = await getDb();
    await writeIndexedState(db, { activeSession, history });
    return { storageMode: "indexedDB" };
  } catch {
    saveFallbackState({ activeSession, history });
    return { storageMode: "localStorage-fallback" };
  }
}

export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) {
      return { supported: false, persisted: false };
    }

    const alreadyPersisted = navigator.storage.persisted
      ? await navigator.storage.persisted()
      : false;

    if (alreadyPersisted) {
      return { supported: true, persisted: true };
    }

    const persisted = await navigator.storage.persist();
    return { supported: true, persisted: Boolean(persisted) };
  } catch {
    return { supported: false, persisted: false };
  }
}
