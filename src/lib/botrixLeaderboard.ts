/**
 * BotRix leaderboard mapping, shared by the public-API import, the file import and the unit check.
 * Pure: no imports, so it runs in the browser, the server and plain node.
 *
 * Source shape (https://botrix.live/api/public/leaderboard):
 *   { name, level, xp, points, watchtime, followage: { date } }
 * `watchtime` is not documented by BotRix. Real rows show it equal to `points` for channels that award
 * 1 point per minute, so it is read as MINUTES and stored as seconds (`watch_seconds`) by multiplying by 60.
 * A file that carries `watch_seconds` (this app's own unit) is stored as is.
 *
 * loyalty_members only has: display_name, level (1..10000), points (0..100000000), watch_seconds (>= 0).
 * Everything else (xp, followage, any other column) is "unmapped" and is kept in the import summary.
 */

export const BOTRIX_WATCHTIME_UNIT_SECONDS = 60;
export const MAX_LEVEL = 10_000;
export const MAX_POINTS = 100_000_000;
export const MAX_FILE_ROWS = 1000;

export type BotRixExtra = Record<string, string | number | boolean>;

export type BotRixRow = {
  name: string;
  level: number | null;
  points: number | null;
  xp: number | null;
  /** Raw BotRix `watchtime` (minutes). */
  watchtime: number | null;
  /** Seconds, from `watch_seconds` when the source already uses this app's unit. */
  watchSeconds: number | null;
  extra: BotRixExtra;
};

export type BotRixImportRow = {
  name: string;
  level: number | null;
  points: number | null;
  watchSeconds: number | null;
};

export type BotRixUnmappedEntry = { name: string; fields: BotRixExtra };

const NAME_KEYS = ["name", "username", "user", "display_name", "displayname", "viewer"];
const LEVEL_KEYS = ["level", "lvl"];
const POINTS_KEYS = ["points", "point", "balance"];
const XP_KEYS = ["xp"];
const WATCHTIME_KEYS = ["watchtime", "watch_time", "watchtime_minutes"];
const WATCH_SECONDS_KEYS = ["watch_seconds", "watchseconds"];
const MAPPED = new Set([...NAME_KEYS, ...LEVEL_KEYS, ...POINTS_KEYS, ...XP_KEYS, ...WATCHTIME_KEYS, ...WATCH_SECONDS_KEYS]);

export function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/,/g, "");
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function pick(record: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    if (key in record && record[key] !== null && record[key] !== undefined && record[key] !== "") return record[key];
  }
  return undefined;
}

function flatten(prefix: string, value: unknown, out: BotRixExtra, depth: number) {
  if (value === null || value === undefined || value === "") return;
  if (depth < 2 && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      flatten(`${prefix}.${key}`, inner, out, depth + 1);
    }
    return;
  }
  out[prefix] =
    typeof value === "string" || typeof value === "number" || typeof value === "boolean"
      ? value
      : JSON.stringify(value);
}

export function extraFields(record: Record<string, unknown>): BotRixExtra {
  const out: BotRixExtra = {};
  for (const [key, value] of Object.entries(record)) {
    if (MAPPED.has(key.toLowerCase())) continue;
    flatten(key, value, out, 0);
  }
  return out;
}

export function mapBotRixRecord(raw: unknown): BotRixRow | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) record[key.trim().toLowerCase()] = value;
  const nameValue = pick(record, NAME_KEYS);
  const name = typeof nameValue === "string" ? nameValue.replace(/\u0000/g, "").trim().slice(0, 80) : "";
  if (!name) return null;
  return {
    name,
    level: toNumber(pick(record, LEVEL_KEYS)),
    points: toNumber(pick(record, POINTS_KEYS)),
    xp: toNumber(pick(record, XP_KEYS)),
    watchtime: toNumber(pick(record, WATCHTIME_KEYS)),
    watchSeconds: toNumber(pick(record, WATCH_SECONDS_KEYS)),
    extra: extraFields(record),
  };
}

export function watchSecondsOf(row: Pick<BotRixRow, "watchtime" | "watchSeconds">): number | null {
  if (row.watchSeconds !== null) return Math.max(0, Math.round(row.watchSeconds));
  if (row.watchtime !== null) return Math.max(0, Math.round(row.watchtime * BOTRIX_WATCHTIME_UNIT_SECONDS));
  return null;
}

export function toImportRow(row: BotRixRow): BotRixImportRow {
  return { name: row.name, level: row.level, points: row.points, watchSeconds: watchSecondsOf(row) };
}

export function clampLevel(value: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.round(value)));
}

export function clampPoints(value: number): number {
  return Math.min(MAX_POINTS, Math.max(0, Math.round(value)));
}

