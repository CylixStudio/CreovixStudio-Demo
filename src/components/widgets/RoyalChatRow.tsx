import { useState, type CSSProperties, type ReactNode } from "react";
import {
  royalCompactFill,
  royalCompactLayout,
  type RoyalCompactSettings,
} from "@/lib/royalCompact";

function RoyalAvatar({
  url,
  size,
  name,
  color,
}: {
  url?: string | null | undefined;
  size: number;
  name: string;
  color: string;
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const safe = url && /^(https:|data:image\/)/i.test(url) && url !== failedUrl ? url : null;
  return (
    <span
      data-royal-avatar=""
      style={{
        width: size,
        height: size,
        boxSizing: "border-box",
        borderRadius: "50%",
        border: `1.5px solid ${color}`,
        padding: 2,
        overflow: "hidden",
        flex: "0 0 auto",
        display: "grid",
        placeItems: "center",
        background: "rgba(12,12,16,0.9)",
        color,
        fontSize: Math.round(size * 0.42),
        fontWeight: 700,
        lineHeight: 1,
      }}
    >
      {safe ? (
        <img
          src={safe}
          alt=""
          onError={() => setFailedUrl(safe)}
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : (
        <span dir="auto">{[...name.trim()][0] || "?"}</span>
      )}
    </span>
  );
}

/** One face for the picker, studio preview and Browser Source. No data fetching. */
export function RoyalChatRow({
  settings,
  name,
  nameContent,
  color,
  textColor,
  avatarUrl,
  badges,
  platform,
  children,
}: {
  settings: RoyalCompactSettings;
  name: string;
  nameContent?: ReactNode;
  color: string;
  textColor: string;
  avatarUrl?: string | null | undefined;
  badges?: ReactNode;
  platform?: ReactNode;
  children: ReactNode;
}) {
  const layout = royalCompactLayout(settings);
  return (
    <div
      data-royal-face=""
      dir="ltr"
      style={{
        display: "flex",
        alignItems: "center",
        gap: layout.gap,
        width: "fit-content",
        maxWidth: "100%",
        minWidth: 0,
        background: "transparent",
      }}
    >
      {settings.showAvatar ? (
        <RoyalAvatar url={avatarUrl} size={layout.avatar} name={name} color={color} />
      ) : null}
      <div
        data-royal-row=""
        className="royal-chat-surface"
        style={
          {
            "--royal-accent": color,
            position: "relative",
            boxSizing: "border-box",
            width: "fit-content",
            maxWidth: settings.showAvatar ? `calc(100% - ${layout.avatar + layout.gap}px)` : "100%",
            minWidth: 0,
            minHeight: layout.minHeight,
            padding: layout.padding,
            borderRadius: layout.radius,
            borderLeft: `2px solid ${color}`,
            backgroundColor: royalCompactFill(color, settings.bubbleOpacity),
            fontSize: layout.fontSize,
            lineHeight: 1.5,
            color: textColor,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
            direction: "ltr",
          } as CSSProperties
        }
      >
        <span
          data-royal-identity=""
          style={{
            display: "inline",
            whiteSpace: "normal",
            unicodeBidi: "isolate",
          }}
        >
          {platform ? <span className="royal-chat-badges">{platform}</span> : null}
          {badges ? <span className="royal-chat-badges">{badges}</span> : null}
          <bdi data-royal-name="" dir="auto" style={{ color, fontWeight: 750 }}>
            {nameContent ?? name}
          </bdi>
          <span style={{ color: textColor, paddingInline: "4px 5px" }}>:</span>
        </span>
        <bdi data-royal-text="" dir="auto" style={{ unicodeBidi: "isolate", fontWeight: 600 }}>
          {children}
        </bdi>
      </div>
    </div>
  );
}
