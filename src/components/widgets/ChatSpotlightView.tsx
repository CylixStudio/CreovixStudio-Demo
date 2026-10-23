import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Pin, Quote } from "lucide-react";

import { ReplyAlertFrame } from "@/components/overlay/ReplyAlertFrame";
import { PlatformIcon } from "@/components/widgets/PlatformIcon";
import { RoleBadgeIcon, resolveBadgeRoles } from "@/components/widgets/RoleBadgeIcon";
import { useLiveChat, type ChatSources } from "@/hooks/useLiveChat";
import { useReplyAlertExpiry } from "@/hooks/useReplyAlertExpiry";
import { useLanguage } from "@/lib/i18n";
import { withAlpha } from "@/lib/overlayTheme";
import { parseChromeLayout } from "@/lib/widgetLayouts";
import { parseWidgetThemeId, widgetThemeSkin } from "@/lib/widgetThemes";
import { parseSpotlightConfig, type SpotlightMessage } from "@/lib/widgets";

const SPOTLIGHT_FADE_MS = 500;

function spotlightKey(message: SpotlightMessage | null) {
  return message ? `${message.id}:${message.nonce}` : "";
}

function BadgeImg({ src, label }: { src: string; label: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <img
      src={src}
      alt={label}
      title={label}
      onError={() => setFailed(true)}
      style={{
        width: 18,
        height: 18,
        objectFit: "contain",
        imageRendering: "pixelated",
        flexShrink: 0,
        display: "inline-block",
        verticalAlign: "middle",
        marginInlineEnd: 0,
      }}
    />
  );
}

