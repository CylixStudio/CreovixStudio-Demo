import { getDemoDb } from "@/demo/context";

import type { DefaultCommand } from "./defaultCommands";

export type DemoDefaultOverride = Partial<DefaultCommand> & { id: string };

// Overrides live in the demo database so they persist in the visitor's browser.
const TABLE = "demo_default_overrides";

export function demoDefaultWriteCount(): number {
  return getDemoDb().rows(TABLE).length;
}

export function resetDemoDefaultCommandStore(): void {
  const db = getDemoDb();
  for (const row of db.rows(TABLE)) db.remove(TABLE, row);
}

export function readDemoDefaultOverrides(userId: string): DemoDefaultOverride[] {
  return getDemoDb()
    .rows(TABLE)
    .filter((row) => row["user_id"] === userId)
    .map((row) => row["override"] as DemoDefaultOverride);
}

export function writeDemoDefaultEnabled(userId: string, id: string, enabled: boolean): DemoDefaultOverride {
  const db = getDemoDb();
  const rowId = `${userId}|${id}`;
  const previous = db.rows(TABLE).find((row) => row["id"] === rowId);
  const next: DemoDefaultOverride = {
    ...((previous?.["override"] as DemoDefaultOverride | undefined) ?? { id }),
    id,
    enabled,
    updatedAt: new Date().toISOString(),
  };
  db.put(TABLE, { id: rowId, user_id: userId, override: next, created_at: next.updatedAt }, previous);
  return next;
}

