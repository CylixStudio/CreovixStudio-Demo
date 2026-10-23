import { z } from "zod";

import type { ShopIdentity } from "@/lib/demoShopLinks";

export const SHOP_ROUTING_COOKIE = "cylix_demo_shop_routes";
const username = z.string().regex(/^[a-z0-9_]{1,32}$/i);
const hintsSchema = z
  .array(
    z.object({
      channelId: z.literal("own"),
      platform: z.enum(["kick", "twitch"]),
      platformId: z.string().max(100),
      username,
      previousUsernames: z.array(username).max(16),
    }),
  )
  .max(2)
  .refine((hints) => new Set(hints.map((hint) => hint.platform)).size === hints.length);

export function parseShopRoutingHints(value: string | undefined): ShopIdentity[] | null {
  if (value === undefined) return null;
  try {
    return hintsSchema.parse(JSON.parse(decodeURIComponent(value)));
  } catch {
    return null;
  }
}

export function mergeShopRoutingHints(
  defaults: ShopIdentity[],
  hints: ShopIdentity[] | null,
): ShopIdentity[] {
  if (hints === null) return defaults;
  // This public routing hint is never authentication or authorization.
  // Only the bundled platform IDs can override a name on the visitor's own demo channel.
  if (
    hints.some(
      (hint) =>
        !defaults.some(
          (identity) =>
            identity.channelId === "own" &&
            identity.platform === hint.platform &&
            identity.platformId === hint.platformId,
        ),
    )
  )
    return defaults;
  return [...defaults.filter((identity) => identity.channelId !== "own"), ...hints];
}

export function writeShopRoutingHints(identities: ShopIdentity[]) {
  if (typeof document === "undefined") return;
  const hints = identities
    .filter((identity) => identity.channelId === "own")
    .map((identity) => ({
      ...identity,
      previousUsernames: [...new Set(identity.previousUsernames)].slice(-16),
    }));
  const checked = hintsSchema.safeParse(hints);
  if (!checked.success) {
    console.error("[demo-shop] routing_hints_invalid");
    return;
  }
  const value = encodeURIComponent(JSON.stringify(checked.data));
  if (value.length > 3500) {
    console.error("[demo-shop] routing_hints_too_large");
    return;
  }
  document.cookie = `${SHOP_ROUTING_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
}
