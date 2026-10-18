import { DemoDb, type DemoSnapshot, type Row } from "@/demo/db";
import { buildDemoSnapshot, DEMO_RPC } from "@/demo/fixtures";

/** localStorage key holding the visitor's edited tables. */
export const DEMO_DB_KEY = "cylixstudio-demo:db:v1";
export const DEMO_REQUEST_HEADER = "x-demo-db";
export const DEMO_PATCH_HEADER = "x-demo-patch";
export const DEMO_CHANGE_EVENT = "cylixstudio-demo:db-change";

/** Event logs are capped so the overlay stays small enough to travel in a header. */
const TRANSIENT_CAPS: Record<string, number> = {
  events: 40,
  target_events: 40,
  audit_logs: 20,
  demo_kv: 400,
};

export type DemoOverlay = { v: 1; tables: DemoSnapshot };

export function emptyOverlay(): DemoOverlay {
  return { v: 1, tables: {} };
}

export function createSeededDb(): DemoDb {
  const db = new DemoDb(buildDemoSnapshot());
  db.rpcHandlers = { ...DEMO_RPC };
  return db;
}

export function applyOverlay(db: DemoDb, overlay: DemoOverlay): void {
  for (const [table, rows] of Object.entries(overlay.tables)) db.setTable(table, rows);
}

export function capRows(table: string, rows: Row[]): Row[] {
  const cap = TRANSIENT_CAPS[table];
  if (!cap || rows.length <= cap) return rows;
  const sorted = [...rows].sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  return sorted.slice(0, cap);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((text.length + 3) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const writer = stream.writable.getWriter();
  void writer.write(bytes as unknown as BufferSource);
  void writer.close();
  return new Uint8Array(await new Response(stream.readable).arrayBuffer());
}

export async function encodeOverlay(overlay: DemoOverlay): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(overlay));
  return toBase64Url(await pipe(raw, new CompressionStream("gzip")));
}

export async function decodeOverlay(text: string): Promise<DemoOverlay | null> {
  try {
    const raw = await pipe(fromBase64Url(text), new DecompressionStream("gzip"));
    const parsed = JSON.parse(new TextDecoder().decode(raw)) as DemoOverlay;
    return parsed && parsed.v === 1 && parsed.tables && typeof parsed.tables === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function readStoredOverlay(): DemoOverlay {
  if (typeof window === "undefined") return emptyOverlay();
  try {
    const raw = window.localStorage.getItem(DEMO_DB_KEY);
    if (!raw) return emptyOverlay();
    const parsed = JSON.parse(raw) as DemoOverlay;
    return parsed && parsed.v === 1 && parsed.tables ? parsed : emptyOverlay();
  } catch {
    return emptyOverlay();
  }
}

export function writeStoredOverlay(overlay: DemoOverlay): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DEMO_DB_KEY, JSON.stringify(overlay));
  } catch {
    // Quota exceeded: keep working in memory only.
  }
}
