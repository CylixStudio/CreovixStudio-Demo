export type PlatformLivePreviewData =
  | { kind: "empty" }
  | { kind: "quiet"; message: string }
  | { kind: "need_key"; message: string }
  | {
      kind: "live";
      platform: "kick" | "twitch" | "youtube";
      title: string | null;
      viewers: number | null;
      thumbnailUrl: string | null;
      watchUrl: string;
    }
  | {
      kind: "offline";
      message: string;
      title: string | null;
      thumbnailUrl: string | null;
      watchUrl: string | null;
    }
  | {
      kind: "media";
      title: string | null;
      thumbnailUrl: string | null;
      author: string | null;
      watchUrl: string;
    }
  | {
      kind: "discord";
      name: string | null;
      members: number | null;
      online: number | null;
      inviteUrl: string;
    }
  | {
      kind: "favicon";
      host: string;
      faviconUrl: string;
      href: string;
    }
  | {
      kind: "profile";
      label: string;
      href: string;
      message: string;
    };
