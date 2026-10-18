import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { CHAT_LAYOUTS } from "../src/lib/widgets.ts";
import { clampFreeWidgetConfig, widgetSaveAllowed } from "../src/lib/planLimits.ts";
import {
  ROYAL_COMPACT_DEFAULTS,
  ROYAL_COMPACT_THEME_ID,
  dedupeChatBadgeKeys,
  parseRoyalCompactSettings,
  readChatAvatarUrl,
  royalBadgeGap,
  royalCompactFill,
  royalCompactLayout,
  royalCompactPayload,
  readChatPresentation,
  chatUsesRoyalCompact,
} from "../src/lib/royalCompact.ts";
import { subscriptionIsActive } from "../src/lib/subscription.server.ts";

test("royal-compact theme id is present beside the existing layouts", () => {
  assert.equal(ROYAL_COMPACT_THEME_ID, "royal-compact");
  assert.deepEqual(
    CHAT_LAYOUTS.map((entry) => entry.value),
    ["transparent", "glass", "island", "bubble"],
  );
});

test("speech bubbles stay free and beat a leftover royal theme id", () => {
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "bubble", themeId: "dark-glass" }), true);
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }), false);
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", { themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "glass" }), false);
  assert.equal(readChatPresentation(null), "glass");
  assert.equal(readChatPresentation({ chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }), "bubble");
  assert.equal(chatUsesRoyalCompact({ chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }), false);
  assert.equal(readChatPresentation({ themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "glass" }), ROYAL_COMPACT_THEME_ID);
  assert.equal(readChatPresentation({ themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "island" }), ROYAL_COMPACT_THEME_ID);
  assert.equal(chatUsesRoyalCompact({ themeId: ROYAL_COMPACT_THEME_ID }), true);
  const clampedBubble = clampFreeWidgetConfig("CHAT_BOX", {
    chatLayout: "bubble",
    themeId: ROYAL_COMPACT_THEME_ID,
  });
  assert.equal(clampedBubble["chatLayout"], "bubble");
  assert.equal(clampedBubble["themeId"], "dark-glass");
  assert.equal(readChatPresentation(clampedBubble), "bubble");
});

test("free save of royal-compact is rejected and Pro save is accepted", () => {
  const config = royalCompactPayload({ ...ROYAL_COMPACT_DEFAULTS, showAvatar: false });
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", config), false);
  assert.equal(widgetSaveAllowed(true, "CHAT_BOX", config), true);
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "glass", themeId: "dark-glass" }), true);
});

test("expired subscription is not active Pro", () => {
  const now = Date.parse("2026-10-14T12:00:00Z");
  assert.equal(
    subscriptionIsActive(
      { subscription_status: "active", expires_at: "2026-10-01T00:00:00Z", is_lifetime: false },
      now,
    ),
    false,
  );
  assert.equal(
    subscriptionIsActive(
      { subscription_status: "active", expires_at: "2026-12-01T00:00:00Z", is_lifetime: false },
      now,
    ),
    true,
  );
});

test("showAvatar false removes the avatar and its gap", () => {
  const hidden = royalCompactLayout({ ...ROYAL_COMPACT_DEFAULTS, showAvatar: false });
  const shown = royalCompactLayout({ ...ROYAL_COMPACT_DEFAULTS, showAvatar: true });
  assert.equal(hidden.avatar, 0);
  assert.equal(hidden.gap, 0);
  assert.equal(shown.avatar, 38);
  assert.equal(shown.gap, 4);
});

test("hiding badges removes their gap and duplicate badges collapse", () => {
  assert.equal(royalBadgeGap(false, 3), 0);
  assert.equal(royalBadgeGap(true, 0), 0);
  assert.equal(royalBadgeGap(true, 2), 4);
  assert.deepEqual(dedupeChatBadgeKeys(["moderator", "Moderator", "vip", "subscriber", "vip"]), [
    "moderator",
    "vip",
    "subscriber",
  ]);
});

