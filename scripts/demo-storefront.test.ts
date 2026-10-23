import assert from "node:assert/strict";
import test from "node:test";

import { createSeededDb } from "../src/demo/overlay.ts";
import {
  redeemStoreSnapshot,
  safeStoreImage,
  storeViewers,
  StorefrontError,
  type RedemptionRequest,
} from "../src/lib/demoStorefront.ts";

const viewer = storeViewers()[0]!;
const request = (channelId = "own", index = 0): RedemptionRequest => {
  const reward = createSeededDb(channelId).rows("loyalty_shop_items")[index]!;
  return {
    channelId,
    viewerId: viewer.id,
    rewardId: String(reward["id"]),
    requestId: "redemption-1",
    expectedCost: Number(reward["cost"]),
  };
};
const throwsReason = (fn: () => unknown, reason: string) =>
  assert.throws(fn, (error) => error instanceof StorefrontError && error.reason === reason);

test("successful redemption updates only this viewer, finite stock and sales", () => {
  const snapshot = createSeededDb().snapshot();
  const before = structuredClone(snapshot);
  const req = request("own", 2);
  const next = redeemStoreSnapshot(snapshot, req, viewer);
  const balance = (state: typeof snapshot) =>
    state["loyalty_members"]!.find((row) => row["id"] === viewer.id)!["points"];
  assert.equal(Number(balance(next)), Number(balance(snapshot)) - req.expectedCost);
  assert.equal(next["loyalty_shop_items"]![2]!["stock"], 9);
  assert.equal(next["loyalty_sales"]!.length, snapshot["loyalty_sales"]!.length + 1);
  assert.equal(next["loyalty_sales"]![0]!["member_id"], viewer.id);
  assert.deepEqual(snapshot, before);
  assert.deepEqual(next["loyalty_members"]!.slice(1), snapshot["loyalty_members"]!.slice(1));
});

test("retrying the same request cannot charge twice, even after JSON reload", () => {
  const req = request();
  const next = redeemStoreSnapshot(createSeededDb().snapshot(), req, viewer);
  assert.equal(redeemStoreSnapshot(next, req, viewer), next);
  const restored = JSON.parse(JSON.stringify(next));
  assert.equal(redeemStoreSnapshot(restored, req, viewer), restored);
  assert.equal(next["loyalty_shop_items"]![0]!["stock"], null);
});

test("insufficient funds and sold-out/disabled rewards cannot mutate data", () => {
  const snapshot = createSeededDb().snapshot();
  const req = request();
  const broke = {
    ...snapshot,
    loyalty_members: snapshot["loyalty_members"]!.map((row) => ({ ...row, points: 0 })),
  };
  throwsReason(() => redeemStoreSnapshot(broke, req, viewer), "insufficient_points");
  const out = {
    ...snapshot,
    loyalty_shop_items: snapshot["loyalty_shop_items"]!.map((row) => ({ ...row, stock: 0 })),
  };
  throwsReason(() => redeemStoreSnapshot(out, req, viewer), "out_of_stock");
  for (const change of [{ enabled: false }, { is_active: false }]) {
    const disabled = {
      ...snapshot,
      loyalty_shop_items: snapshot["loyalty_shop_items"]!.map((row) => ({ ...row, ...change })),
    };
    throwsReason(() => redeemStoreSnapshot(disabled, req, viewer), "unavailable");
  }
  assert.equal(snapshot["demo_store_receipts"], undefined);
});

test("reward price changes require a fresh confirmation", () => {
  const snapshot = createSeededDb().snapshot();
  throwsReason(
    () => redeemStoreSnapshot(snapshot, { ...request(), expectedCost: 1 }, viewer),
    "unavailable",
  );
});

test("channel memberships and balances are isolated; visiting another channel cannot spend own points", () => {
  const own = createSeededDb().snapshot();
  const a = createSeededDb("streamer-a").snapshot();
  const b = createSeededDb("streamer-b").snapshot();
  const next = redeemStoreSnapshot(a, request("streamer-a"), viewer);
  assert.equal(next["loyalty_members"]!.find((row) => row["id"] === viewer.id)!["points"], 600);
  assert.ok(!a["loyalty_members"]!.some((row) => row["id"] === viewer.id));
  assert.ok(!b["loyalty_members"]!.some((row) => row["id"] === viewer.id));
  assert.equal(own["loyalty_members"]![0]!["points"], 12150);
  throwsReason(() => redeemStoreSnapshot(b, request("streamer-a"), viewer), "unavailable");
});

test("forged viewer or reused request ids fail closed", () => {
  const snapshot = createSeededDb().snapshot();
  const req = request();
  throwsReason(
    () => redeemStoreSnapshot(snapshot, { ...req, viewerId: "different" }, viewer),
    "invalid_request",
  );
  const next = redeemStoreSnapshot(snapshot, req, viewer);
  throwsReason(
    () => redeemStoreSnapshot(next, { ...req, rewardId: "different" }, viewer),
    "invalid_request",
  );
  throwsReason(
    () => redeemStoreSnapshot(snapshot, { ...req, channelId: "unknown" }, viewer),
    "invalid_request",
  );
});

test("custom image URLs allow local uploads and reject executable URL schemes", () => {
  assert.equal(safeStoreImage("javascript:alert(1)"), null);
  assert.equal(safeStoreImage("//external/image.png"), null);
  assert.equal(
    safeStoreImage("https://example.test/reward.png"),
    "https://example.test/reward.png",
  );
  assert.equal(safeStoreImage("/rewards/image.png"), "/rewards/image.png");
  assert.equal(safeStoreImage("data:image/png;base64,YQ=="), "data:image/png;base64,YQ==");
});
