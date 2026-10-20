import { dbKeyFor } from "@/demo/overlay";
import { readActiveChannelId } from "@/features/channel-team/storage";
import { importBotRixLeaderboard } from "@/lib/botrix.functions";
import { toImportRow, unmappedOf, type BotRixRow, type BotRixUnmappedEntry } from "@/lib/botrixLeaderboard";

const IMPORT_CHUNK = 100;

export type BotRixImportSummary = {
  at: string;
  source: string;
  rows: number;
  imported: number;
  updated: number;
  skipped: number;
  withLevel: number;
  withWatch: number;
  levelRaised: number;
  unmappedFields: string[];
  unmapped: BotRixUnmappedEntry[];
};

export const BOTRIX_SUMMARY_EVENT = "cylixstudio-demo:botrix-summary";
const MAX_UNMAPPED = 300;

function storageKey(): string {
  return `${dbKeyFor(readActiveChannelId())}:botrix-import`;
}

export function readBotRixSummary(): BotRixImportSummary | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as BotRixImportSummary) : null;
  } catch {
    return null;
  }
}

export function clearBotRixSummary(): void {
  try {
    window.localStorage.removeItem(storageKey());
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(BOTRIX_SUMMARY_EVENT));
}

export async function importBotRixRows(
  source: string,
  rows: BotRixRow[],
  invalid = 0,
): Promise<BotRixImportSummary | null> {
  const total = { imported: 0, updated: 0, skipped: invalid };
  for (let start = 0; start < rows.length; start += IMPORT_CHUNK) {
    const chunk = rows.slice(start, start + IMPORT_CHUNK);
    const saved = await importBotRixLeaderboard({ data: { rows: chunk.map(toImportRow) } });
    total.imported += saved.imported;
    total.updated += saved.updated;
    total.skipped += saved.skipped;
    if (!saved.ok) return null;
  }
  return recordBotRixImport(source, rows, total, invalid);
}

export function recordBotRixImport(
  source: string,
  rows: BotRixRow[],
  counts: { imported: number; updated: number; skipped: number },
  invalid = 0,
): BotRixImportSummary {
  const unmapped = unmappedOf(rows);
  const fieldNames = new Set<string>();
  for (const entry of unmapped) for (const key of Object.keys(entry.fields)) fieldNames.add(key);
  const summary: BotRixImportSummary = {
    at: new Date().toISOString(),
    source,
    rows: rows.length + invalid,
    ...counts,
    withLevel: rows.filter((row) => row.level !== null).length,
    withWatch: rows.filter((row) => row.watchtime !== null || row.watchSeconds !== null).length,
    levelRaised: rows.filter((row) => row.level !== null && row.level < 1).length,
    unmappedFields: [...fieldNames].sort(),
    unmapped: unmapped.slice(0, MAX_UNMAPPED),
  };
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify(summary));
  } catch {
    /* quota: the import itself already succeeded */
  }
  window.dispatchEvent(new Event(BOTRIX_SUMMARY_EVENT));
  return summary;
}
