import { useEffect, useState } from "react";

/**
 * Real Twitch badge artwork, keyed by badge set id (e.g. "subscriber").
 * Twitch's public badge display endpoint needs no token, so the overlay can
 * render the official images and fall back to vector marks when it is blocked.
 */
export type TwitchBadgeUrls = Record<string, string>;

const GLOBAL_ENDPOINT = "https://badges.twitch.tv/v1/badges/global/display";

let cache: TwitchBadgeUrls | null = null;
let inflight: Promise<TwitchBadgeUrls> | null = null;

async function loadGlobalBadges(): Promise<TwitchBadgeUrls> {
  if (cache) return cache;
  inflight ??= (async () => {
    try {
      const response = await fetch(GLOBAL_ENDPOINT, { headers: { accept: "application/json" } });
      if (!response.ok) return {};
      const payload = (await response.json()) as {
        badge_sets?: Record<string, { versions?: Record<string, { image_url_2x?: string }> }>;
      };
      const urls: TwitchBadgeUrls = {};
      for (const [setId, set] of Object.entries(payload.badge_sets ?? {})) {
        const versions = Object.values(set.versions ?? {});
        const first = versions[0]?.image_url_2x;
        if (first) urls[setId] = first;
      }
      cache = urls;
      return urls;
    } catch {
      return {};
    }
  })();
  return inflight;
}

/** Loads the global Twitch badge image map once per page. */
export function useTwitchBadges(enabled: boolean): TwitchBadgeUrls {
  const [urls, setUrls] = useState<TwitchBadgeUrls>(cache ?? {});

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void loadGlobalBadges().then((result) => {
      if (active) setUrls(result);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  return urls;
}

/** Maps a canonical role back to the Twitch badge set id used by the API. */
export const TWITCH_BADGE_SET: Record<string, string> = {
  broadcaster: "broadcaster",
  moderator: "moderator",
  vip: "vip",
  subscriber: "subscriber",
  founder: "founder",
  turbo: "turbo",
  bits: "bits",
  gifter: "sub-gifter",
  staff: "staff",
  "global-admin": "admin",
  "global-moderator": "global_mod",
  verified: "partner",
};