test("long messages wrap inside one fit-content bubble", () => {
  const layout = royalCompactLayout(ROYAL_COMPACT_DEFAULTS);
  assert.equal(layout.width, "fit-content");
  assert.equal(layout.maxWidth, "100%");
  assert.equal(layout.overflowX, "visible");
  assert.equal(layout.whiteSpace, "normal");
  assert.equal(layout.overflowWrap, "anywhere");
  assert.equal(layout.minHeight, 38);
  assert.equal(layout.padding, "2px 18px 2px 12px");
  assert.equal(layout.radius, 0);
  assert.equal(layout.fontSize, 14);
  assert.equal(layout.messageGap, 7);
  assert.equal(layout.background, "transparent");
  assert.equal(layout.shadow, "none");
  const fill = royalCompactFill("#f5c16c", 88);
  assert.match(fill, /^linear-gradient\(to right,/);
  assert.match(fill, /transparent 100%\)$/);
  assert.doesNotMatch(fill, /border-radius/);
  assert.equal(layout.textDirection, "auto");
  assert.equal(layout.unicodeBidi, "plaintext");
  assert.equal(layout.rowDirection, "ltr");
  assert.equal(layout.animationMs, 200);
  const roomy = royalCompactLayout({ ...ROYAL_COMPACT_DEFAULTS, density: "normal" });
  assert.equal(roomy.padding, "4px 22px 4px 14px");
  assert.equal(roomy.minHeight, 38);
});

test("royal settings round-trip through the config shape", () => {
  const settings = parseRoyalCompactSettings({
    royalCompact: {
      showAvatar: false,
      density: "normal",
      fontSize: 18,
      bubbleOpacity: 70,
      messageGap: 12,
      avatarSize: 44,
    },
  });
  const stored = royalCompactPayload(settings);
  assert.deepEqual(parseRoyalCompactSettings(stored), settings);
  assert.deepEqual(parseRoyalCompactSettings({}), { ...ROYAL_COMPACT_DEFAULTS });
  assert.equal(readChatAvatarUrl({ profile_picture: "https://files.kick.com/a.png" }), "https://files.kick.com/a.png");
  assert.equal(readChatAvatarUrl({ avatar: "not-a-url" }), null);
  assert.equal(readChatAvatarUrl({ authorDetails: { profileImageUrl: "https://yt.img/a.jpg" } }), "https://yt.img/a.jpg");
});

test("expired Pro overlay falls back without deleting stored royal settings", () => {
  const stored = {
    themeId: ROYAL_COMPACT_THEME_ID,
    chatLayout: "island",
    fontSize: 14,
    showBadges: false,
    royalCompact: {
      showAvatar: false,
      density: "compact",
      fontSize: 14,
      bubbleOpacity: 88,
      messageGap: 7,
      avatarSize: 38,
    },
  };
  const clamped = clampFreeWidgetConfig("CHAT_BOX", stored);
  assert.equal(clamped["themeId"], "dark-glass");
  assert.equal(clamped["chatLayout"], "glass");
  assert.equal(clamped["showBadges"], false);
  assert.deepEqual(clamped["royalCompact"], stored.royalCompact);
  assert.equal(stored.themeId, ROYAL_COMPACT_THEME_ID);
  assert.equal(widgetSaveAllowed(false, "CHAT_BOX", stored), false);
  assert.equal(widgetSaveAllowed(true, "CHAT_BOX", stored), true);
});

function sourceSlice(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing slice ${start}`);
  return source.slice(from, to);
}

test("speech bubbles and the other chat layouts stay on the previous markup", () => {
  const demo = readFileSync(new URL("../src/components/widgets/WidgetRenderer.tsx", import.meta.url), "utf8");
  const product = readFileSync(
    new URL("../../CylixStudio/src/components/widgets/WidgetRenderer.tsx", import.meta.url),
    "utf8",
  );
  const bubbleStart = 'if (layout === "bubble")';
  const islandStart = 'if (layout === "island")';
  assert.equal(sourceSlice(demo, bubbleStart, islandStart), sourceSlice(product, bubbleStart, islandStart));
  assert.match(sourceSlice(demo, bubbleStart, islandStart), /data-chat-arc=""/);
  assert.match(sourceSlice(demo, bubbleStart, islandStart), /data-chat-fill=""/);
  const royal = sourceSlice(demo, "if (royal)", bubbleStart);
  assert.match(royal, /data-chat-theme="royal-compact"/);
  assert.match(royal, /data-royal-arc=""/);
  assert.match(royal, /data-royal-fill=""/);
  assert.doesNotMatch(royal, /data-chat-arc/);
  assert.doesNotMatch(royal, /data-chat-fill/);
  const glassStart = demo.indexOf(islandStart);
  const productGlass = product.indexOf(islandStart);
  const demoTail = demo.slice(glassStart, glassStart + 4000);
  const productTail = product.slice(productGlass, productGlass + 4000);
  assert.equal(demoTail, productTail);
});
