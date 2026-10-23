import assert from "node:assert/strict";
import test from "node:test";
import {
  GIVEAWAY_ANIMATIONS,
  giveawayAccountKey,
  giveawayRevealCandidates,
  giveawayRevealProgress,
  giveawayRevealSlot,
  parseGiveawayPresentation,
  parseGiveawayAppearance,
} from "../src/lib/giveawayPresentation.ts";
import { confirmGiveawayPresence, readGiveawayDraw } from "../src/lib/giveaway.server.ts";
import { DemoDb } from "../src/demo/db.ts";
import { buildDemoSnapshot } from "../src/demo/fixtures.ts";
import { setDemoDbProvider } from "../src/demo/context.ts";
import { createDemoSupabase } from "../src/lib/demoSupabase.ts";
import { DEMO_USER_ID } from "../src/lib/demoMode.ts";

test("only Avatar Carousel remains; removed and unknown animations migrate safely", () => {
  assert.deepEqual(
    GIVEAWAY_ANIMATIONS.map(({ id }) => id),
    ["carousel"],
  );
  for (const animation of GIVEAWAY_ANIMATIONS) {
    assert.ok(animation.ar && animation.en);
    assert.equal(parseGiveawayPresentation({ animation: animation.id }).animation, animation.id);
  }
  for (const animation of [
    "roulette",
    "spotlight",
    "shuffle",
    "elimination",
    "minimal",
    "unknown",
    null,
  ]) {
    assert.equal(parseGiveawayPresentation({ animation }).animation, "carousel");
  }
  for (const speed of [NaN, Infinity, undefined, "fast"]) {
    assert.equal(parseGiveawayPresentation({ speed }).speed, 1);
  }
  assert.equal(parseGiveawayPresentation({ speed: 100 }).speed, 2);
  assert.equal(parseGiveawayPresentation({ speed: -3 }).speed, 0.5);
});

test("Display settings use shared widget validation and survive presentation serialization", () => {
  const appearance = parseGiveawayAppearance({
    fontFamily: "Inter, sans-serif",
    fontSize: 48,
    textColor: "#e2e8f0",
    accentColor: "#b6d9f4",
    backgroundColor: "#111318",
    backgroundOpacity: 80,
  });
  const presentation = { animation: "carousel", speed: 1.5, appearance };
  assert.deepEqual(
    parseGiveawayPresentation(JSON.parse(JSON.stringify(presentation))),
    presentation,
  );
  assert.equal(parseGiveawayAppearance(null).fontSize, 56);
  assert.equal(parseGiveawayAppearance({ fontSize: 999 }).fontSize, 80);
  assert.equal(parseGiveawayAppearance({ fontSize: 0 }).fontSize, 24);
  assert.equal(parseGiveawayAppearance({ backgroundOpacity: 999 }).backgroundOpacity, 100);
  assert.equal(
    parseGiveawayAppearance({ accentColor: "url(javascript:test)" }).accentColor,
    "#bee1fc",
  );
  assert.equal(parseGiveawayPresentation(null).appearance, undefined);
});

test("absolute reveal time resumes rather than redrawing or restarting after reload", () => {
  const start = "2026-10-23T12:00:00.000Z";
  const at = Date.parse(start);
  assert.equal(giveawayRevealProgress(start, 8, at - 1000), 0);
  assert.equal(giveawayRevealProgress(start, 8, at + 4000), 0.5);
  assert.equal(giveawayRevealProgress(start, 8, at + 8000), 1);
  assert.equal(giveawayRevealProgress(start, 8, at + 500000), 1);
  for (const invalid of [null, undefined, "", "invalid"]) {
    assert.equal(giveawayRevealProgress(invalid, 8, at), 1);
  }
  assert.equal(giveawayRevealProgress(start, NaN, at), 1);
});

test("rolling strips move forward and decelerate onto the already selected account", () => {
  for (const speed of [0.5, 1, 1.5, 2]) {
    for (const count of [1, 8, 12]) {
      for (let selected = 0; selected < count; selected++) {
        let previous = -1;
        let previousStep = Infinity;
        for (let frame = 0; frame <= 100; frame++) {
          const slot = giveawayRevealSlot(count, selected, frame / 100, speed);
          assert.ok(slot >= previous);
          if (frame > 0) {
            const step = slot - previous;
            assert.ok(step <= previousStep + 1e-10, "Continuous motion decelerates each frame");
            previousStep = step;
          }
          previous = slot;
        }
        assert.equal(previous % count, selected);
      }
    }
  }
  assert.ok(
    !Number.isInteger(giveawayRevealSlot(8, 3, 0.231, 1)),
    "Motion is not snapped to whole names",
  );
});

