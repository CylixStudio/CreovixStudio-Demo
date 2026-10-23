import assert from "node:assert/strict";
import test from "node:test";

import { createSeededDb } from "../src/demo/overlay.ts";
import {
  demoShopIdentities,
  normalizedShopUsername,
  primaryShopIdentity,
  resolveLegacyShopChannel,
  resolveShopIdentity,
  shortShopPath,
} from "../src/lib/demoShopLinks.ts";
import { DEMO_USER_ID } from "../src/lib/demoMode.ts";
import { mergeShopRoutingHints, parseShopRoutingHints } from "../src/lib/demoShopRoutingHints.ts";

const read = (id: string) => createSeededDb(id).snapshot();

test("short shop links map the correct platform identity to a stable channel", () => {
  const identities = demoShopIdentities(read);
  assert.equal(resolveShopIdentity(identities, "kick", "demouser")?.channelId, "own");
  assert.equal(resolveShopIdentity(identities, "twitch", "demouser_tv")?.channelId, "own");
  assert.equal(resolveShopIdentity(identities, "twitch", "NovaPlays")?.channelId, "streamer-a");
  assert.equal(resolveShopIdentity(identities, "kick", "atlastv")?.channelId, "streamer-b");
  assert.equal(resolveShopIdentity(identities, "kick", "novaplays"), null);
  assert.equal(shortShopPath(primaryShopIdentity("own", identities)!), "/k/DemoUser/shop");
  assert.equal(
    shortShopPath(resolveShopIdentity(identities, "twitch", "novaplays")!),
    "/t/novaplays/shop",
  );
});

test("legacy ids, profile slugs and platform names resolve only unambiguously", () => {
  for (const key of ["own", "DemoUser", "demouser_tv", DEMO_USER_ID]) {
    assert.equal(resolveLegacyShopChannel(key, read), "own");
  }
  assert.equal(resolveLegacyShopChannel("streamer-a", read), "streamer-a");
  assert.equal(resolveLegacyShopChannel("atlastv", read), "streamer-b");
  assert.equal(resolveLegacyShopChannel("unknown", read), null);
});

test("identical usernames on different platforms never merge channels", () => {
  const identities = demoShopIdentities(read);
  const kick = identities.find(
    (identity) => identity.platform === "kick" && identity.channelId === "own",
  )!;
  kick.username = "novaplays";
  assert.equal(resolveShopIdentity(identities, "kick", "novaplays")?.channelId, "own");
  assert.equal(resolveShopIdentity(identities, "twitch", "novaplays")?.channelId, "streamer-a");
  assert.equal(resolveLegacyShopChannel("novaplays", read, identities), null);
});

test("renames use platform id and explicit history; reassigned names are never stolen by an alias", () => {
  const own = read("own");
  const changed = {
    ...own,
    platform_connections: own["platform_connections"]!.map((row) =>
      row["platform"] === "KICK"
        ? { ...row, username: "zR3d", metadata: { previous_usernames: ["second_name"] } }
        : row,
    ),
  };
  const identities = demoShopIdentities((id) => (id === "own" ? changed : read(id)));
  assert.equal(shortShopPath(resolveShopIdentity(identities, "kick", "DemoUser")!), "/k/zR3d/shop");
  assert.equal(
    shortShopPath(resolveShopIdentity(identities, "kick", "second_name")!),
    "/k/zR3d/shop",
  );
  assert.equal(resolveShopIdentity(identities, "twitch", "second_name"), null);
  const reassigned = [
    ...identities,
    {
      channelId: "streamer-b",
      platform: "kick" as const,
      platformId: "new-identity",
      username: "DemoUser",
      previousUsernames: [],
    },
  ];
  assert.equal(resolveShopIdentity(reassigned, "kick", "DemoUser")?.channelId, "streamer-b");
  const replaced = {
    ...changed,
    platform_connections: changed.platform_connections.map((row) => ({
      ...row,
      platform_user_id: "different",
    })),
  };
  assert.equal(
    resolveShopIdentity(
      demoShopIdentities((id) => (id === "own" ? replaced : read(id))),
      "kick",
      "DemoUser",
    ),
    null,
  );
});

test("inactive or ambiguous identities and unsafe usernames cannot generate a link", () => {
  const identities = demoShopIdentities(read);
  const own = identities.find((identity) => identity.platform === "kick")!;
  const duplicated = [...identities, { ...own, channelId: "streamer-b" }];
  assert.equal(resolveShopIdentity(duplicated, "kick", own.username), null);
  assert.equal(primaryShopIdentity("own", duplicated)?.platform, "twitch");
  for (const username of ["../other", "//host", "a/b", "x?redirect=host", "", "x".repeat(33)]) {
    assert.equal(normalizedShopUsername(username), null);
  }
  const snapshot = read("own");
  const inactive = {
    ...snapshot,
    platform_connections: snapshot["platform_connections"]!.map((row) => ({
      ...row,
      is_active: false,
    })),
  };
  assert.equal(
    primaryShopIdentity(
      "own",
      demoShopIdentities((id) => (id === "own" ? inactive : read(id))),
    ),
    null,
  );
});

test("public SSR routing hints support refresh after a local rename without granting any authority", () => {
  const defaults = demoShopIdentities(read);
  const own = defaults.filter((identity) => identity.channelId === "own");
  const renamed = own.map((identity) =>
    identity.platform === "kick"
      ? { ...identity, username: "zR3d", previousUsernames: ["DemoUser"] }
      : identity,
  );
  const parsed = parseShopRoutingHints(encodeURIComponent(JSON.stringify(renamed)));
  const merged = mergeShopRoutingHints(defaults, parsed);
  assert.equal(resolveShopIdentity(merged, "kick", "DemoUser")?.username, "zR3d");
  assert.equal(resolveShopIdentity(merged, "kick", "zR3d")?.channelId, "own");
  assert.equal(resolveShopIdentity(merged, "twitch", "novaplays")?.channelId, "streamer-a");
  assert.deepEqual(
    mergeShopRoutingHints(defaults, [{ ...renamed[0]!, platformId: "untrusted-id" }]),
    defaults,
  );
  assert.equal(parseShopRoutingHints("not-json"), null);
  assert.equal(
    parseShopRoutingHints(encodeURIComponent(JSON.stringify([renamed[0], renamed[0]]))),
    null,
  );
  assert.equal(
    parseShopRoutingHints(
      encodeURIComponent(JSON.stringify([{ ...renamed[0], channelId: "streamer-a" }])),
    ),
    null,
  );
  assert.equal(primaryShopIdentity("own", mergeShopRoutingHints(defaults, [])), null);
});
