import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import ts from "typescript";
import { createElement } from "react";
import "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";

const src = fileURLToPath(new URL("../src", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/") && specifier.endsWith("?url"))
      return nextResolve(pathToFileURL(resolve(src, specifier.slice(2, -4))).href, context);
    if (
      specifier.startsWith("@/") ||
      (specifier.startsWith(".") && context.parentURL?.startsWith("file:"))
    ) {
      const base = specifier.startsWith("@/")
        ? resolve(src, specifier.slice(2))
        : resolve(dirname(fileURLToPath(context.parentURL)), specifier);
      const path = [base, `${base}.ts`, `${base}.tsx`].find((candidate) => existsSync(candidate));
      if (path) return nextResolve(pathToFileURL(path).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".svg"))
      return {
        format: "module",
        shortCircuit: true,
        source: `export default ${JSON.stringify(url)}`,
      };
    if (!url.endsWith(".tsx")) return nextLoad(url, context);
    return {
      format: "module",
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(fileURLToPath(url), "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
        },
      }).outputText,
    };
  },
});

const { OVERLAY_LAYOUTS, parseOverlayTheme, formatOverlayTime } =
  await import("../src/lib/overlayTheme.ts");
const { CHROME_LAYOUTS, parseChromeLayout } = await import("../src/lib/widgetLayouts.ts");
const { isProWidgetLayout } = await import("../src/lib/widgetLayoutAccess.ts");
const { parseSpotlightConfig, parseSpotlightState } = await import("../src/lib/widgets.ts");
const { OverlayView } = await import("../src/components/overlay/OverlayView.tsx");
const { ChatSpotlightView, PinnedMessageCard } =
  await import("../src/components/widgets/ChatSpotlightView.tsx");

const message = {
  id: "pin-1",
  nonce: 42,
  author: "مشاهد Cylix",
  platform: "KICK",
  color: "#A78BFA",
  text: "رسالة عربية English 123 [emote:123:hello]",
  badges: ["subscriber"],
  badgeImages: [{ label: "custom", imageUrl: "https://example.invalid/badge.png" }],
  pinnedAt: "2026-10-23T12:00:00.000Z",
  isReply: true,
  replyQuote: "Original quote",
  appearedAt: "2026-10-23T11:59:00.000Z",
};

test("WidgetRenderer reuses the extracted pin runtime and timer minis use the shared content fitter", () => {
  const renderer = readFileSync(resolve(src, "components/widgets/WidgetRenderer.tsx"), "utf8");
  const sidebar = readFileSync(resolve(src, "components/widgets/SubathonTimerSidebar.tsx"), "utf8");
  assert.match(
    renderer,
    /import \{ ChatSpotlightView \} from "@\/components\/widgets\/ChatSpotlightView"/,
  );
  assert.match(renderer, /export \{ ChatSpotlightView \}/);
  assert.doesNotMatch(
    renderer,
    /function ChatSpotlightView|SPOTLIGHT_FADE_MS|parseSpotlightConfig/,
  );
  assert.match(sidebar, /<LayoutThumbnail>/);
  assert.match(sidebar, /<OverlayView theme=\{mini\} remaining=\{PREVIEW_SECONDS\}/);
  assert.doesNotMatch(sidebar, /h-\[92px\]|useLayoutEffect/);
  for (const file of ["i18n.tsx", "i18n.en.ts"]) {
    const translations = readFileSync(resolve(src, "lib", file), "utf8");
    assert.match(translations, /"sub\.layout\.tower":/);
    assert.match(translations, /"sub\.layout\.tower\.hint":/);
  }
});

test("timer and pinned catalogs have exactly eight retained IDs, two Free and six Pro", () => {
  const timer = [
    "raw_digits",
    "island",
    "cute_heart",
    "broadcast",
    "split_clock",
    "circular_pomodoro",
    "multi_ring_countdown",
    "tower",
  ];
  const pinned = ["glass", "direct", "bold", "lower-third", "message", "pill", "split", "featured"];
  assert.deepEqual(
    OVERLAY_LAYOUTS.map((entry) => entry.value),
    timer,
  );
  assert.deepEqual([...CHROME_LAYOUTS], pinned);
  for (const [type, layouts] of [
    ["SUBATHON_TIMER", timer],
    ["CHAT_SPOTLIGHT", pinned],
  ]) {
    assert.equal(layouts.filter((layout) => !isProWidgetLayout(type, { layout })).length, 2);
    assert.equal(layouts.filter((layout) => isProWidgetLayout(type, { layout })).length, 6);
    for (const layout of layouts) {
      assert.equal(
        type === "SUBATHON_TIMER"
          ? parseOverlayTheme({ layout }).layout
          : parseChromeLayout({ layout }),
        layout,
      );
    }
  }
});