test("presentation includes the selected winner outside the preview cap without selecting a winner", () => {
  const participants = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    username: `Player${index}`,
    platform: "KICK",
  }));
  const winner = { id: "29", username: "Player29", platform: "KICK" };
  const before = structuredClone(participants);
  const originalRandom = Math.random;
  Math.random = () => {
    throw new Error("Presentation must not draw a winner");
  };
  try {
    const result = giveawayRevealCandidates(participants, winner);
    assert.equal(result.length, 12);
    assert.equal(result.at(-1)?.username, winner.username);
    assert.deepEqual(result, giveawayRevealCandidates(participants, winner));
    assert.deepEqual(participants, before);
    const crossPlatform = giveawayRevealCandidates(
      [
        { id: "kick", platform: "KICK", username: "SameName" },
        { id: "twitch", platform: "TWITCH", username: "SameName" },
      ],
      { id: "twitch", platform: "TWITCH", username: "SameName" },
    );
    assert.equal(crossPlatform.length, 2);
    assert.notEqual(giveawayAccountKey(crossPlatform[0]!), giveawayAccountKey(crossPlatform[1]!));
  } finally {
    Math.random = originalRandom;
  }
});

test("legacy layouts and completed winner/claim data survive presentation parsing", () => {
  const draw = {
    phase: "settled",
    overlayLayout: "ribbon",
    winner: { username: "ActualWinner", platform: "TWITCH" },
    claimState: "confirmed",
    confirmed_at: "2026-10-23T12:01:00.000Z",
    presentation: { animation: "carousel", speed: 1.5 },
    revealStartedAt: "2026-10-23T12:00:00.000Z",
    revealDuration: 8,
  };
  const parsed = readGiveawayDraw(draw);
  assert.deepEqual(parsed.presentation, draw.presentation);
  assert.deepEqual(parsed.winner, draw.winner);
  assert.equal(parsed.overlayLayout, draw.overlayLayout);
  assert.equal(parsed.confirmed_at, draw.confirmed_at);
  assert.equal(parsed.revealDuration, 8);
  assert.equal(readGiveawayDraw({ revealDuration: NaN }).revealDuration, 5);
  assert.equal(readGiveawayDraw({ revealDuration: Infinity }).revealDuration, 5);
  for (const animation of ["roulette", "spotlight", "shuffle", "elimination", "minimal"]) {
    const migrated = readGiveawayDraw({
      ...draw,
      presentation: { ...draw.presentation, animation },
    });
    assert.deepEqual(migrated, {
      ...parsed,
      presentation: { ...parsed.presentation, animation: "carousel" },
    });
  }
});

test("a preselected winner cannot claim before reveal; legacy and completed draws keep claim validation", async () => {
  const db = new DemoDb(buildDemoSnapshot());
  setDemoDbProvider(() => db);
  const draw = {
    phase: "settled",
    winner: { username: "SelectedWinner", platform: "KICK" },
    pending_winner: { username: "SelectedWinner", platform: "KICK", at: new Date().toISOString() },
    keyword: "!join",
    revealStartedAt: new Date().toISOString(),
    revealDuration: 8,
    claimUntil: new Date(Date.now() + 68000).toISOString(),
    claimState: "pending",
  };
  try {
    await db.from("giveaway_settings").update({ draw_state: draw }).eq("user_id", DEMO_USER_ID);
    const before = JSON.stringify(db.rows("giveaway_settings"));
    const client = createDemoSupabase();
    assert.deepEqual(
      await confirmGiveawayPresence(client, DEMO_USER_ID, {
        username: "SelectedWinner",
        text: "!join",
      }),
      { status: "ignored", reason: "revealing" },
    );
    assert.equal(JSON.stringify(db.rows("giveaway_settings")), before);
    for (const revealStartedAt of [null, new Date(Date.now() - 20000).toISOString()]) {
      await db
        .from("giveaway_settings")
        .update({ draw_state: { ...draw, revealStartedAt } })
        .eq("user_id", DEMO_USER_ID);
      assert.deepEqual(
        await confirmGiveawayPresence(client, DEMO_USER_ID, {
          username: "SelectedWinner",
          text: "wrong keyword",
        }),
        { status: "ignored", reason: "keyword_mismatch" },
      );
    }
  } finally {
    setDemoDbProvider(() => undefined);
  }
});
