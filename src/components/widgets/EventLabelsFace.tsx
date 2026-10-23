import { Activity, Radio, ArrowUpRight, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";
import type { EventLabelLayout } from "@/lib/widgetLayouts";

export function EventLabelsFace({
  layout,
  title,
  lines,
  active,
  motion,
  accent,
  color,
  fontFamily,
  fontSize,
  lang,
  textAnimation = "slide",
  textAlign = "start",
}: {
  layout: EventLabelLayout;
  title: string;
  lines: { key: string; text: string }[];
  active: number;
  motion: "shown" | "exit" | "enter";
  accent: string;
  color: string;
  fontFamily: string;
  fontSize: number;
  lang: "ar" | "en";
  textAnimation?: "slide" | "fade" | "none";
  textAlign?: "start" | "center" | "end";
}) {
  const selected = lines.length ? lines[active % lines.length] : null;
  const textSize = Math.max(16, fontSize * 0.52);
  const heading = (
    <span className="text-[11px] font-bold tracking-[0.16em]" style={{ color: accent }} dir="auto">
      {title}
    </span>
  );
  const current = selected ? (
    <span
      className="event-line-swap block break-words"
      data-motion={motion}
      style={{ fontSize: textSize }}
      dir="auto"
    >
      {selected.text}
    </span>
  ) : null;
  if (layout === "cycle")
    return (
      <div
        data-events-layout="cycle"
        data-layout-content
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{
          color,
          fontFamily,
          fontSize,
          textAlign,
          background: "transparent",
          minWidth: 260,
          maxWidth: "min(760px, calc(100vw - 48px))",
          overflowWrap: "anywhere",
        }}
      >
        <span
          className={`event-text-only event-text-${textAnimation}`}
          data-motion={motion}
          dir="auto"
        >
          {selected?.text ?? ""}
        </span>
      </div>
    );
  if (layout === "island" || layout === "ticker")
    return (
      <div
        data-events-layout={layout}
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={{ color, fontFamily }}
      >
        {layout === "island" ? (
          <div className="flex w-[460px] items-center gap-4 rounded-full border border-white/15 bg-[#101012] px-5 py-3">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10"
              style={{ color: accent }}
            >
              <Activity size={18} />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              {heading}
              {current}
            </div>
          </div>
        ) : (
          <div className="w-[640px] overflow-hidden py-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px w-6" style={{ background: accent }} />
              {heading}
            </div>
            <div className="overflow-hidden border-y border-white/10 py-3">
              <div
                className="event-ticker-track inline-block whitespace-nowrap"
                style={{ fontSize: textSize }}
              >
                {lines.map((line) => line.text).join("    ·    ") || " "}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  const parts = (text: string) => {
    const match = text.match(/^(.+?)(?:\s*:\s*|\s+·\s+)(.*)$/);
    return { label: match?.[1] ?? title, value: match?.[2] ?? text };
  };
  const item = selected ? parts(selected.text) : null;
  const visible =
    layout === "stack" ? lines.slice(0, 4) : layout === "floating" ? lines.slice(0, 3) : lines;
  return (
    <div
      data-events-layout={layout}
      data-layout-content
      dir={lang === "ar" ? "rtl" : "ltr"}
      className={`premium-events premium-events-${layout}`}
      style={
        {
          color,
          fontFamily,
          "--events-accent": accent,
          "--events-font": `${Math.max(20, fontSize)}px`,
        } as CSSProperties
      }
    >
      <header>
        <span>{title}</span>
        <Radio size={16} />
      </header>
      {layout === "stack" ? (
        <div className="premium-events-featured">
          <div className="event-line-swap premium-events-hero" data-motion={motion}>
            <Sparkles size={26} />
            <small>{item?.label}</small>
            <bdi>{item?.value}</bdi>
          </div>
          <div className="premium-events-index">
            {visible.map((line, index) => (
              <div key={line.key}>
                <span dir="ltr">{String(index + 1).padStart(2, "0")}</span>
                <bdi>{parts(line.text).value}</bdi>
              </div>
            ))}
          </div>
        </div>
      ) : layout === "ribbon" ? (
        <div className="premium-events-cinema">
          {Array.from({ length: Math.min(3, lines.length) }, (_, offset) => {
            const index = (active + offset) % lines.length;
            const entry = lines[index]!;
            const p = parts(entry.text);
            return (
              <article
                key={entry.key}
                className={offset === 0 ? "is-current event-line-swap" : ""}
                data-motion={offset === 0 ? motion : undefined}
              >
                <span className="premium-events-counter" dir="ltr">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <small>{p.label}</small>
                <bdi>{p.value}</bdi>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="premium-events-list">
          {visible.map((line, index) => {
            const p = parts(line.text);
            return (
              <article key={line.key} style={{ "--event-i": index } as CSSProperties}>
                <span className="premium-events-order" dir="ltr">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="premium-events-symbol">
                  {layout === "timeline" ? <Activity size={17} /> : <ArrowUpRight size={18} />}
                </span>
                <div>
                  <small>{p.label}</small>
                  <bdi>{p.value}</bdi>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