export type MemberInsert = { display_name: string; level: number; points: number; watch_seconds: number };
export type MemberPatch = { level?: number; points?: number; watch_seconds?: number };

export type LeaderboardPlan = {
  inserts: MemberInsert[];
  updates: { ids: string[]; patch: MemberPatch }[];
  skipped: number;
};

/**
 * Existing members are matched by display name (case-insensitive) and only receive the values the source
 * actually has. New members get the schema defaults (level 1, 0 points, 0 seconds) for what is missing.
 */
export function planLeaderboardImport(
  existing: { id: string; display_name: string }[],
  rows: BotRixImportRow[],
): LeaderboardPlan {
  const byName = new Map<string, string[]>();
  for (const member of existing) {
    const key = member.display_name.trim().toLowerCase();
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), member.id]);
  }
  const plan: LeaderboardPlan = { inserts: [], updates: [], skipped: 0 };
  const seenNew = new Map<string, MemberInsert>();
  for (const row of rows) {
    const name = row.name.trim().slice(0, 80);
    if (!name || (row.points === null && row.level === null && row.watchSeconds === null)) {
      plan.skipped += 1;
      continue;
    }
    const patch: MemberPatch = {};
    if (row.points !== null) patch.points = clampPoints(row.points);
    if (row.level !== null) patch.level = clampLevel(row.level);
    if (row.watchSeconds !== null) patch.watch_seconds = Math.max(0, Math.round(row.watchSeconds));
    const key = name.toLowerCase();
    const ids = byName.get(key);
    if (ids?.length) {
      plan.updates.push({ ids, patch });
      continue;
    }
    const pending = seenNew.get(key);
    if (pending) {
      Object.assign(pending, {
        ...(patch.level !== undefined ? { level: patch.level } : {}),
        ...(patch.points !== undefined ? { points: patch.points } : {}),
        ...(patch.watch_seconds !== undefined ? { watch_seconds: patch.watch_seconds } : {}),
      });
      continue;
    }
    const insert: MemberInsert = {
      display_name: name,
      level: patch.level ?? 1,
      points: patch.points ?? 0,
      watch_seconds: patch.watch_seconds ?? 0,
    };
    seenNew.set(key, insert);
    plan.inserts.push(insert);
  }
  return plan;
}

export function unmappedOf(rows: BotRixRow[]): BotRixUnmappedEntry[] {
  const out: BotRixUnmappedEntry[] = [];
  for (const row of rows) {
    const fields: BotRixExtra = { ...row.extra };
    if (row.xp !== null) fields["xp"] = row.xp;
    if (Object.keys(fields).length > 0) out.push({ name: row.name, fields });
  }
  return out;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else current += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

export function parseCsvRecords(text: string): Record<string, unknown>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length < 2) return [];
  const header = lines[0]!;
  const delimiter = [",", ";", "\t"].reduce((best, next) =>
    header.split(next).length > header.split(best).length ? next : best,
  );
  const names = splitCsvLine(header, delimiter).map((cell) => cell.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line, delimiter);
    const record: Record<string, unknown> = {};
    names.forEach((name, index) => {
      if (name) record[name] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

const CONTAINER_KEYS = ["leaderboard", "data", "users", "members", "rows", "items", "results", "viewers"];

export type ParsedBotRixFile =
  | { ok: true; rows: BotRixRow[]; invalid: number; truncated: boolean; format: "json" | "csv" }
  | { ok: false; error: "empty" | "unreadable" | "no_rows" };

export function parseBotRixFile(text: string, fileName = ""): ParsedBotRixFile {
  const body = text.replace(/^\uFEFF/, "").trim();
  if (!body) return { ok: false, error: "empty" };
  let records: unknown[] | null = null;
  let format: "json" | "csv" = "json";
  if (body.startsWith("[") || body.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (Array.isArray(parsed)) records = parsed;
      else if (parsed && typeof parsed === "object") {
        const record = parsed as Record<string, unknown>;
        const key = CONTAINER_KEYS.find((candidate) => Array.isArray(record[candidate]));
        records = key ? (record[key] as unknown[]) : [record];
      }
    } catch {
      records = null;
    }
  }
  if (!records && !/\.json$/i.test(fileName)) {
    records = parseCsvRecords(body);
    format = "csv";
  }
  if (!records) return { ok: false, error: "unreadable" };
  const rows: BotRixRow[] = [];
  let invalid = 0;
  for (const record of records) {
    const mapped = mapBotRixRecord(record);
    if (mapped) rows.push(mapped);
    else invalid += 1;
  }
  if (rows.length === 0) return { ok: false, error: "no_rows" };
  return { ok: true, rows: rows.slice(0, MAX_FILE_ROWS), invalid, truncated: rows.length > MAX_FILE_ROWS, format };
}

export function formatRawValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}