function EmoteImg({ id, name }: { id: string; name: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <>{name}</>;
  return (
    <img
      src={`https://files.kick.com/emotes/${id}/fullsize`}
      alt={name}
      title={name}
      onError={() => setFailed(true)}
      style={{
        height: 28,
        width: "auto",
        display: "inline-block",
        verticalAlign: "middle",
        margin: "0 4px",
      }}
    />
  );
}

const KICK_EMOTE_RE = /\[emote:(\d+):([\w-]+)\]/g;

function renderChatText(text: string): ReactNode {
  if (!text.includes("[emote:")) return text;
  const parts: ReactNode[] = [];
  let last = 0;
  KICK_EMOTE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KICK_EMOTE_RE.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(<EmoteImg key={`${match[1]}-${match.index}`} id={match[1]!} name={match[2]!} />);
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** Presentation-only surface shared with the builder's actual-layout thumbnails. */
export function PinnedMessageCard({
  config,
  message,
  motion = "shown",
}: {
  config: unknown;
  message: SpotlightMessage;
  motion?: "shown" | "exit" | "enter";
}) {
  const { lang } = useLanguage();
  const style = parseSpotlightConfig(config);
  const skin = widgetThemeSkin(parseWidgetThemeId(config));
  const accent = skin.accentColor ?? style.accentColor;
  const chrome = parseChromeLayout(config);
  const roles = style.showBadges ? resolveBadgeRoles(message.badges, 6) : [];
  const title = lang === "ar" ? "رسالة مثبتة" : "PINNED MESSAGE";
  const surface = withAlpha(style.backgroundColor, style.backgroundOpacity);
  const outline = `1px solid ${withAlpha(accent, 35)}`;
  const { border: _skinBorder, ...skinSurface } = skin.surface;
  const base: CSSProperties = {
    ...skinSurface,
    ...skin.text,
    boxSizing: "border-box",
    width: "100%",
    minWidth: 0,
    maxWidth: 560,
    fontFamily: skin.fontFamily ?? style.fontFamily,
    color: style.textColor,
    background: surface,
    borderTop: outline,
    borderRight: outline,
    borderBottom: outline,
    borderLeft: outline,
    borderRadius: 20,
    padding: 24,
    overflowWrap: "anywhere",
  };
  const badgeStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: Math.max(9, Math.round(style.fontSize * 0.36)),
    fontWeight: 800,
    letterSpacing: lang === "ar" ? 0 : "0.16em",
    color: accent,
  };
  const pinLabel = (
    <span style={badgeStyle}>
      <Pin size={12} aria-hidden />
      {title}
    </span>
  );
  const author = (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2"
      style={{ fontSize: Math.max(13, Math.round(style.fontSize * 0.72)), fontWeight: 800 }}
    >
      {style.showPlatform ? <PlatformIcon platform={message.platform} size={18} /> : null}
      {message.badgeImages.map((badge, index) =>
        badge.imageUrl ? (
          <BadgeImg key={`${badge.label}-${index}`} src={badge.imageUrl} label={badge.label} />
        ) : null,
      )}
      {roles.map((role) => (
        <RoleBadgeIcon key={role} role={role} platform={message.platform} size={18} />
      ))}
      <span
        dir="auto"
        style={{ color: message.color ?? accent, minWidth: 0, overflowWrap: "anywhere" }}
      >
        {message.author}
      </span>
    </div>
  );
  const text = (
    <p
      dir="auto"
      style={{
        fontSize: style.fontSize,
        fontWeight: 600,
        lineHeight: 1.4,
        wordBreak: "break-word",
        overflowWrap: "anywhere",
        minWidth: 0,
        margin: 0,
      }}
    >
      {renderChatText(message.text)}
    </p>
  );
  let content: ReactNode;
  let decoration: CSSProperties = {};
  const redesigned = ["glass", "direct", "lower-third", "bold", "message", "split"].includes(
    chrome,
  );
  if (redesigned) {
    return (
      <article
        data-layout-content
        data-pinned-layout={chrome}
        data-motion={motion}
        className={`overlay-spotlight-swap premium-pin premium-pin-${chrome}`}
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={
          {
            fontFamily: skin.fontFamily ?? style.fontFamily,
            color: style.textColor,
            "--pin-surface": surface,
            "--pin-accent": accent,
          } as CSSProperties
        }
      >
        {chrome === "direct" ? (
          <>
            <span className="premium-pin-stamp">
              <Pin size={18} />
            </span>
            <div>
              {pinLabel}
              {text}
              <footer>{author}</footer>
            </div>
          </>
        ) : chrome === "glass" ? (
          <>
            <aside className="premium-pin-portrait">
              <span>{Array.from(message.author.trim())[0] ?? "?"}</span>
              {author}
            </aside>
            <div className="premium-pin-paper">
              {pinLabel}
              {text}
            </div>
          </>
        ) : chrome === "bold" ? (
          <>
            <header>
              {pinLabel}
              <Quote size={32} strokeWidth={1} />
            </header>
            <div className="premium-pin-quote">{text}</div>
            <footer>
              <span className="premium-pin-byline" />
              {author}
            </footer>
          </>
        ) : chrome === "lower-third" ? (
          <>
            <div className="premium-pin-caption">
              <span>{Array.from(message.author.trim())[0] ?? "?"}</span>
              {author}
              {pinLabel}
            </div>
            <div className="premium-pin-subtitle">{text}</div>
          </>
        ) : chrome === "message" ? (
          <>
            <div className="premium-pin-toast">
              <Pin size={15} />
              {pinLabel}
            </div>
            <div className="premium-pin-conversation">
              {author}
              {text}
            </div>
            <span className="premium-pin-orbit-avatar">
              {Array.from(message.author.trim())[0] ?? "?"}
            </span>
          </>
        ) : (
          <>
            <aside>
              {pinLabel}
              <Quote size={26} />
              {author}
            </aside>
            <div className="premium-pin-feature">{text}</div>
            <span className="premium-pin-bookmark" />
          </>
        )}
      </article>
    );
  }

  switch (chrome) {
    case "pill":
      decoration = {
        maxWidth: 760,
        borderRadius: 48,
        padding: "16px 24px",
        boxShadow: `0 12px 32px ${withAlpha(accent, 12)}`,
      };
      content = (
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full"
            style={{ background: withAlpha(accent, 18), color: accent }}
          >
            <Pin size={20} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            {author}
            {text}
          </div>
        </div>
      );
      break;

    case "featured":
      decoration = {
        maxWidth: 640,
        borderRadius: 26,
        padding: "28px 32px",
        borderTop: `4px solid ${accent}`,
        background: `linear-gradient(150deg, ${withAlpha(accent, 12)}, transparent 65%), ${surface}`,
      };
      content = (
        <div className="flex flex-col items-center gap-5 text-center">
          {pinLabel}
          <Quote size={40} strokeWidth={1.4} style={{ color: accent }} aria-hidden />
          {text}
          <span className="h-px w-12" style={{ background: accent }} />
          {author}
        </div>
      );
      break;
  }

  return (
    <div
      className="overlay-spotlight-swap"
      data-layout-content
      data-motion={motion}
      data-pinned-layout={chrome}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ ...base, ...decoration }}
    >
      {content}
    </div>
  );
}

