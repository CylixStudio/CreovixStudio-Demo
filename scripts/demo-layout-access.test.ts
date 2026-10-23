import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import { DemoDb } from "../src/demo/db.ts";
import { getClientDb, reloadClientDb } from "../src/demo/context.ts";
import { buildDemoSnapshot } from "../src/demo/fixtures.ts";
import { DEMO_CHANGE_EVENT, readStoredOverlay } from "../src/demo/overlay.ts";
import { demoUserHasActivePro } from "../src/demo/subscription.ts";
import { DEMO_USER_ID } from "../src/lib/demoMode.ts";
import { setDemoSubscriptionPlan } from "../src/lib/demoSubscription.ts";
import { assertDemoImportLayoutAccess } from "../src/lib/demoLayoutImport.ts";
import {
  insertDemoWidget,
  loadDemoState,
  resetDemoState,
  saveDemoWidget,
  updateDemoState,
} from "../src/lib/demoStore.ts";

const values = new Map<string, string>();
const browser = Object.assign(new EventTarget(), {
  localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  },
});
Object.defineProperty(globalThis, "window", { configurable: true, value: browser });

beforeEach(() => {
  values.clear();
  delete (globalThis as { __demoClientDb?: DemoDb }).__demoClientDb;
  resetDemoState();
});

function importedWidget(id = crypto.randomUUID(), layout = "digital") {
  return {
    id,
    user_id: DEMO_USER_ID,
    type: "VIEWER_COUNTER",
    name: "Imported counter",
    config: { layout },
    public_token: `demo-${id}`,
    state: {},
    subathon_id: null,
    is_enabled: true,
    created_at: new Date().toISOString(),
  };
}

test("the existing Pro fixture is authoritative; local Free/Pro persists and announces changes", async () => {
  const db = getClientDb();
  assert.equal(demoUserHasActivePro(db, DEMO_USER_ID), true);
  let changes = 0;
  const onChange = () => { changes += 1; };
  browser.addEventListener(DEMO_CHANGE_EVENT, onChange);
  try {
    await setDemoSubscriptionPlan(DEMO_USER_ID, "free");
    assert.equal(demoUserHasActivePro(db, DEMO_USER_ID), false);
    assert.equal(readStoredOverlay().tables["user_subscriptions"]?.[0]?.["subscription_status"], "inactive");
    delete (globalThis as { __demoClientDb?: DemoDb }).__demoClientDb;
    const restored = getClientDb();
    assert.equal(demoUserHasActivePro(restored, DEMO_USER_ID), false);
    await setDemoSubscriptionPlan(DEMO_USER_ID, "pro");
    reloadClientDb();
    assert.equal(demoUserHasActivePro(restored, DEMO_USER_ID), true);
    assert.ok(changes >= 3);
    await assert.rejects(setDemoSubscriptionPlan("not-the-demo-user", "pro"), /local Demo account/);
  } finally {
    browser.removeEventListener(DEMO_CHANGE_EVENT, onChange);
  }
});

test("DemoDb rejects locked insert, update and upsert/import atomically for Free; Pro saves persist", async () => {
  const db = new DemoDb(buildDemoSnapshot());
  const row = importedWidget();
  assert.equal((await db.from("widgets").insert(row)).error, null);
  await db.from("user_subscriptions").update({ subscription_status: "inactive" }).eq("user_id", DEMO_USER_ID);
  const stored = JSON.stringify(db.rows("widgets"));
  for (const query of [
    db.from("widgets").insert(importedWidget()),
    db.from("widgets").update({ config: row.config }).eq("id", row.id),
    db.from("widgets").upsert(row),
    db.from("widgets").insert([importedWidget(crypto.randomUUID(), "classic"), importedWidget()]),
  ]) {
    assert.match((await query).error?.message ?? "", /requires Pro/i);
    assert.equal(JSON.stringify(db.rows("widgets")), stored);
  }
  assert.throws(() => db.put("widgets", importedWidget()), /requires Pro/i);
  assert.equal((await db.from("widgets").update({ state: { viewers: 42 } }).eq("id", row.id)).error, null);
  assert.equal((await db.from("widgets").upsert({ id: row.id, user_id: DEMO_USER_ID, name: "Renamed" })).error, null);
  assert.equal((db.rows("widgets").find((item) => item["id"] === row.id)?.["config"] as { layout: string }).layout, "digital");
  await db.from("user_subscriptions").update({ subscription_status: "active" }).eq("user_id", DEMO_USER_ID);
  assert.equal((await db.from("widgets").update({ config: { layout: "bar" } }).eq("id", row.id)).error, null);
  const restored = new DemoDb(JSON.parse(JSON.stringify(db.snapshot())));
  assert.equal((restored.rows("widgets").find((item) => item["id"] === row.id)?.["config"] as { layout: string }).layout, "bar");
});

