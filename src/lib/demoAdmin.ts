import { z } from "zod";

export const DEMO_ADMIN_KEY = "cylixstudio-demo:admin:v1";

const codeSchema = z.object({
  id: z.string(),
  code: z.string().min(1).max(80),
  days: z.number().int().min(1).max(36500),
  active: z.boolean(),
  userId: z.string().nullable(),
  revoked: z.boolean(),
  notes: z.string().max(500),
  createdAt: z.string().datetime(),
  redeemedAt: z.string().datetime().nullable(),
});

export const demoAdminSchema = z.object({
  version: z.string().trim().min(1).max(40),
  lastBroadcast: z.string().datetime().nullable(),
  users: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      email: z.string().email(),
      earlyAccess: z.boolean(),
      admin: z.boolean(),
      plan: z.enum(["Free", "Pro"]),
    }),
  ),
  codes: z.array(codeSchema),
});

export type DemoAdminState = z.infer<typeof demoAdminSchema>;
export type DemoAdminCode = z.infer<typeof codeSchema>;
export type DemoCodeStatus = "available" | "disabled" | "redeemed" | "revoked";
export type DemoCodeFilter = DemoCodeStatus | "all";

export function createDemoAdminState(): DemoAdminState {
  return {
    version: "0.2.3",
    lastBroadcast: null,
    users: [
      {
        id: "demo-creator-nova",
        name: "Nova",
        email: "nova@example.test",
        earlyAccess: true,
        admin: false,
        plan: "Pro",
      },
      {
        id: "demo-creator-layan",
        name: "ليان",
        email: "layan@example.test",
        earlyAccess: false,
        admin: false,
        plan: "Free",
      },
      {
        id: "demo-creator-omar",
        name: "Omar",
        email: "omar@example.test",
        earlyAccess: false,
        admin: false,
        plan: "Pro",
      },
    ],
    codes: [
      {
        id: "demo-code-1",
        code: "DEMO2026NOVAFREE",
        days: 30,
        active: true,
        userId: null,
        revoked: false,
        notes: "Welcome campaign",
        createdAt: "2026-10-20T10:00:00.000Z",
        redeemedAt: null,
      },
      {
        id: "demo-code-2",
        code: "DEMO2026NOVAPRO1",
        days: 365,
        active: true,
        userId: "demo-creator-nova",
        revoked: false,
        notes: "Creator annual plan",
        createdAt: "2026-10-19T10:00:00.000Z",
        redeemedAt: "2026-10-20T12:00:00.000Z",
      },
      {
        id: "demo-code-3",
        code: "DEMO2026PAUSED01",
        days: 90,
        active: false,
        userId: null,
        revoked: false,
        notes: "",
        createdAt: "2026-10-18T10:00:00.000Z",
        redeemedAt: null,
      },
      {
        id: "demo-code-4",
        code: "DEMO2026REVOKED1",
        days: 60,
        active: false,
        userId: "demo-creator-layan",
        revoked: true,
        notes: "Cancelled campaign",
        createdAt: "2026-10-17T10:00:00.000Z",
        redeemedAt: "2026-10-18T12:00:00.000Z",
      },
      {
        id: "demo-code-5",
        code: "DEMO2026LIFETIME",
        days: 36500,
        active: true,
        userId: null,
        revoked: false,
        notes: "Lifetime preview",
        createdAt: "2026-10-16T10:00:00.000Z",
        redeemedAt: null,
      },
      {
        id: "demo-code-6",
        code: "DEMO2026OMARPRO1",
        days: 90,
        active: true,
        userId: "demo-creator-omar",
        revoked: false,
        notes: "",
        createdAt: "2026-10-15T10:00:00.000Z",
        redeemedAt: "2026-10-16T12:00:00.000Z",
      },
    ],
  };
}

export function demoCodeStatus(code: DemoAdminCode): DemoCodeStatus {
  if (code.revoked) return "revoked";
  if (code.userId) return "redeemed";
  return code.active ? "available" : "disabled";
}

export function filterDemoCodes(state: DemoAdminState, filter: DemoCodeFilter, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return state.codes.filter((code) => {
    if (filter !== "all" && demoCodeStatus(code) !== filter) return false;
    const user = state.users.find((row) => row.id === code.userId);
    return [code.code, code.notes, user?.name, user?.email].some((value) =>
      value?.toLocaleLowerCase().includes(query),
    );
  });
}

export function addDemoCode(
  state: DemoAdminState,
  days: number,
  notes: string,
  id: string,
  randomCode: string,
): DemoAdminState {
  const row = codeSchema.parse({
    id,
    code: `DEMO${randomCode
      .replace(/[^a-z0-9]/gi, "")
      .toUpperCase()
      .slice(0, 12)}`,
    days,
    notes: notes.trim(),
    active: true,
    userId: null,
    revoked: false,
    createdAt: new Date().toISOString(),
    redeemedAt: null,
  });
  if (state.codes.some((code) => code.code === row.code)) throw new Error("duplicate_code");
  return { ...state, codes: [row, ...state.codes] };
}

export function updateDemoCode(
  state: DemoAdminState,
  id: string,
  action: "toggle" | "delete" | "revoke",
): DemoAdminState {
  const row = state.codes.find((code) => code.id === id);
  if (!row) throw new Error("code_not_found");
  if (action === "toggle" && (row.userId || row.revoked)) throw new Error("code_not_available");
  if (action === "revoke" && (!row.userId || row.revoked)) throw new Error("code_not_redeemed");
  return {
    ...state,
    users:
      action === "revoke"
        ? state.users.map((user) =>
            user.id === row.userId ? { ...user, plan: "Free" as const } : user,
          )
        : state.users,
    codes:
      action === "delete"
        ? state.codes.filter((code) => code.id !== id)
        : state.codes.map((code) =>
            code.id !== id
              ? code
              : action === "toggle"
                ? { ...code, active: !code.active }
                : { ...code, revoked: true, active: false },
          ),
  };
}

export function editDemoCode(state: DemoAdminState, id: string, value: string, notes: string) {
  const row = state.codes.find((code) => code.id === id);
  if (!row) throw new Error("code_not_found");
  const code = row.userId ? row.code : value.trim();
  if (
    state.codes.some((other) => other.id !== id && other.code.toUpperCase() === code.toUpperCase())
  ) {
    throw new Error("duplicate_code");
  }
  const updated = codeSchema.parse({ ...row, code, notes: notes.trim() });
  return { ...state, codes: state.codes.map((entry) => (entry.id === id ? updated : entry)) };
}

export function setDemoEarlyAccess(state: DemoAdminState, id: string, enabled: boolean) {
  if (!state.users.some((user) => user.id === id)) throw new Error("user_not_found");
  return {
    ...state,
    users: state.users.map((user) => (user.id === id ? { ...user, earlyAccess: enabled } : user)),
  };
}

export function demoCodesCsv(state: DemoAdminState): string {
  const escape = (value: string) => {
    const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [
    "code,duration_days,notes,created_at",
    ...state.codes
      .filter((code) => demoCodeStatus(code) === "available")
      .map((code) =>
        [code.code, String(code.days), code.notes, code.createdAt].map(escape).join(","),
      ),
  ].join("\r\n");
}
