import type { DemoDb } from "@/demo/db";
import {
  DEMO_CHANGE_EVENT,
  DEMO_DB_KEY,
  applyOverlay,
  capRows,
  createSeededDb,
  emptyOverlay,
  readStoredOverlay,
  writeStoredOverlay,
  type DemoOverlay,
} from "@/demo/overlay";

type Provider = () => DemoDb | undefined;
type Globals = {
  __demoDbProvider?: Provider;
  __demoClientDb?: DemoDb;
  __demoServerDb?: DemoDb;
  __demoStorageHooked?: boolean;
};
const g = globalThis as unknown as Globals;

const isBrowser = () => typeof window !== "undefined";

/** The server entry registers a per-request provider (AsyncLocalStorage). */
export function setDemoDbProvider(provider: Provider): void {
  g.__demoDbProvider = provider;
}

function announce(): void {
  if (isBrowser()) window.dispatchEvent(new Event(DEMO_CHANGE_EVENT));
}

function buildClientDb(): DemoDb {
  const db = createSeededDb();
  applyOverlay(db, readStoredOverlay());
  const dirty = new Set<string>();
  let scheduled = false;
  db.onMutate = (table) => {
    dirty.add(table);
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      const overlay = readStoredOverlay();
      for (const name of dirty) overlay.tables[name] = capRows(name, db.rows(name));
      dirty.clear();
      writeStoredOverlay(overlay);
      announce();
    });
  };
  if (!g.__demoStorageHooked) {
    g.__demoStorageHooked = true;
    window.addEventListener("storage", (event) => {
      if (event.key === DEMO_DB_KEY || event.key === null) reloadClientDb();
    });
  }
  return db;
}

export function getClientDb(): DemoDb {
  if (!g.__demoClientDb) g.__demoClientDb = buildClientDb();
  return g.__demoClientDb;
}

/** Re-reads localStorage into the in-memory client database (e.g. after another tab wrote). */
export function reloadClientDb(): void {
  if (!isBrowser()) return;
  const db = g.__demoClientDb;
  if (!db) return;
  const fresh = createSeededDb();
  applyOverlay(fresh, readStoredOverlay());
  for (const [table, rows] of Object.entries(fresh.snapshot())) db.setTable(table, rows);
  announce();
}

/** Applies tables returned by a server function into the visitor's saved state. */
export function mergeServerPatch(patch: DemoOverlay): void {
  if (!isBrowser()) return;
  const overlay = readStoredOverlay();
  const db = getClientDb();
  for (const [table, rows] of Object.entries(patch.tables)) {
    overlay.tables[table] = capRows(table, rows);
    db.setTable(table, overlay.tables[table]!);
  }
  writeStoredOverlay(overlay);
  announce();
}

export function resetClientDb(): void {
  if (!isBrowser()) return;
  writeStoredOverlay(emptyOverlay());
  window.localStorage.removeItem(DEMO_DB_KEY);
  g.__demoClientDb = undefined;
  getClientDb();
  announce();
}

/** Active database: per-request on the server, the visitor's browser copy on the client. */
export function getDemoDb(): DemoDb {
  const scoped = g.__demoDbProvider?.();
  if (scoped) return scoped;
  if (isBrowser()) return getClientDb();
  if (!g.__demoServerDb) g.__demoServerDb = createSeededDb();
  return g.__demoServerDb;
}
