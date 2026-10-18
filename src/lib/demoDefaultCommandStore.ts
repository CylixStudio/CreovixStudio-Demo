import type { DefaultCommand } from "./defaultCommands";

export type DemoDefaultOverride = Partial<DefaultCommand> & { id: string };

const byUser = new Map<string, Map<string, DemoDefaultOverride>>();
let writeCount = 0;

export function demoDefaultWriteCount(): number {
  return writeCount;
}

export function resetDemoDefaultCommandStore(): void {
  byUser.clear();
  writeCount = 0;
}

export function readDemoDefaultOverrides(userId: string): DemoDefaultOverride[] {
  return [...(byUser.get(userId)?.values() ?? [])];
}

export function writeDemoDefaultEnabled(userId: string, id: string, enabled: boolean): DemoDefaultOverride {
  writeCount += 1;
  const user = byUser.get(userId) ?? new Map<string, DemoDefaultOverride>();
  const next: DemoDefaultOverride = {
    ...(user.get(id) ?? { id }),
    id,
    enabled,
    updatedAt: new Date().toISOString(),
  };
  user.set(id, next);
  byUser.set(userId, user);
  return next;
}
