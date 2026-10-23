import { getDemoDb } from "@/demo/context";
import { applyOverlay, createSeededDb, dbKeyFor, DEMO_DB_KEY, type DemoOverlay } from "@/demo/overlay";
import { demoUserHasActivePro } from "@/demo/subscription";
import { readActiveChannelId } from "@/features/channel-team/storage";
import { DEMO_USER_ID, isDemoBuild } from "@/lib/demoMode";
import { demoStorageKey } from "@/lib/demoStore";
import { assertWidgetLayoutAccess } from "@/lib/widgetLayoutAccess";

/** Preflight the complete import before deleting or writing any local data. */
export function assertDemoImportLayoutAccess(entries: Record<string, unknown>): void {
  if (!isDemoBuild() || typeof window === "undefined") throw new Error("Demo import is local only.");
  for (const [key, raw] of Object.entries(entries)) {
    if (typeof raw !== "string") continue;
    const legacy = key === demoStorageKey();
    const database = key === DEMO_DB_KEY || key.startsWith(`${DEMO_DB_KEY}:`);
    if (!legacy && !database) continue;
    const parsed = JSON.parse(raw);
    const widgets: unknown = legacy ? parsed?.widgets : parsed?.tables?.widgets;
    if (widgets === undefined) continue;
    if (!Array.isArray(widgets)) throw new Error("Invalid widget import.");

    const channelId = key === DEMO_DB_KEY ? "own" : key.slice(DEMO_DB_KEY.length + 1);
    const db = legacy || key === dbKeyFor(readActiveChannelId()) ? getDemoDb() : createSeededDb(channelId);
    if (!legacy && key !== dbKeyFor(readActiveChannelId())) {
      const stored = window.localStorage.getItem(key);
      if (stored) applyOverlay(db, JSON.parse(stored) as DemoOverlay);
    }
    for (const widget of widgets) {
      if (!widget || typeof widget !== "object" || typeof widget.type !== "string") {
        throw new Error("Invalid widget import.");
      }
      const userId = typeof widget.user_id === "string" ? widget.user_id : DEMO_USER_ID;
      // Imported subscription rows cannot grant access to this same import.
      assertWidgetLayoutAccess(widget.type, widget.config, demoUserHasActivePro(db, userId));
    }
  }
}