/** Pin selection, reply expiry, entry/exit and creator auto-hide match the chat runtime. */
export function ChatSpotlightView({
  config,
  spotlight,
  chat = null,
  demo = false,
}: {
  config: unknown;
  spotlight: SpotlightMessage | null;
  chat?: ChatSources | null;
  demo?: boolean;
}) {
  const { pinnedLive } = useLiveChat(chat, 1);
  const style = parseSpotlightConfig(config);
  const [dismissedKey, setDismissedKey] = useState("");
  const [display, setDisplay] = useState<SpotlightMessage | null>(null);
  const [motion, setMotion] = useState<"shown" | "exit" | "enter">("enter");
  const shownKeyRef = useRef("");

  const livePin: SpotlightMessage | null = pinnedLive
    ? {
        id: pinnedLive.id,
        platform: pinnedLive.platform,
        author: pinnedLive.author,
        color: pinnedLive.color ?? null,
        text: pinnedLive.text,
        badges: pinnedLive.badges,
        badgeImages: (pinnedLive.badgeList ?? []).map((badge) => ({
          label: badge.text || badge.type,
          imageUrl: badge.imageUrl ?? null,
        })),
        pinnedAt: new Date(pinnedLive.at).toISOString(),
        nonce: pinnedLive.at,
        isReply: pinnedLive.isReply === true,
        replyQuote: pinnedLive.replyQuote ?? null,
        appearedAt: new Date(pinnedLive.at).toISOString(),
      }
    : null;

  const incoming: SpotlightMessage | null =
    (livePin && (!spotlight || Date.parse(spotlight.pinnedAt) < pinnedLive!.at)
      ? livePin
      : spotlight) ??
    (demo
      ? {
          id: "demo",
          platform: "TWITCH",
          author: "CylixFan",
          color: "#A78BFA",
          text: "This message is featured on stream ✨",
          badges: ["broadcaster", "subscriber"],
          badgeImages: [],
          pinnedAt: new Date().toISOString(),
          nonce: 0,
        }
      : null);

  const incomingKey = spotlightKey(incoming);
  const pinned = incoming && incomingKey !== dismissedKey ? incoming : null;
  const replyLife = useReplyAlertExpiry(pinned ? [pinned] : [], {
    enabled: !demo,
    getId: (message) => message.id,
    isReply: (message) => message.isReply === true,
    appearanceMs: (message) => {
      const parsed = Date.parse(message.appearedAt ?? message.pinnedAt);
      return Number.isFinite(parsed) ? parsed : null;
    },
  });
  const visiblePin = replyLife.items[0] ?? null;
  const pinKey = spotlightKey(visiblePin);
  const replyFading = Boolean(visiblePin?.isReply && replyLife.fadingIds.has(visiblePin.id));

  useEffect(() => {
    if (pinKey === shownKeyRef.current) return;
    const hadCard = Boolean(shownKeyRef.current);
    if (hadCard) setMotion("exit");
    const wait = window.setTimeout(
      () => {
        shownKeyRef.current = pinKey;
        setDisplay(visiblePin);
        if (!visiblePin) {
          setMotion("exit");
          return;
        }
        setMotion("enter");
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => setMotion("shown"));
        });
      },
      hadCard ? SPOTLIGHT_FADE_MS : 16,
    );
    return () => window.clearTimeout(wait);
  }, [pinKey, visiblePin]);

  useEffect(() => {
    if (!display || style.autoHideMs <= 0) return;
    const fade = window.setTimeout(
      () => setMotion("exit"),
      Math.max(SPOTLIGHT_FADE_MS, style.autoHideMs - SPOTLIGHT_FADE_MS),
    );
    const hide = window.setTimeout(() => {
      setDismissedKey(spotlightKey(display));
      shownKeyRef.current = "";
      setDisplay(null);
    }, style.autoHideMs);
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(hide);
    };
  }, [display, style.autoHideMs]);

  if (!display) return <div className="h-0 w-0" aria-hidden />;

  return (
    <ReplyAlertFrame
      active={display.isReply === true}
      fading={replyFading || Boolean(display.isReply && visiblePin?.id !== display.id)}
      quote={display.replyQuote ?? null}
    >
      <PinnedMessageCard config={config} message={display} motion={motion} />
    </ReplyAlertFrame>
  );
}
