import assert from "node:assert/strict";
import test from "node:test";

import {
  GOAL_LAYOUTS,
  WHEEL_LAYOUTS,
  VIEWER_LAYOUTS,
  EVENT_LABEL_LAYOUTS,
  CHROME_LAYOUTS,
  POLL_LAYOUTS,
  PREDICTION_LAYOUTS,
  SCHEDULE_LAYOUTS,
  widgetLayoutLabel,
  parseGoalLayout,
  parseWheelLayout,
  parseViewerLayout,
  parseEventLabelLayout,
} from "../src/lib/widgetLayouts.ts";
import { assertWidgetLayoutAccess, isProWidgetLayout } from "../src/lib/widgetLayoutAccess.ts";
import { widgetTestGroups } from "../src/lib/widgetTestCapabilities.ts";
import { formatOverlayTime, parseOverlayTheme } from "../src/lib/overlayTheme.ts";
import { parseSpinConfig, pickWeightedPrize } from "../src/lib/widgets.ts";

test("every reviewed widget offers exactly eight distinct layouts, two Free and six Pro", () => {
  for (const [type, layouts] of [
    ["FOLLOWER_GOAL", GOAL_LAYOUTS],
    ["SUBSCRIBER_GOAL", GOAL_LAYOUTS],
    ["DONATION_GOAL", GOAL_LAYOUTS],
    ["KICKS_GOAL", GOAL_LAYOUTS],
    ["VIEWER_COUNTER", VIEWER_LAYOUTS],
    ["SPIN_WHEEL", WHEEL_LAYOUTS],
    ["EVENT_LABELS", EVENT_LABEL_LAYOUTS],
    ["POLL", POLL_LAYOUTS],
    ["PREDICTION", PREDICTION_LAYOUTS],
    ["STREAM_EVENTS_SCHEDULE", SCHEDULE_LAYOUTS],
    ["CHAT_SPOTLIGHT", CHROME_LAYOUTS],
    [
      "SUBATHON_TIMER",
      [
        "raw_digits",
        "island",
        "cute_heart",
        "broadcast",
        "split_clock",
        "circular_pomodoro",
        "multi_ring_countdown",
        "tower",
      ],
    ],
    ["GIVEAWAY", ["glass", "direct", "bold", "spotlight", "podium", "ticket", "split", "ribbon"]],
  ] as const) {
    assert.equal(layouts.length, 8, type);
    assert.equal(new Set(layouts).size, 8, type);
    assert.equal(layouts.filter((layout) => isProWidgetLayout(type, { layout })).length, 6, type);
    assert.equal(layouts.filter((layout) => !isProWidgetLayout(type, { layout })).length, 2, type);
    for (const layout of layouts) {
      assert.doesNotThrow(() => assertWidgetLayoutAccess(type, { layout }, true));
      if (isProWidgetLayout(type, { layout }))
        assert.throws(() => assertWidgetLayoutAccess(type, { layout }, false), /requires Pro/);
    }
  }
});

test("layout parsers retain all new and legacy choices", () => {
  for (const layout of GOAL_LAYOUTS) assert.equal(parseGoalLayout({ layout }), layout);
  for (const layout of WHEEL_LAYOUTS) assert.equal(parseWheelLayout({ layout }), layout);
  for (const layout of VIEWER_LAYOUTS) assert.equal(parseViewerLayout({ layout }), layout);
  for (const layout of EVENT_LABEL_LAYOUTS) assert.equal(parseEventLabelLayout({ layout }), layout);
  assert.equal(parseGoalLayout({}), "classic");
  assert.equal(parseWheelLayout({ layout: "glow" }), "classic");
  assert.equal(parseViewerLayout({ layout: "glass" }), "island");
});

test("internal tools never advertise external platform events", () => {
  for (const type of [
    "POLL",
    "PREDICTION",
    "SPIN_WHEEL",
    "CHAT_SPOTLIGHT",
    "VIEWER_COUNTER",
    "STREAM_EVENTS_SCHEDULE",
    "GIVEAWAY",
  ]) {
    assert.deepEqual(widgetTestGroups(type), [], type);
  }
  assert.deepEqual(
    widgetTestGroups("KICKS_GOAL").map((group) => [
      group.platform,
      group.events.map((event) => event.type),
    ]),
    [["KICK", ["BITS"]]],
  );
  for (const group of widgetTestGroups("FOLLOWER_GOAL"))
    assert.ok(group.events.every((event) => event.type === "FOLLOW"));
  for (const group of widgetTestGroups("DONATION_GOAL"))
    assert.ok(group.events.every((event) => event.type === "DONATION"));
  for (const group of widgetTestGroups("SUBSCRIBER_GOAL"))
    assert.ok(group.events.every((event) => ["SUBSCRIPTION", "GIFT_SUB"].includes(event.type)));
});

test("new timer designs preserve exact countdown formatting", () => {
  for (const layout of ["split_clock", "broadcast"] as const) {
    assert.equal(parseOverlayTheme({ layout }).layout, layout);
  }
  assert.equal(formatOverlayTime(90061, "dhms"), "01:01:01:01");
  assert.equal(formatOverlayTime(90061, "hms"), "25:01:01");
  assert.equal(formatOverlayTime(0, "hms"), "00:00:00");
});

test("wheel layout never changes prize weights, cost or the selected result", () => {
  const prizes = [
    { label: "Alpha", weight: 1 },
    { label: "Beta", weight: 3 },
  ];
  const random = Math.random;
  try {
    Math.random = () => 0.5;
    for (const layout of WHEEL_LAYOUTS) {
      const parsed = parseSpinConfig({ layout, prizes, spinCost: 25 });
      assert.deepEqual(parsed.prizes, prizes);
      assert.equal(parsed.spinCost, 25);
      assert.equal(pickWeightedPrize(parsed.prizes), "Beta");
    }
  } finally {
    Math.random = random;
  }
});

test("legacy aliases and implicit defaults cannot bypass a Pro save check", () => {
  for (const [type, config] of [
    ["VIEWER_COUNTER", { layout: "bold" }],
    ["STREAM_EVENTS_SCHEDULE", {}],
    ["STREAM_EVENTS_SCHEDULE", { layout: "unknown" }],
    ["SUBATHON_TIMER", {}],
    ["SUBATHON_TIMER", { layout: "unknown" }],
  ] as const) {
    assert.equal(isProWidgetLayout(type, config), true);
    assert.throws(() => assertWidgetLayoutAccess(type, config, false), /requires Pro/);
  }
});

test("all shared layout labels are available in Arabic and English", () => {
  for (const [family, layouts] of [
    ["goal", GOAL_LAYOUTS],
    ["viewer", VIEWER_LAYOUTS],
    ["wheel", WHEEL_LAYOUTS],
    ["events", EVENT_LABEL_LAYOUTS],
    ["chrome", CHROME_LAYOUTS],
    ["poll", POLL_LAYOUTS],
    ["prediction", PREDICTION_LAYOUTS],
    ["schedule", SCHEDULE_LAYOUTS],
  ] as const) {
    for (const layout of layouts) {
      assert.notEqual(widgetLayoutLabel(family, layout, "en"), layout);
      assert.match(widgetLayoutLabel(family, layout, "ar"), /[\u0600-\u06ff]/);
    }
  }
});
