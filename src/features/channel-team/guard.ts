import type { DemoDb } from "@/demo/db";

import { denialMessage, evaluateWrite } from "./dbPolicy";
import { hasKey } from "./resolver";
import type { ActorContext, AuditEntry, PermissionKey } from "./types";

/** What the guard reports back. Collected per request on the demo server, applied directly in the browser. */
export type GuardReport = {
  audit: Array<Pick<AuditEntry, "channelId" | "actorId" | "action" | "section" | "target">>;
  denied: Array<{ key: PermissionKey | "owner" }>;
};

export const DENIED_EVENT = "cylixstudio-demo:denied";

export function emptyReport(): GuardReport {
  return { audit: [], denied: [] };
}

export type ReportSink = {
  audit(entry: GuardReport["audit"][number]): void;
  denied(key: PermissionKey | "owner"): void;
};

/** Attaches Channel Team write rules to a demo database for the given acting identity. */
export function installGuard(db: DemoDb, actor: () => ActorContext | null, sink: ReportSink): void {
  db.actorProvider = actor;
  db.writeGuard = (op) => {
    const ctx = actor();
    if (!ctx || ctx.owner) return null;
    const verdict = evaluateWrite(ctx, op);
    if (!verdict.allowed) {
      sink.denied(verdict.key);
      return verdict.message;
    }
    if (verdict.audit) {
      sink.audit({
        channelId: ctx.channelId,
        actorId: ctx.actorId,
        action: verdict.audit.action,
        section: verdict.audit.section,
        target: verdict.audit.target,
      });
    }
    return null;
  };
}

/** Throws when the acting identity lacks the permission. Used by demo functions that bypass the database. */
export function requireKey(db: DemoDb, key: PermissionKey, sink?: ReportSink): void {
  const ctx = db.actorProvider?.();
  if (!ctx || hasKey(ctx, key)) return;
  sink?.denied(key);
  throw new Error(denialMessage(key));
}

/** Runs trusted platform work (ingesting a simulated event) after the caller's permission was checked. */
export async function withoutWriteGuard<T>(db: DemoDb, run: () => Promise<T>): Promise<T> {
  const previous = db.writeGuard;
  db.writeGuard = null;
  try {
    return await run();
  } finally {
    db.writeGuard = previous;
  }
}
