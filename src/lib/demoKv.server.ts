import { getDemoDb } from "@/demo/context";

const TABLE = "demo_kv";

/** Tiny synchronous key/value store backed by the demo database (persists in the visitor's browser). */
export function kvGet(key: string): string | null {
  const row = getDemoDb()
    .rows(TABLE)
    .find((item) => item["id"] === key);
  return row ? String(row["value"] ?? "") : null;
}

export function kvSet(key: string, value: string): void {
  const db = getDemoDb();
  const previous = db.rows(TABLE).find((item) => item["id"] === key);
  db.put(TABLE, { id: key, value, created_at: new Date().toISOString() }, previous);
}

export function kvDelete(key: string): void {
  const db = getDemoDb();
  const previous = db.rows(TABLE).find((item) => item["id"] === key);
  if (previous) db.remove(TABLE, previous);
}
