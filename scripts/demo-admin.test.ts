import assert from "node:assert/strict";
import test from "node:test";

import {
  addDemoCode,
  createDemoAdminState,
  demoAdminSchema,
  demoCodesCsv,
  demoCodeStatus,
  editDemoCode,
  filterDemoCodes,
  setDemoEarlyAccess,
  updateDemoCode,
} from "../src/lib/demoAdmin.ts";

test("fixtures use fictional accounts and cover every real code state", () => {
  const state = demoAdminSchema.parse(createDemoAdminState());
  assert.ok(state.users.every((user) => user.email.endsWith("@example.test") && !user.admin));
  assert.deepEqual(
    new Set(state.codes.map(demoCodeStatus)),
    new Set(["available", "disabled", "redeemed", "revoked"]),
  );
});

test("filters distinguish disabled from available and search user, notes and code", () => {
  const state = createDemoAdminState();
  for (const filter of ["available", "disabled", "redeemed", "revoked"] as const) {
    assert.ok(filterDemoCodes(state, filter, "").every((row) => demoCodeStatus(row) === filter));
  }
  assert.equal(filterDemoCodes(state, "available", "").length, 2);
  assert.equal(filterDemoCodes(state, "disabled", "").length, 1);
  assert.equal(filterDemoCodes(state, "all", "NOVA@EXAMPLE.TEST").length, 1);
  assert.equal(filterDemoCodes(state, "all", " Welcome campaign ").length, 1);
  assert.equal(filterDemoCodes(state, "all", "not-a-code").length, 0);
});

test("generation validates duration boundaries and persists in JSON without mutating fixtures", () => {
  const state = createDemoAdminState();
  for (const days of [1, 30, 36500]) {
    const next = addDemoCode(state, days, " test ", "new-id", "123456789abc");
    assert.equal(next.codes[0]?.days, days);
    assert.equal(next.codes[0]?.notes, "test");
    assert.equal(next.codes[0]?.code, "DEMO123456789ABC");
    assert.deepEqual(demoAdminSchema.parse(JSON.parse(JSON.stringify(next))), next);
  }
  for (const days of [0, 36501, 1.5, NaN]) {
    assert.throws(() => addDemoCode(state, days, "", "id", "abcd"));
  }
  assert.equal(state.codes.length, 6);
});

test("editing preserves used codes and rejects empty or duplicate codes", () => {
  const state = createDemoAdminState();
  assert.equal(
    editDemoCode(state, "demo-code-2", "REPLACED", "new note").codes[1]?.code,
    state.codes[1]?.code,
  );
  assert.equal(editDemoCode(state, "demo-code-1", "CUSTOM", "edited").codes[0]?.notes, "edited");
  assert.throws(() => editDemoCode(state, "demo-code-1", "", ""));
  assert.throws(() => editDemoCode(state, "demo-code-1", "demo2026novapro1", ""), /duplicate_code/);
});

test("disable and enable only affect unused codes", () => {
  const state = createDemoAdminState();
  const disabled = updateDemoCode(state, "demo-code-1", "toggle");
  assert.equal(demoCodeStatus(disabled.codes[0]!), "disabled");
  assert.equal(
    demoCodeStatus(updateDemoCode(disabled, "demo-code-1", "toggle").codes[0]!),
    "available",
  );
  assert.throws(() => updateDemoCode(state, "demo-code-2", "toggle"));
  assert.throws(() => updateDemoCode(state, "demo-code-4", "toggle"));
});

test("revoke downgrades only the linked demo user; deletion does not revoke a plan", () => {
  const state = createDemoAdminState();
  const next = updateDemoCode(state, "demo-code-2", "revoke");
  assert.equal(next.users[0]?.plan, "Free");
  assert.equal(next.users[2]?.plan, "Pro");
  assert.equal(next.users[0]?.earlyAccess, true);
  assert.equal(demoCodeStatus(next.codes[1]!), "revoked");
  assert.equal(updateDemoCode(state, "demo-code-2", "delete").users[0]?.plan, "Pro");
  assert.equal(updateDemoCode(state, "demo-code-1", "delete").codes.length, 5);
  assert.throws(() => updateDemoCode(state, "demo-code-1", "revoke"));
  assert.throws(() => updateDemoCode(next, "demo-code-2", "revoke"));
});

test("Early Access grant/revoke never changes admin flags, subscriptions or other users", () => {
  const state = createDemoAdminState();
  const next = setDemoEarlyAccess(state, "demo-creator-layan", true);
  assert.equal(next.users[1]?.earlyAccess, true);
  assert.equal(next.users[1]?.admin, false);
  assert.equal(next.users[1]?.plan, "Free");
  assert.deepEqual(next.codes, state.codes);
  assert.equal(setDemoEarlyAccess(next, "demo-creator-layan", false).users[1]?.earlyAccess, false);
  assert.throws(() => setDemoEarlyAccess(state, "missing", true));
});

test("CSV exports available codes only, including quoted notes", () => {
  const state = addDemoCode(createDemoAdminState(), 7, 'A "quoted", note', "new", "123456789abc");
  const csv = demoCodesCsv(state);
  assert.equal(csv.split("\r\n").length, 4);
  assert.ok(csv.includes('"A ""quoted"", note"'));
  assert.ok(!csv.includes("DEMO2026NOVAPRO1"));
  assert.ok(!csv.includes("DEMO2026PAUSED01"));
  assert.ok(!csv.includes("DEMO2026REVOKED1"));
  const formula = addDemoCode(createDemoAdminState(), 7, "=1+1", "formula", "123456789abc");
  assert.ok(demoCodesCsv(formula).includes('"\'=1+1"'));
});

test("invalid saved state is rejected rather than silently replaced", () => {
  assert.equal(demoAdminSchema.safeParse({ version: "1.0" }).success, false);
  assert.equal(
    demoAdminSchema.safeParse({ ...createDemoAdminState(), version: "" }).success,
    false,
  );
  assert.equal(createDemoAdminState().lastBroadcast, null);
});
