import { AsyncLocalStorage } from "node:async_hooks";

import type { DemoDb } from "@/demo/db";
import { setDemoDbProvider } from "@/demo/context";
import {
  DEMO_PATCH_HEADER,
  DEMO_REQUEST_HEADER,
  applyOverlay,
  capRows,
  createSeededDb,
  decodeOverlay,
  encodeOverlay,
} from "@/demo/overlay";

type Scope = { db: DemoDb; dirty: Set<string> };

const storage = new AsyncLocalStorage<Scope>();
setDemoDbProvider(() => storage.getStore()?.db);

/**
 * Serverless instances share nothing, so each request rebuilds the database from the
 * bundled fixtures plus the visitor's saved tables (sent by the browser) and returns
 * whatever the handler changed in a response header. Nothing is written to disk.
 */
export async function withDemoDb(request: Request, run: () => Promise<Response>): Promise<Response> {
  const db = createSeededDb();
  const encoded = request.headers.get(DEMO_REQUEST_HEADER);
  if (encoded) {
    const overlay = await decodeOverlay(encoded);
    if (overlay) applyOverlay(db, overlay);
  }
  const dirty = new Set<string>();
  db.onMutate = (table) => dirty.add(table);

  const response = await storage.run({ db, dirty }, run);
  if (dirty.size === 0) return response;
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) return response;

  const tables: Record<string, unknown[]> = {};
  for (const table of dirty) tables[table] = capRows(table, db.rows(table));
  const patch = await encodeOverlay({ v: 1, tables: tables as never });
  const headers = new Headers(response.headers);
  headers.set(DEMO_PATCH_HEADER, patch);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
