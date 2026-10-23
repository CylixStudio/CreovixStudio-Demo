import { z } from "zod";

import { type DemoSnapshot } from "@/demo/db";
import { applyOverlay, createSeededDb, dbKeyFor, DEMO_CHANGE_EVENT } from "@/demo/overlay";
import { reloadClientDb } from "@/demo/context";
import { TEAM_CHANNELS } from "@/features/channel-team/fixtures";
import { readActiveChannelId } from "@/features/channel-team/storage";
import { isDemoBuild } from "@/lib/demoMode";
import {
  demoShopIdentities,
  resolveLegacyShopChannel,
  resolveShopIdentity,
  type ShopPlatform,
} from "@/lib/demoShopLinks";

export const STORE_VIEWER_KEY = "cylixstudio-demo:store-viewer:v1";
export const STORE_VIEWER_EVENT = "cylixstudio-demo:store-viewer-change";
const overlaySchema = z.object({
  v: z.literal(1),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
const rewardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  cost: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative().nullable(),
  image_url: z.string().nullish(),
  is_active: z.boolean(),
  enabled: z.boolean().optional(),
});
const memberSchema = z.object({
  id: z.string(),
  display_name: z.string(),
  points: z.number().int().nonnegative(),
  level: z.number().nonnegative().nullish(),
  watch_seconds: z.number().nonnegative().nullish(),
});
export type StoreReward = z.infer<typeof rewardSchema>;
export type StoreMember = z.infer<typeof memberSchema>;
export type StoreChannel = {
  id: string;
  slug: string;
  name: string;
  avatar: string;
  description: string;
};
export type StoreViewer = { id: string; name: string; avatar: string };
export type Storefront = {
  channel: StoreChannel;
  rewards: StoreReward[];
  viewers: StoreViewer[];
  viewer: StoreViewer | null;
  member: StoreMember | null;
};
export type StoreFailure =
  | "signed_out"
  | "insufficient_points"
  | "out_of_stock"
  | "unavailable"
  | "invalid_request"
  | "storage_failed"
  | "load_failed";
export class StorefrontError extends Error {
  constructor(public readonly reason: StoreFailure) {
    super(reason);
  }
}

export function storeAvatar(initials: string): string {
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect width="96" height="96" rx="28" fill="#202020"/><text x="48" y="57" text-anchor="middle" fill="#bee1fc" font-family="sans-serif" font-size="28">${initials.replace(/[^a-z0-9]/gi, "").slice(0, 2)}</text></svg>`)}`;
}

function assertDemo() {
  if (!isDemoBuild()) throw new StorefrontError("unavailable");
}

export function readChannelSnapshot(channelId: string): DemoSnapshot {
  assertDemo();
  const db = createSeededDb(channelId);
  const raw = window.localStorage.getItem(dbKeyFor(channelId));
  if (raw !== null) applyOverlay(db, overlaySchema.parse(JSON.parse(raw)));
  return db.snapshot();
}

export function resolveStoreChannel(slug: string, platform?: ShopPlatform): StoreChannel | null {
  assertDemo();
  const key = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(key)) return null;
  const identities = demoShopIdentities(readChannelSnapshot);
  const channelId = platform
    ? resolveShopIdentity(identities, platform, slug)?.channelId
    : resolveLegacyShopChannel(slug, readChannelSnapshot, identities);
  const channel = TEAM_CHANNELS.find((row) => row.id === channelId);
  if (!channel) return null;
  const snapshot = readChannelSnapshot(channel.id);
  const profile = snapshot["link_in_bio_profiles"]?.[0];
  const name =
    typeof profile?.["display_name"] === "string" && profile["display_name"].trim()
      ? profile["display_name"].trim()
      : channel.id === "own"
        ? "DemoUser"
        : channel.name;
  const avatar = typeof profile?.["avatar_url"] === "string" ? profile["avatar_url"] : "";
  return {
    id: channel.id,
    slug: channel.handle,
    name,
    avatar: safeStoreImage(avatar) || storeAvatar(channel.handle.slice(0, 2)),
    description: typeof profile?.["bio"] === "string" ? profile["bio"] : "",
  };
}

export function safeStoreImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (/^https?:\/\//i.test(value) || /^data:image\/(png|jpeg|webp|gif|svg\+xml)[;,]/i.test(value))
    return value;
  return null;
}

export function storeViewers(): StoreViewer[] {
  const members = createSeededDb("own").rows("loyalty_members");
  const chosen = [members[0], members[members.length - 1]];
  return chosen.map((row) => {
    const member = memberSchema.parse(row);
    return {
      id: member.id,
      name: member.display_name,
      avatar: storeAvatar(member.display_name.slice(0, 2)),
    };
  });
}

export function selectedStoreViewer(): StoreViewer | null {
  const id = window.localStorage.getItem(STORE_VIEWER_KEY);
  return storeViewers().find((viewer) => viewer.id === id) ?? null;
}

export function selectStoreViewer(id: string | null) {
  assertDemo();
  if (id !== null && !storeViewers().some((viewer) => viewer.id === id))
    throw new StorefrontError("invalid_request");
  if (id === null) window.localStorage.removeItem(STORE_VIEWER_KEY);
  else window.localStorage.setItem(STORE_VIEWER_KEY, id);
  window.dispatchEvent(new Event(STORE_VIEWER_EVENT));
}

