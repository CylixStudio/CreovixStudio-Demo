import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";

import { DemoPointsStore } from "@/components/public/DemoPointsStore";
import { readChannelSnapshot } from "@/lib/demoStorefront";
import { writeShopRoutingHints } from "@/lib/demoShopRoutingHints";
import {
  demoShopIdentities,
  primaryShopIdentity,
  resolveLegacyShopChannel,
  resolveShopIdentity,
  shortShopPath,
  type ShopPlatform,
} from "@/lib/demoShopLinks";

export function DemoShopRoute({
  username,
  platform,
}: {
  username: string;
  platform?: ShopPlatform;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    // A document request cannot carry localStorage. Reconcile local identity edits after hydration.
    try {
      const identities = demoShopIdentities(readChannelSnapshot);
      writeShopRoutingHints(identities);
      const identity = platform
        ? resolveShopIdentity(identities, platform, username)
        : primaryShopIdentity(
            resolveLegacyShopChannel(username, readChannelSnapshot, identities) ?? "",
            identities,
          );
      if (identity && (!platform || username !== identity.username)) {
        void navigate({ href: shortShopPath(identity), replace: true });
      }
    } catch {
      // The storefront renders the storage error; do not redirect using untrusted defaults.
      console.error("[demo-shop] identity_storage_invalid");
    }
  }, [navigate, platform, username]);
  return (
    <DemoPointsStore
      key={`${platform ?? "legacy"}:${username}`}
      slug={username}
      {...(platform ? { platform } : {})}
    />
  );
}
