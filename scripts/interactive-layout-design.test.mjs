import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

const server = await createServer({
  configFile: false,
  appType: "custom",
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  server: { middlewareMode: true, watch: null },
  optimizeDeps: { noDiscovery: true },
});
after(() => server.close());

const widgets = await server.ssrLoadModule("/src/lib/widgets.ts");
const { PollOverlay } = await server.ssrLoadModule("/src/components/widgets/PollOverlay.tsx");
const { PredictionOverlay } = await server.ssrLoadModule(
  "/src/components/widgets/PredictionOverlay.tsx",
);
const { StreamEventsScheduleCard } = await server.ssrLoadModule(
  "/src/components/widgets/StreamEventsScheduleCard.tsx",
);
const { emptyPollRuntime, emptyPredictionRuntime } = await server.ssrLoadModule(
  "/src/lib/interactiveWidgets.ts",
);
const { resolveStreamSchedule, formatCountdown } = await server.ssrLoadModule(
  "/src/lib/streamEventsSchedule.ts",
);

const render = (component, props) => renderToStaticMarkup(createElement(component, props));
const visibleText = (html) =>
  html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/g, "").replace(/<[^>]*>/g, "");

test("interactive parsers retain exactly eight legacy and new layouts without changing settings", () => {
  for (const [ids, parser, expected, fallback] of [
    [
      widgets.POLL_LAYOUTS,
      widgets.parsePollConfig,
      ["default", "compact", "cards", "columns", "ballot", "leaderboard", "donut", "split"],
      "default",
    ],
    [
      widgets.PREDICTION_LAYOUTS,
      widgets.parsePredictionConfig,
      ["classic", "compact", "split", "particle-clash", "scoreboard", "duel", "ribbon", "odds"],
      "classic",
    ],
    [
      widgets.STREAM_EVENTS_SCHEDULE_LAYOUTS,
      widgets.parseStreamEventsScheduleConfig,
      ["direct", "agenda", "glass", "bold", "timeline", "calendar", "roadmap", "spotlight"],
      "glass",
    ],
  ]) {
    assert.deepEqual([...ids], expected);
    assert.equal(new Set(ids).size, 8);
    const input = {
      title: "عنوان Title",
      durationSeconds: 90,
      fontSize: 34,
      events: [{ id: "first", title: "First", durationSeconds: 60 }],
    };
    const base = parser(input);
    for (const layout of ids) {
      const parsed = parser({ ...input, layout });
      assert.equal(parsed.layout, layout);
      assert.deepEqual({ ...parsed, layout: fallback }, { ...base, layout: fallback });
    }
    assert.equal(parser({ layout: "unknown" }).layout, fallback);
  }
});

test("all Poll geometries render real votes, order, zeros and explicit minority winners", () => {
  const original = {
    ...emptyPollRuntime(),
    status: "ended",
    title: "Official استطلاع",
    options: [
      { id: "a", label: "First أول", votes: 12 },
      { id: "b", label: "Second ثان", votes: 88 },
      { id: "c", label: "Third ثالث", votes: 0 },
    ],
    winnerId: "a",
  };
  for (const layout of widgets.POLL_LAYOUTS) {
    const runtime = structuredClone(original);
    const html = render(PollOverlay, { config: { layout }, runtime, demo: true });
    const text = visibleText(html);
    assert.match(html, /data-layout-content/);
    assert.match(text, /Official استطلاع/);
    assert.ok(text.indexOf("First أول") < text.indexOf("Second ثان"));
    assert.ok(text.indexOf("Second ثان") < text.indexOf("Third ثالث"));
    for (const percent of ["12%", "88%", "0%"])
      assert.ok(text.includes(percent), `${layout}: ${percent}`);
    assert.equal((text.match(/الفائز/g) ?? []).length, 1, layout);
    assert.deepEqual(runtime, original);
  }
});

test("Prediction layouts preserve source points/voters and never infer a winner while locked", () => {
  const base = {
    ...emptyPredictionRuntime(),
    title: "Official توقع",
    outcomes: [
      { id: "a", label: "First أول", points: 1200, voters: 7 },
      { id: "b", label: "Second ثان", points: 8800, voters: 19 },
    ],
  };
  for (const layout of widgets.PREDICTION_LAYOUTS.filter((id) => id !== "particle-clash")) {
    for (const status of ["locked", "resolved"]) {
      const runtime = {
        ...structuredClone(base),
        status,
        winnerId: status === "resolved" ? "a" : null,
      };
      const before = structuredClone(runtime);
      const html = render(PredictionOverlay, { config: { layout }, runtime, demo: true });
      const text = visibleText(html);
      assert.match(html, /data-layout-content/);
      assert.ok(text.indexOf("First أول") < text.indexOf("Second ثان"));
      for (const value of ["1,200", "8,800", "12%", "88%"])
        assert.ok(text.includes(value), `${layout}: ${value}`);
      assert.equal((text.match(/★/g) ?? []).length, status === "resolved" ? 1 : 0, layout);
      assert.deepEqual(runtime, before);
    }
  }
});

test("Schedule layouts use the same current event, countdown, durations and original order", () => {
  const now = Date.now();
  const runtime = {
    startedAt: new Date(now - 90_000).toISOString(),
    bonusElapsedSeconds: 0,
    revision: 1,
  };
  const events = [
    { id: "first", title: "First أول", durationSeconds: 60 },
    { id: "second", title: "Second ثان", durationSeconds: 180 },
    { id: "third", title: "Third ثالث", durationSeconds: 120 },
  ];
  const expected = resolveStreamSchedule(events, runtime, now);
  assert.equal(expected.status, "active");
  assert.equal(expected.current.id, "second");
  for (const layout of widgets.STREAM_EVENTS_SCHEDULE_LAYOUTS) {
    const html = render(StreamEventsScheduleCard, { config: { layout, events }, runtime });
    const text = visibleText(html);
    assert.match(html, /data-layout-content/);
    assert.ok(text.includes("Second ثان"), layout);
    assert.ok(text.includes(formatCountdown(expected.remainingSeconds)), layout);
    if (layout !== "direct") {
      // A current-event hero may precede the ordered full event list.
      assert.ok(text.lastIndexOf("First أول") < text.lastIndexOf("Second ثان"), layout);
      assert.ok(text.lastIndexOf("Second ثان") < text.lastIndexOf("Third ثالث"), layout);
    }
  }
});

test("idle live overlays do not invent sample votes or outcomes", () => {
  for (const [component, ids] of [
    [PollOverlay, widgets.POLL_LAYOUTS],
    [PredictionOverlay, widgets.PREDICTION_LAYOUTS.filter((id) => id !== "particle-clash")],
  ]) {
    for (const layout of ids) {
      assert.equal(render(component, { config: { layout }, runtime: null }), "");
      assert.doesNotMatch(
        render(component, { config: { layout }, runtime: null, demo: true }),
        /First|Second|50%/,
      );
    }
  }
});
