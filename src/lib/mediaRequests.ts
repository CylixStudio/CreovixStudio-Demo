/** Platforms viewers can paste into chat / channel-point requests. */
export type MediaPlatform = "YOUTUBE" | "SPOTIFY" | "ANGHAMI" | "SOUNDCLOUD";

export type ParsedMediaUrl = {
  platform: MediaPlatform;
  sourceId: string;
  url: string;
};

/**
 * First matching media URL in free text (chat, Kick redemption input, diagnostics).
 * Covers typical watch / track / song / short-link hosts plus `spotify:track:`.
 */
export const MEDIA_URL_PATTERN =
  /(?:https?:\/\/(?:(?:www|m|music|open|play|on)\.)?(?:youtube\.com|youtu\.be|spotify\.com|spotify\.link|anghami\.com|soundcloud\.com)\/[^\s"'<>]+|spotify:track:[A-Za-z0-9]+)/i;

const TRAILING_PUNCT = /[),.;]+$/;

export const MEDIA_PLATFORM_LABEL: Record<MediaPlatform, string> = {
  YOUTUBE: "YouTube",
  SPOTIFY: "Spotify",
  ANGHAMI: "Anghami",
  SOUNDCLOUD: "SoundCloud",
};

/** What the OBS overlay can legally do with each platform. */
export type MediaPlaybackMode = "youtube" | "soundcloud" | "spotify-embed" | "anghami-widget" | "link";

export function normalizeMediaPlatform(value: unknown): MediaPlatform {
  const key = String(value ?? "").trim().toUpperCase();
  if (key === "SPOTIFY") return "SPOTIFY";
  if (key === "ANGHAMI") return "ANGHAMI";
  if (key === "SOUNDCLOUD") return "SOUNDCLOUD";
  return "YOUTUBE";
}

export function mediaPlatformLabel(value: unknown): string {
  return MEDIA_PLATFORM_LABEL[normalizeMediaPlatform(value)];
}

/**
 * Overlay / studio honesty:
 * - YouTube: existing official embed plays the video (or hidden audio) in OBS.
 * - SoundCloud: official widget can play the track in OBS.
 * - Spotify: official embed iframe only — usually a preview unless that browser
 *   session is logged into Spotify. Full tracks are a link-out.
 * - Anghami: official oEmbed widget when it loads; otherwise metadata + open link.
 *   Full catalog playback is not guaranteed in OBS.
 */
export function mediaPlaybackMode(platform: unknown): MediaPlaybackMode {
  switch (normalizeMediaPlatform(platform)) {
    case "YOUTUBE":
      return "youtube";
    case "SOUNDCLOUD":
      return "soundcloud";
    case "SPOTIFY":
      return "spotify-embed";
    case "ANGHAMI":
      return "anghami-widget";
  }
}

export function mediaPlaybackHint(platform: unknown): string {
  switch (normalizeMediaPlatform(platform)) {
    case "YOUTUBE":
      return "Plays in OBS through the YouTube player.";
    case "SOUNDCLOUD":
      return "Plays in OBS through the official SoundCloud widget.";
    case "SPOTIFY":
      return "OBS shows Spotify’s official embed (often a preview). Open Spotify for the full track.";
    case "ANGHAMI":
      return "OBS shows Anghami’s official widget when it loads. Open Anghami for the full track.";
  }
}

export function extractYouTubeId(input: string): string | null {
  const text = input.trim();
  const direct = text.match(/^[A-Za-z0-9_-]{11}$/)?.[0];
  if (direct) return direct;
  const match = text.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|shorts\/|embed\/|live\/|v\/)|(?:^|\s)v=)([A-Za-z0-9_-]{11})/i,
  );
  if (match?.[1]) return match[1];
  const loose = text.match(/(?:youtube|youtu)[^\s]*?([A-Za-z0-9_-]{11})(?:[?&#\s]|$)/i);
  return loose?.[1] ?? null;
}

export function extractMediaUrl(text: string): string | null {
  const match = text.match(MEDIA_URL_PATTERN)?.[0];
  return match ? match.replace(TRAILING_PUNCT, "") : null;
}

function cleanUrl(value: string): string {
  return value.trim().replace(TRAILING_PUNCT, "");
}

/** Detects platform + canonical source id from a URL, URI, or raw YouTube id. */
export function parseMediaUrl(input: string): ParsedMediaUrl | null {
  const text = cleanUrl(input);
  if (!text) return null;

  const uri = text.match(/spotify:track:([A-Za-z0-9]+)/i);
  if (uri?.[1]) {
    return { platform: "SPOTIFY", sourceId: uri[1], url: `https://open.spotify.com/track/${uri[1]}` };
  }

  const found = extractMediaUrl(text) ?? (/^https?:\/\//i.test(text) ? text : null);
  if (!found) {
    const videoId = extractYouTubeId(text);
    if (!videoId) return null;
    return { platform: "YOUTUBE", sourceId: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  const raw = cleanUrl(found);
  const lower = raw.toLowerCase();

  if (lower.includes("youtu.be") || lower.includes("youtube.com")) {
    const videoId = extractYouTubeId(raw);
    if (!videoId) return null;
    return { platform: "YOUTUBE", sourceId: videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  }

  if (lower.includes("spotify")) {
    const track = raw.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?track\/([A-Za-z0-9]+)/i)
      ?? raw.match(/spotify:track:([A-Za-z0-9]+)/i);
    if (track?.[1]) {
      return { platform: "SPOTIFY", sourceId: track[1], url: `https://open.spotify.com/track/${track[1]}` };
    }
    const other = raw.match(/spotify\.com\/(?:intl-[a-z]{2}\/)?(?:embed\/)?(album|playlist|episode)\/([A-Za-z0-9]+)/i);
    if (other?.[1] && other[2]) {
      return {
        platform: "SPOTIFY",
        sourceId: `${other[1]}:${other[2]}`,
        url: `https://open.spotify.com/${other[1]}/${other[2]}`,
      };
    }
    const short = raw.match(/spotify\.link\/([A-Za-z0-9]+)/i);
    if (short?.[1]) return { platform: "SPOTIFY", sourceId: `link:${short[1]}`, url: raw.split("?")[0] ?? raw };
    return null;
  }

  if (lower.includes("anghami.com")) {
    const song = raw.match(/anghami\.com\/(?:song|track|play)\/([A-Za-z0-9_-]+)/i);
    if (!song?.[1]) return null;
    return { platform: "ANGHAMI", sourceId: song[1], url: `https://play.anghami.com/song/${song[1]}` };
  }

  if (lower.includes("soundcloud.com")) {
    try {
      const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parsed.hostname.includes("on.soundcloud.com") && parts[0]) {
        return { platform: "SOUNDCLOUD", sourceId: `on:${parts[0]}`, url: `https://on.soundcloud.com/${parts[0]}` };
      }
      const user = parts[0]?.toLowerCase();
      if (!user || ["you", "discover", "feed", "search", "pages", "mobile"].includes(user)) return null;
      if (parts.length < 2) return null;
      return {
        platform: "SOUNDCLOUD",
        sourceId: `${parts[0]}/${parts[1]}`.toLowerCase(),
        url: `https://soundcloud.com/${parts[0]}/${parts[1]}`,
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function mediaArtworkUrl(input: {
  platform?: string | null;
  youtube_video_id?: string | null;
  thumbnail_url?: string | null;
}): string | null {
  if (input.thumbnail_url) return input.thumbnail_url;
  if (normalizeMediaPlatform(input.platform) === "YOUTUBE" && input.youtube_video_id) {
    return `https://i.ytimg.com/vi/${input.youtube_video_id}/mqdefault.jpg`;
  }
  return null;
}

export function mediaOpenUrl(input: {
  platform?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
}): string {
  const parsed = input.youtube_url ? parseMediaUrl(input.youtube_url) : null;
  if (parsed) return parsed.url;
  if (normalizeMediaPlatform(input.platform) === "YOUTUBE" && input.youtube_video_id) {
    return `https://www.youtube.com/watch?v=${input.youtube_video_id}`;
  }
  return input.youtube_url ?? "";
}

/** Official embed src when the platform publishes one. Never a ripped stream. */
export function mediaEmbedSrc(input: {
  platform?: string | null;
  youtube_video_id?: string | null;
  youtube_url?: string | null;
  audioOnly?: boolean;
}): string | null {
  const platform = normalizeMediaPlatform(input.platform);
  const parsed = input.youtube_url ? parseMediaUrl(input.youtube_url) : null;
  const sourceId = parsed?.sourceId ?? input.youtube_video_id ?? "";
  const url = parsed?.url ?? mediaOpenUrl(input);
  if (!sourceId && platform !== "SOUNDCLOUD") return null;

  if (platform === "YOUTUBE") {
    const controls = input.audioOnly ? "" : "&controls=0";
    return `https://www.youtube.com/embed/${sourceId}?autoplay=1&enablejsapi=1${controls}&rel=0&playsinline=1`;
  }
  if (platform === "SOUNDCLOUD") {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&auto_play=true&hide_related=true&show_comments=false&show_user=false&visual=true`;
  }
  if (platform === "SPOTIFY") {
    const [kind, id] = sourceId.includes(":") ? sourceId.split(":") : ["track", sourceId];
    if (!id || kind === "link") return null;
    const type = kind === "album" || kind === "playlist" || kind === "episode" ? kind : "track";
    return `https://open.spotify.com/embed/${type}/${id}`;
  }
  return `https://widget.anghami.com/song/${sourceId}`;
}