test("all timer geometries render exact Latin countdowns without changing zero or long-duration formatting", () => {
  for (const layout of OVERLAY_LAYOUTS.map((entry) => entry.value)) {
    for (const [seconds, format, expected] of [
      [90061, "dhms", "01:01:01:01"],
      [90061, "hms", "25:01:01"],
      [90061, "ms", "1501:01"],
      [0, "hms", "00:00:00"],
    ]) {
      const html = renderToStaticMarkup(
        createElement(OverlayView, {
          theme: parseOverlayTheme({ layout, timeFormat: format, animation: "none" }),
          remaining: seconds,
          frame: null,
        }),
      );
      assert.ok(html.includes(`data-timer-layout="${layout}"`));
      assert.ok(html.includes("data-layout-content"));
      assert.ok(html.includes('dir="ltr"'));
      assert.doesNotMatch(html, /NaN|Infinity/);
      assert.equal(formatOverlayTime(seconds, format), expected);
      if (["split_clock", "tower", "multi_ring_countdown"].includes(layout)) {
        for (const value of expected.split(":"))
          assert.ok(
            new RegExp(`>${value}</(?:span|strong)>`).test(html),
            `${layout}/${format}: ${value}`,
          );
      } else assert.ok(html.includes(expected), `${layout}/${format}`);
    }
  }
});

test("every pinned design preserves author, original text, inline Kick emotes and badge artwork", () => {
  const signatures = new Set();
  for (const layout of CHROME_LAYOUTS) {
    const html = renderToStaticMarkup(
      createElement(PinnedMessageCard, { config: { layout }, message }),
    );
    assert.ok(html.includes(`data-pinned-layout="${layout}"`));
    assert.ok(html.includes("data-layout-content"));
    assert.ok(html.includes(message.author));
    assert.ok(html.includes("رسالة عربية English 123"));
    assert.ok(html.includes("files.kick.com/emotes/123/fullsize"));
    assert.ok(html.includes("example.invalid/badge.png"));
    assert.ok(html.includes('dir="auto"'));
    assert.doesNotMatch(html, /min-width:360px|NaN|Infinity/);
    signatures.add(html.replace(`data-pinned-layout="${layout}"`, ""));
  }
  assert.equal(signatures.size, 8);
});

test("pinned root uses consistent border edges across layout rerenders without shorthand conflicts", () => {
  for (const layout of CHROME_LAYOUTS) {
    const html = renderToStaticMarkup(
      createElement(PinnedMessageCard, { config: { layout }, message }),
    );
    const rootStyle = html.match(/data-pinned-layout="[^"]+"[^>]*style="([^"]+)"/)?.[1];
    assert.ok(rootStyle, layout);
    assert.doesNotMatch(rootStyle, /(?:^|;)border:/, layout);
    if (html.includes("pinned-refined")) {
      assert.ok(html.includes(`pinned-refined-${layout}`));
      continue;
    }
    for (const edge of ["top", "right", "bottom", "left"]) {
      assert.ok(rootStyle.includes(`border-${edge}:`), `${layout}/${edge}`);
    }
  }
});

test("direct is transparent and new layouts do not change persisted pin/reply/auto-hide data", () => {
  const html = renderToStaticMarkup(
    createElement(PinnedMessageCard, { config: { layout: "direct" }, message }),
  );
  assert.ok(html.includes("background:transparent"));
  const css = readFileSync(resolve(src, "components/widgets/WidgetRefinement.css"), "utf8");
  assert.match(css, /\.pinned-refined-direct\s*\{[^}]*border:\s*(?:0|none)/);
  for (const layout of CHROME_LAYOUTS) {
    assert.deepEqual(
      parseSpotlightState({ spotlight: message, layout }),
      parseSpotlightState({ spotlight: message }),
    );
    assert.equal(parseSpotlightConfig({ layout, autoHideMs: 15000 }).autoHideMs, 15000);
    assert.equal(parseSpotlightConfig({ layout }).autoHideMs, 0);
    assert.equal(
      renderToStaticMarkup(
        createElement(ChatSpotlightView, { config: { layout }, spotlight: null }),
      ),
      '<div class="h-0 w-0" aria-hidden="true"></div>',
    );
  }
});

test("circular thumbnails own distinct SVG paint references and transparent backgrounds remain supported", () => {
  const theme = parseOverlayTheme({
    layout: "circular_pomodoro",
    hideBackground: true,
    showLabel: false,
  });
  const html = renderToStaticMarkup(
    createElement(
      "div",
      null,
      createElement(OverlayView, { theme, remaining: 60, frame: null }),
      createElement(OverlayView, { theme, remaining: 60, frame: null }),
    ),
  );
  const ids = [...html.matchAll(/<linearGradient id="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal((html.match(/timer-dual-arc/g) ?? []).length, 2);
  assert.ok(html.includes("background:transparent"));
  assert.ok(!html.includes(">SUBATHON</span>"));
});