function memberFor(snapshot: DemoSnapshot, viewer: StoreViewer, channelId: string): StoreMember {
  const existing = snapshot["loyalty_members"]?.find((row) => row["id"] === viewer.id);
  if (existing) return memberSchema.parse(existing);
  // Explicit fictional memberships for the same viewer on the other demo channels.
  const first = storeViewers()[0]?.id === viewer.id;
  return {
    id: viewer.id,
    display_name: viewer.name,
    points: first ? (channelId === "streamer-a" ? 1800 : 900) : 80,
    level: null,
    watch_seconds: null,
  };
}

export function readStorefront(channel: StoreChannel): Storefront {
  const snapshot = readChannelSnapshot(channel.id);
  const viewer = selectedStoreViewer();
  return {
    channel,
    rewards: (snapshot["loyalty_shop_items"] ?? [])
      .map((row) => rewardSchema.parse(row))
      .filter((row) => row.is_active),
    viewers: storeViewers(),
    viewer,
    member: viewer ? memberFor(snapshot, viewer, channel.id) : null,
  };
}

export type RedemptionRequest = {
  channelId: string;
  viewerId: string;
  rewardId: string;
  requestId: string;
  expectedCost: number;
};

export function redeemStoreSnapshot(
  snapshot: DemoSnapshot,
  request: RedemptionRequest,
  viewer: StoreViewer,
): DemoSnapshot {
  if (
    viewer.id !== request.viewerId ||
    !request.requestId ||
    !TEAM_CHANNELS.some((row) => row.id === request.channelId)
  ) {
    throw new StorefrontError("invalid_request");
  }
  const receipts = snapshot["demo_store_receipts"] ?? [];
  const previous = receipts.find((row) => row["id"] === request.requestId);
  if (previous) {
    if (
      previous["viewer_id"] !== viewer.id ||
      previous["reward_id"] !== request.rewardId ||
      previous["channel_id"] !== request.channelId
    ) {
      throw new StorefrontError("invalid_request");
    }
    return snapshot;
  }
  const raw = snapshot["loyalty_shop_items"]?.find((row) => row["id"] === request.rewardId);
  if (!raw) throw new StorefrontError("unavailable");
  const reward = rewardSchema.parse(raw);
  if (!reward.is_active || reward.enabled === false || reward.cost !== request.expectedCost)
    throw new StorefrontError("unavailable");
  if (reward.stock !== null && reward.stock <= 0) throw new StorefrontError("out_of_stock");
  const member = memberFor(snapshot, viewer, request.channelId);
  if (member.points < reward.cost) throw new StorefrontError("insufficient_points");
  const now = new Date().toISOString();
  const updated = {
    ...member,
    user_id: raw["user_id"],
    points: member.points - reward.cost,
    updated_at: now,
  };
  const members = snapshot["loyalty_members"] ?? [];
  const sale = {
    id: request.requestId,
    user_id: raw["user_id"],
    member_id: member.id,
    item_name: reward.name,
    points: reward.cost,
    created_at: now,
  };
  return {
    ...snapshot,
    loyalty_members: members.some((row) => row["id"] === member.id)
      ? members.map((row) => (row["id"] === member.id ? { ...row, ...updated } : row))
      : [...members, updated],
    loyalty_shop_items: (snapshot["loyalty_shop_items"] ?? []).map((row) =>
      row["id"] === reward.id
        ? { ...row, stock: reward.stock === null ? null : reward.stock - 1, updated_at: now }
        : row,
    ),
    loyalty_sales: [sale, ...(snapshot["loyalty_sales"] ?? [])],
    demo_store_receipts: [
      ...receipts,
      {
        id: request.requestId,
        channel_id: request.channelId,
        viewer_id: viewer.id,
        reward_id: reward.id,
        created_at: now,
      },
    ],
  };
}

export async function redeemStoreReward(request: RedemptionRequest): Promise<void> {
  assertDemo();
  if (!navigator.locks) throw new StorefrontError("storage_failed");
  await navigator.locks.request(`cylix-demo-store:${request.channelId}`, () => {
    const viewer = selectedStoreViewer();
    if (!viewer || viewer.id !== request.viewerId) throw new StorefrontError("signed_out");
    const snapshot = readChannelSnapshot(request.channelId);
    const next = redeemStoreSnapshot(snapshot, request, viewer);
    if (next === snapshot) return;
    const key = dbKeyFor(request.channelId);
    const raw = window.localStorage.getItem(key);
    const overlay =
      raw === null ? { v: 1 as const, tables: {} } : overlaySchema.parse(JSON.parse(raw));
    // One durable write commits the balance, stock, sale and idempotency receipt together.
    const tables = { ...overlay.tables };
    for (const table of [
      "loyalty_members",
      "loyalty_shop_items",
      "loyalty_sales",
      "demo_store_receipts",
    ]) {
      tables[table] = next[table] ?? [];
    }
    window.localStorage.setItem(key, JSON.stringify({ v: 1, tables }));
    if (readActiveChannelId() === request.channelId) reloadClientDb();
    window.dispatchEvent(new Event(DEMO_CHANGE_EVENT));
  });
}