test("legacy Demo store preserves saved layouts but rejects new saves and JSON imports on Free", async () => {
  const created = await insertDemoWidget({
    userId: DEMO_USER_ID,
    type: "CHAT_SPOTLIGHT",
    name: "Saved Pro spotlight",
    subathonId: null,
    config: { layout: "message" },
  });
  await setDemoSubscriptionPlan(DEMO_USER_ID, "free");
  const before = await loadDemoState();
  assert.equal(before.widgets.find((widget) => widget.id === created.id)?.config["layout"], "message");
  await assert.rejects(saveDemoWidget({
    widgetId: created.id, name: "Blocked", config: { layout: "message" },
  }), /requires Pro/i);
  await assert.rejects(insertDemoWidget({
    userId: DEMO_USER_ID, type: "CHAT_SPOTLIGHT", name: "Blocked",
    subathonId: null, config: { layout: "message" },
  }), /requires Pro/i);
  const imported = JSON.parse(JSON.stringify(importedWidget()));
  assert.throws(() => updateDemoState((state) => ({ ...state, widgets: [...state.widgets, imported] })), /requires Pro/i);
  assert.throws(() => updateDemoState((state) => {
    const widget = state.widgets.find((item) => item.id === created.id)!;
    widget.config["layout"] = "message";
    widget.config["accent"] = "#ffffff";
    return state;
  }), /requires Pro/i);
  assert.deepEqual(await loadDemoState(), before);
  const freeCreated = await insertDemoWidget({
    userId: DEMO_USER_ID, type: "CHAT_SPOTLIGHT", name: "Free spotlight",
    subathonId: null, config: { layout: "classic" },
  });
  assert.ok(freeCreated.id);
  await saveDemoWidget({ widgetId: created.id, name: "Free layout", config: { layout: "classic" } });
  assert.equal((await loadDemoState()).widgets.find((widget) => widget.id === created.id)?.config["layout"], "classic");
  await setDemoSubscriptionPlan(DEMO_USER_ID, "pro");
  await saveDemoWidget({ widgetId: created.id, name: "Pro again", config: { layout: "message" } });
  await updateDemoState((state) => ({ ...state, widgets: [...state.widgets, imported] }));
  assert.equal((await loadDemoState()).widgets.find((widget) => widget.id === imported.id)?.config["layout"], "digital");
});

test("missing, expired and malformed subscriptions never unlock Pro layouts", () => {
  for (const subscription of [
    undefined,
    { subscription_status: "active", is_lifetime: false, expires_at: "2000-01-01" },
    { subscription_status: "active", is_lifetime: false, expires_at: "invalid" },
    { subscription_status: "inactive", is_lifetime: true },
  ]) {
    const snapshot = buildDemoSnapshot();
    snapshot["user_subscriptions"] = subscription ? [{ user_id: DEMO_USER_ID, ...subscription }] : [];
    assert.equal(demoUserHasActivePro(new DemoDb(snapshot), DEMO_USER_ID), false);
  }
});

test("whole-Demo JSON imports use the current subscription before any storage replacement", async () => {
  const db = getClientDb();
  const proSnapshot = db.snapshot();
  proSnapshot["widgets"] = [importedWidget()];
  const entries = {
    "cylixstudio-demo:db:v1": JSON.stringify({ v: 1, tables: proSnapshot }),
    "cylixstudio-demo:v1": JSON.stringify({ widgets: [importedWidget()], goals: [], frames: {}, messages: {} }),
  };
  await setDemoSubscriptionPlan(DEMO_USER_ID, "free");
  const before = [...values.entries()];
  assert.throws(() => assertDemoImportLayoutAccess(entries), /requires Pro/i);
  assert.deepEqual([...values.entries()], before);
  assert.equal(demoUserHasActivePro(db, DEMO_USER_ID), false);
  assert.throws(() => assertDemoImportLayoutAccess({
    "cylixstudio-demo:v1": entries["cylixstudio-demo:v1"],
  }), /requires Pro/i);
  assert.doesNotThrow(() => assertDemoImportLayoutAccess({
    "cylixstudio-demo:v1": JSON.stringify({ widgets: [importedWidget(crypto.randomUUID(), "classic")] }),
  }));
  await setDemoSubscriptionPlan(DEMO_USER_ID, "pro");
  assert.doesNotThrow(() => assertDemoImportLayoutAccess(entries));
});
