import { AsyncLocalStorage } from "node:async_hooks";

import type { DemoDb } from "@/demo/db";
import { setDemoDbProvider } from "@/demo/context";
import { emptyReport, installGuard } from "@/features/channel-team/guard";
import type { ActorContext } from "@/features/channel-team/types";
import {
  DEMO_ACTOR_HEADER,
  DEMO_CHANNEL_HEADER,
  DEMO_PATCH_HEADER,
  DEMO_REQUEST_HEADER,
  DEMO_TEAM_HEADER,
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
  const channel = request.headers.get(DEMO_CHANNEL_HEADER) || undefined;
  const db = createSeededDb(channel && /^[a-z0-9-]{1,40}$/.test(channel) ? channel : undefined);
  const report = emptyReport();
  const actorHeader = request.headers.get(DEMO_ACTOR_HEADER);
  const actor = actorHeader ? parseActor(actorHeader) : null;
  if (actor) {
    installGuard(db, () => actor, {
      audit: (entry) => void report.audit.push(entry),
      denied: (key) => void report.denied.push({ key }),
    });
  }
  const encoded = request.headers.get(DEMO_REQUEST_HEADER);
  if (encoded) {
    const overlay = await decodeOverlay(encoded);
    if (overlay) applyOverlay(db, overlay);
  }
  const dirty = new Set<string>();
  db.onMutate = (table) => dirty.add(table);

  const response = await storage.run({ db, dirty }, run);
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) return response;
  const hasReport = report.audit.length > 0 || report.denied.length > 0;
  if (dirty.size === 0 && !hasReport) return response;

  const tables: Record<string, unknown[]> = {};
  for (const table of dirty) tables[table] = capRows(table, db.rows(table));
  const headers = new Headers(response.headers);
  if (dirty.size > 0) headers.set(DEMO_PATCH_HEADER, await encodeOverlay({ v: 1, tables: tables as never }));
  if (hasReport) headers.set(DEMO_TEAM_HEADER, Buffer.from(JSON.stringify(report)).toString("base64url"));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function parseActor(encoded: string): ActorContext | null {
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as ActorContext;
    if (!parsed || typeof parsed.owner !== "boolean" || !Array.isArray(parsed.keys)) return null;
    return {
      channelId: String(parsed.channelId),
      actorId: String(parsed.actorId),
      owner: parsed.owner,
      keys: parsed.keys.map(String) as ActorContext["keys"],
    };
  } catch {
    return null;
  }
}