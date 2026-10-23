import { notFound, redirect } from "@tanstack/react-router";

import { createSeededDb } from "@/demo/overlay";
import { readChannelSnapshot } from "@/lib/demoStorefront";
import { readDemoShopRoutingHints } from "@/lib/demoShopRouting.functions";
import { mergeShopRoutingHints } from "@/lib/demoShopRoutingHints";
import {
  demoShopIdentities,
  primaryShopIdentity,
  resolveLegacyShopChannel,
  resolveShopIdentity,
  shortShopPath,
  type ShopPlatform,
} from "@/lib/demoShopLinks";

export const DEMO_SHOP_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie" };

export async function checkDemoShopRoute(username: string, platform?: ShopPlatform) {
  const read =
    typeof window === "undefined"
      ? (id: string) => createSeededDb(id).snapshot()
      : readChannelSnapshot;
  const defaults = demoShopIdentities(read);
  const identities =
    typeof window === "undefined"
      ? mergeShopRoutingHints(defaults, await readDemoShopRoutingHints())
      : defaults;
  const legacyChannel = platform ? null : resolveLegacyShopChannel(username, read, identities);
  const identity = platform
    ? resolveShopIdentity(identities, platform, username)
    : primaryShopIdentity(legacyChannel ?? "", identities);
  if (!platform && legacyChannel && !identity) return;
  if (!identity) throw notFound();
  const path = shortShopPath(identity);
  if (!platform || username !== identity.username) {
    throw redirect({ href: path, statusCode: 307, replace: true, headers: DEMO_SHOP_HEADERS });
  }
}
