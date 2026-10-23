import { CHAT_LAYOUTS, type ChatLayout } from "@/lib/widgets";
import { ROYAL_COMPACT_DEFAULTS, ROYAL_COMPACT_THEME_ID } from "@/lib/royalCompact";
import { RoyalChatRow } from "./RoyalChatRow";
import { RoleBadgeIcon } from "./RoleBadgeIcon";
import { useLanguage } from "@/lib/i18n";
import { ChatMessageFace } from "./ChatMessageFace";
import { LayoutThumbnail } from "./LayoutThumbnail";

function LayoutMini({ id }: { id: ChatLayout }) {
  if (id === "transparent") {
    return (
      <div className="flex h-14 items-center bg-transparent px-2 text-[10px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.85)]">
        Nova hello
      </div>
    );
  }
  if (["glass", "island", "bubble"].includes(id))
    return (
      <LayoutThumbnail height={90}>
        <div className={"w-[380px]"} style={{ fontSize: 22 }}>
          <ChatMessageFace
            layout={id}
            author="Nova"
            name={<bdi style={{ color: "#bee1fc", fontWeight: 700 }}>Nova</bdi>}
            color="#bee1fc"
          >
            {id === "glass"
              ? "A good moment, shared live."
              : id === "island"
                ? "Hello, everyone!"
                : "This stream feels like home."}
          </ChatMessageFace>
        </div>
      </LayoutThumbnail>
    );

  return (
    <div className="flex h-14 items-center px-2">
      <span className="w-full rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-[10px] text-white backdrop-blur">
        Nova hello
      </span>
    </div>
  );
}

function RoyalMini() {
  return (
    <div
      className="flex h-14 items-center overflow-hidden bg-transparent px-2"
      dir="ltr"
      aria-label="Demo chat preview"
    >
      <div
        style={{
          width: 200,
          flexShrink: 0,
          transform: "scale(0.55)",
          transformOrigin: "left center",
        }}
      >
        <RoyalChatRow
          settings={{ ...ROYAL_COMPACT_DEFAULTS, fontSize: 14, avatarSize: 38 }}
          name="Nova"
          color="#64D9B0"
          textColor="#ffffff"
          badges={<RoleBadgeIcon role="moderator" platform="KICK" size={16} />}
        >
          hello
        </RoyalChatRow>
      </div>
    </div>
  );
}

export function ChatThemePicker({
  layout,
  royalSelected,
  onSelectLayout,
  onSelectRoyal,
}: {
  layout: ChatLayout;
  royalSelected: boolean;
  onSelectLayout: (layout: ChatLayout) => void;
  onSelectRoyal: () => void;
}) {
  const { t, lang } = useLanguage();
  const card =
    "flex h-full min-w-0 flex-col overflow-hidden rounded-xl border bg-zinc-950/40 text-start transition-colors hover:border-primary/50";
  const nameClass =
    "flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 text-xs font-semibold leading-snug break-words";
  return (
    <div className="grid grid-cols-2 items-stretch gap-2">
      {CHAT_LAYOUTS.map((entry) => {
        const selected = !royalSelected && layout === entry.value;
        return (
          <button
            key={entry.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelectLayout(entry.value)}
            className={`${card} ${selected ? "border-primary" : "border-border"}`}
          >
            <div className="bg-[repeating-conic-gradient(#1c1d24_0%_25%,#121318_0%_50%)] bg-[length:12px_12px]">
              <LayoutMini id={entry.value} />
            </div>
            <span className={nameClass}>
              {lang === "ar"
                ? {
                    glass: "بصمة المرسل",
                    island: "شات عائم",
                    bubble: "سطر الشات الفاخر",
                    transparent: "شفاف بالكامل",
                  }[entry.value]
                : entry.label}
            </span>
          </button>
        );
      })}
      <button
        type="button"
        aria-pressed={royalSelected}
        data-theme-id={ROYAL_COMPACT_THEME_ID}
        onClick={onSelectRoyal}
        className={`${card} ${royalSelected ? "border-primary" : "border-border"}`}
      >
        <div className="bg-[repeating-conic-gradient(#1c1d24_0%_25%,#121318_0%_50%)] bg-[length:12px_12px]">
          <RoyalMini />
        </div>
        <span className={nameClass}>
          <span className="min-w-0 break-words">{t("chat.theme.royal")}</span>
          <span className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground">
            Pro
          </span>
        </span>
      </button>
    </div>
  );
}
