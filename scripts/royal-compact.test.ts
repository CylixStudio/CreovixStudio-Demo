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
  royalUserColor,
  royalCompactPayload,
  readChatPresentation,
  chatUsesRoyalCompact,
} from "../src/lib/royalCompact.ts";
import { subscriptionIsActive } from "../src/lib/subscription.server.ts";
import { normalizeDemoFile } from "../src/lib/demoState.ts";

test("royal-compact theme id is present beside the existing layouts", () => {
  assert.equal(ROYAL_COMPACT_THEME_ID, "royal-compact");
  assert.deepEqual(
    CHAT_LAYOUTS.map((entry) => entry.value),
    ["transparent", "glass", "island", "bubble"],
  );
});

test("speech bubbles stay free and beat a leftover royal theme id", () => {
  assert.equal(
    widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "bubble", themeId: "dark-glass" }),
    true,
  );
  assert.equal(
    widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }),
    false,
  );
  assert.equal(
    widgetSaveAllowed(false, "CHAT_BOX", { themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "glass" }),
    false,
  );
  assert.equal(readChatPresentation(null), "glass");
  assert.equal(
    readChatPresentation({ chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }),
    "bubble",
  );
  assert.equal(
    chatUsesRoyalCompact({ chatLayout: "bubble", themeId: ROYAL_COMPACT_THEME_ID }),
    false,
  );
  assert.equal(
    readChatPresentation({ themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "glass" }),
    ROYAL_COMPACT_THEME_ID,
  );
  assert.equal(
    readChatPresentation({ themeId: ROYAL_COMPACT_THEME_ID, chatLayout: "island" }),
    ROYAL_COMPACT_THEME_ID,
  );
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
  assert.equal(
    widgetSaveAllowed(false, "CHAT_BOX", { chatLayout: "glass", themeId: "dark-glass" }),
    true,
  );
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
  assert.equal(shown.gap, 10);
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
  assert.equal(layout.minHeight, 34);
  assert.equal(layout.padding, "6px 11px 6px 10px");
  assert.equal(layout.radius, 11);
  assert.equal(layout.fontSize, 14);
  assert.equal(layout.messageGap, 7);
  assert.equal(layout.background, "transparent");
  assert.equal(layout.shadow, "none");
  const fill = royalCompactFill("#f5c16c", 88);
  assert.equal(fill, "rgba(12, 12, 16, 0.88)");
  assert.doesNotMatch(fill, /gradient|glow/);
  assert.doesNotMatch(fill, /border-radius/);
  assert.equal(layout.textDirection, "auto");
  assert.equal(layout.unicodeBidi, "plaintext");
  assert.equal(layout.rowDirection, "ltr");
  assert.equal(layout.animationMs, 200);
  const roomy = royalCompactLayout({ ...ROYAL_COMPACT_DEFAULTS, density: "normal" });
  assert.equal(roomy.padding, "9px 13px 9px 11px");
  assert.equal(roomy.minHeight, 40);
});

test("real name colors win; missing colors use role data without inventing badges", () => {
  assert.equal(royalUserColor("#55aabb", ["broadcaster"]), "#55aabb");
  assert.equal(royalUserColor(null, ["moderator"]), "#64D9B0");
  assert.equal(royalUserColor(null, ["vip"]), "#D9A0D4");
  assert.equal(royalUserColor(null, ["broadcaster"]), "#E5C780");
  assert.equal(royalUserColor(null, ["subscriber"]), "#A8B6ED");
  assert.equal(royalUserColor("url(invalid)", []), "#BEE1FC");
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

  test("Demo persistence keeps provider-supplied badge artwork without creating counts or roles", () => {
    const state = normalizeDemoFile({
      messages: {
        "demo-chat-box": [
          {
            id: "custom",
            author: "Viewer",
            text: "hello",
            badges: [],
            badgeList: [{ type: "custom", imageUrl: "https://cdn.example.com/badge.png" }],
          },
        ],
      },
    });
    const badges = state.messages["demo-chat-box"]![0]!.badgeList!;
    assert.equal(badges.length, 1);
    assert.equal(badges[0]!.imageUrl, "https://cdn.example.com/badge.png");
    assert.equal(badges[0]!.count, null);
  });
  const stored = royalCompactPayload(settings);
  assert.deepEqual(parseRoyalCompactSettings(stored), settings);
  assert.deepEqual(parseRoyalCompactSettings({}), { ...ROYAL_COMPACT_DEFAULTS });
  assert.equal(
    readChatAvatarUrl({ profile_picture: "https://files.kick.com/a.png" }),
    "https://files.kick.com/a.png",
  );
  assert.equal(readChatAvatarUrl({ avatar: "not-a-url" }), null);
  assert.equal(
    readChatAvatarUrl({ authorDetails: { profileImageUrl: "https://yt.img/a.jpg" } }),
    "https://yt.img/a.jpg",
  );
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

test("Royal stays isolated while replacement chat layouts share their preview/source face", () => {
  const demo = readFileSync(
    new URL("../src/components/widgets/WidgetRenderer.tsx", import.meta.url),
    "utf8",
  );
  const shared = 'if (["glass", "bubble", "island"].includes(layout))';
  const royal = sourceSlice(demo, "if (royal)", shared);
  assert.match(royal, /data-chat-theme="royal-compact"/);
  assert.match(royal, /<RoyalChatRow/);
  assert.doesNotMatch(royal, /data-chat-arc/);
  assert.doesNotMatch(royal, /data-chat-fill/);
  assert.match(sourceSlice(demo, shared, "  const quiet ="), /<ChatMessageFace/);
  assert.doesNotMatch(demo, /function BubbleAvatar|data-chat-arc=""|data-chat-fill=""/);
});

test("picker and actual renderer share the compact face, isolated text and avatar fallback", () => {
  const face = readFileSync(
    new URL("../src/components/widgets/RoyalChatRow.tsx", import.meta.url),
    "utf8",
  );
  const picker = readFileSync(
    new URL("../src/components/widgets/ChatThemePicker.tsx", import.meta.url),
    "utf8",
  );
  assert.match(picker, /<RoyalChatRow/);
  assert.match(face, /borderLeft: `2px solid \$\{color\}`/);
  assert.match(face, /borderRadius: layout.radius/);
  assert.match(face, /data-royal-name=""\s+dir="auto"/);
  assert.match(face, /data-royal-text=""\s+dir="auto"/);
  assert.doesNotMatch(face, /boxShadow|gradient|filter:|https:\/\/.*avatar/i);
});
