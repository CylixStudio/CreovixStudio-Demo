import type { DemoSnapshot, Row } from "@/demo/db";
import { createSeededDb } from "@/demo/overlay";
import { DEMO_USER_ID } from "@/lib/demoMode";

export type ShopPlatform = "kick" | "twitch";
export type ShopIdentity = {
  channelId: string;
  platform: ShopPlatform;
  platformId: string;
  username: string;
  previousUsernames: string[];
};
export type SnapshotReader = (channelId: string) => DemoSnapshot;

// These are the platform identities of the existing channel-team demo datasets.
const CHANNEL_IDENTITIES: ShopIdentity[] = [
  {
    channelId: "streamer-a",
    platform: "twitch",
    platformId: "demo-twitch-novaplays",
    username: "novaplays",
    previousUsernames: [],
  },
  {
    channelId: "streamer-b",
    platform: "kick",
    platformId: "demo-kick-atlastv",
    username: "atlastv",
    previousUsernames: [],
  },
];
export const SHOP_CHANNEL_IDS = ["own", "streamer-a", "streamer-b"] as const;

export function normalizedShopUsername(value: string): string | null {
  const name = value.trim();
  return /^[a-z0-9_]{1,32}$/i.test(name) ? name.toLowerCase() : null;
}

export function shortShopPath(identity: Pick<ShopIdentity, "platform" | "username">): string {
  return `/${identity.platform === "kick" ? "k" : "t"}/${encodeURIComponent(identity.username)}/shop`;
}

function readAliases(row: Row): string[] {
  const metadata = row["metadata"];
  if (!metadata || typeof metadata !== "object") return [];
  const previous = Reflect.get(metadata, "previous_usernames");
  return Array.isArray(previous)
    ? previous.filter(
        (name): name is string => typeof name === "string" && normalizedShopUsername(name) !== null,
      )
    : [];
}

export function demoShopIdentities(
  read: SnapshotReader = (id) => createSeededDb(id).snapshot(),
): ShopIdentity[] {
  const rows = read("own")["platform_connections"] ?? [];
  const seeded = createSeededDb("own").rows("platform_connections");
  const identities: ShopIdentity[] = [];
  for (const row of rows) {
    const platform =
      row["platform"] === "KICK" ? "kick" : row["platform"] === "TWITCH" ? "twitch" : null;
    const username = row["username"];
    const platformId = row["platform_user_id"];
    if (
      !platform ||
      row["is_active"] !== true ||
      typeof username !== "string" ||
      !normalizedShopUsername(username) ||
      typeof platformId !== "string"
    )
      continue;
    const original = seeded.find(
      (entry) => entry["platform"] === row["platform"] && entry["platform_user_id"] === platformId,
    );
    const previousUsernames = readAliases(row);
    // The bundled original name is a trusted alias only for the same stable platform identity.
    if (original && typeof original["username"] === "string")
      previousUsernames.push(original["username"]);
    identities.push({ channelId: "own", platform, platformId, username, previousUsernames });
  }
  return [
    ...identities,
    ...CHANNEL_IDENTITIES.map((identity) => ({
      ...identity,
      previousUsernames: [...identity.previousUsernames],
    })),
  ];
}

export function resolveShopIdentity(
  identities: ShopIdentity[],
  platform: ShopPlatform,
  username: string,
): ShopIdentity | null {
  const key = normalizedShopUsername(username);
  if (!key) return null;
  const current = identities.filter(
    (identity) =>
      identity.platform === platform && normalizedShopUsername(identity.username) === key,
  );
  if (current.length) return current.length === 1 ? current[0]! : null;
  const aliases = identities.filter(
    (identity) =>
      identity.platform === platform &&
      identity.previousUsernames.some((name) => normalizedShopUsername(name) === key),
  );
  return aliases.length === 1 ? aliases[0]! : null;
}

export function primaryShopIdentity(
  channelId: string,
  identities: ShopIdentity[],
): ShopIdentity | null {
  const candidates = identities.filter((identity) => identity.channelId === channelId);
  // Only generate a link when that exact platform/username pair resolves unambiguously.
  return (
    candidates.find(
      (identity) =>
        resolveShopIdentity(identities, identity.platform, identity.username)?.channelId ===
        channelId,
    ) ?? null
  );
}

export function resolveLegacyShopChannel(
  slug: string,
  read: SnapshotReader,
  identities = demoShopIdentities(read),
): string | null {
  const key = slug.trim().toLowerCase();
  if (SHOP_CHANNEL_IDS.some((id) => id === key)) return key;
  if (key === DEMO_USER_ID.toLowerCase()) return "own";
  const matches = new Set<string>();
  for (const id of SHOP_CHANNEL_IDS) {
    if (key === id || (id === "own" && key === DEMO_USER_ID.toLowerCase())) matches.add(id);
    const profile = read(id)["link_in_bio_profiles"]?.[0];
    if (typeof profile?.["slug"] === "string" && profile["slug"].toLowerCase() === key)
      matches.add(id);
  }
  for (const identity of identities) {
    if (
      [identity.username, ...identity.previousUsernames].some((name) => name.toLowerCase() === key)
    )
      matches.add(identity.channelId);
  }
  return matches.size === 1 ? [...matches][0]! : null;
}
