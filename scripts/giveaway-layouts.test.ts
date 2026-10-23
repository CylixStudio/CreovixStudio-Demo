import assert from "node:assert/strict";
import test from "node:test";

import { DemoDb } from "../src/demo/db.ts";
import { buildDemoSnapshot } from "../src/demo/fixtures.ts";
import { DEMO_USER_ID } from "../src/lib/demoMode.ts";
import { GIVEAWAY_LAYOUTS, normalizeGiveawayLayout } from "../src/lib/giveawayLayouts.ts";
import { readGiveawayDraw } from "../src/lib/giveaway.server.ts";
import { isProWidgetLayout } from "../src/lib/widgetLayoutAccess.ts";

test("Giveaway has exactly eight stable IDs with two Free and six Pro layouts", () => {
  assert.deepEqual(
    GIVEAWAY_LAYOUTS.map(({ value }) => value),
    ["glass", "direct", "bold", "spotlight", "podium", "ticket", "split", "ribbon"],
  );
  assert.equal(
    GIVEAWAY_LAYOUTS.filter(({ value }) => !isProWidgetLayout("GIVEAWAY", { layout: value }))
      .length,
    2,
  );
  for (const { value } of GIVEAWAY_LAYOUTS) assert.equal(normalizeGiveawayLayout(value), value);
  for (const invalid of [null, undefined, "", "unknown", {}, 42]) {
    assert.equal(normalizeGiveawayLayout(invalid), "glass");
  }
});

test("draw parsing preserves every layout and the actual winner, claim, and confirmation state", () => {
  for (const { value: overlayLayout } of GIVEAWAY_LAYOUTS) {
    const saved = {
      phase: "settled",
      winner: { username: "ليان_123", platform: "KICK" },
      claimState: "pending",
      claimUntil: "2026-10-23T12:00:00.000Z",
      keyword: "+1",
      pending_winner: { username: "ليان_123", platform: "KICK", at: "2026-10-23T11:58:00.000Z" },
      confirmed_at: null,
      confirm_nonce: null,
      overlayLayout,
    };
    assert.deepEqual(readGiveawayDraw(saved), {
      ...saved,
      presentation: { animation: "carousel", speed: 1 },
      revealStartedAt: null,
      revealDuration: 5,
    });
    assert.equal(
      readGiveawayDraw({ ...saved, claimState: "confirmed", confirmed_at: "confirmed" }).claimState,
      "confirmed",
    );
    assert.equal(readGiveawayDraw({ ...saved, claimState: "expired" }).claimState, "expired");
  }
  assert.equal(readGiveawayDraw(null).overlayLayout, "glass");
  assert.equal(readGiveawayDraw({ overlayLayout: "retired" }).overlayLayout, "glass");
});

test("Demo persistence rejects premium Giveaway insert/update/upsert bypasses on Free", async () => {
  const db = new DemoDb(buildDemoSnapshot());
  await db
    .from("user_subscriptions")
    .update({ subscription_status: "inactive" })
    .eq("user_id", DEMO_USER_ID);
  for (const { value: overlayLayout } of GIVEAWAY_LAYOUTS) {
    const result = await db
      .from("giveaway_settings")
      .update({ draw_state: { overlayLayout } })
      .eq("user_id", DEMO_USER_ID);
    if (isProWidgetLayout("GIVEAWAY", { layout: overlayLayout })) {
      assert.match(result.error?.message ?? "", /requires Pro/i);
    } else {
      assert.equal(result.error, null);
    }
  }
  const before = JSON.stringify(db.rows("giveaway_settings"));
  const row = { user_id: DEMO_USER_ID, draw_state: { overlayLayout: "ribbon" } };
  assert.match(
    (await db.from("giveaway_settings").upsert(row)).error?.message ?? "",
    /requires Pro/i,
  );
  assert.throws(() => db.put("giveaway_settings", row), /requires Pro/i);
  await db.from("giveaway_settings").delete().eq("user_id", DEMO_USER_ID);
  assert.match(
    (await db.from("giveaway_settings").insert(row)).error?.message ?? "",
    /requires Pro/i,
  );
  assert.equal(db.rows("giveaway_settings").length, 0);
  assert.notEqual(before, "[]");
});

test("Pro layouts persist through reload and downgrade without changing draw or claim data", async () => {
  const db = new DemoDb(buildDemoSnapshot());
  for (const { value: overlayLayout } of GIVEAWAY_LAYOUTS) {
    const draw = {
      overlayLayout,
      phase: "settled",
      winner: { username: "ActualWinner", platform: "TWITCH" },
      claimState: "confirmed",
    };
    assert.equal(
      (await db.from("giveaway_settings").update({ draw_state: draw }).eq("user_id", DEMO_USER_ID))
        .error,
      null,
    );
    const restored = new DemoDb(JSON.parse(JSON.stringify(db.snapshot())));
    assert.deepEqual(restored.rows("giveaway_settings")[0]?.["draw_state"], draw);
  }
  await db
    .from("user_subscriptions")
    .update({ subscription_status: "inactive" })
    .eq("user_id", DEMO_USER_ID);
  const savedDraw = db.rows("giveaway_settings")[0]?.["draw_state"];
  assert.equal(
    (await db.from("giveaway_settings").update({ keyword: "+2" }).eq("user_id", DEMO_USER_ID))
      .error,
    null,
  );
  assert.deepEqual(db.rows("giveaway_settings")[0]?.["draw_state"], savedDraw);
  assert.equal(
    (
      await db
        .from("giveaway_settings")
        .update({ draw_state: { ...(savedDraw as object), claimState: "expired" } })
        .eq("user_id", DEMO_USER_ID)
    ).error,
    null,
  );
});
