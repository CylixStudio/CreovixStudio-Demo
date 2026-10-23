import { Activity, ArrowUpRight, Radio } from "lucide-react";
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
  const parts = (text: string) => {
    const match = text.match(/^(.+?)(?:\s*:\s*|\s+·\s+)(.*)$/);
    return { label: match?.[1] ?? title, value: match?.[2] ?? text };
  };
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
  if (["stack", "floating", "spotlight", "ribbon"].includes(layout)) {
    const item = selected ? parts(selected.text) : null;
    return (
      <div
        data-events-layout={layout}
        data-layout-content
        className={`events-editorial events-editorial-${layout}`}
        dir={lang === "ar" ? "rtl" : "ltr"}
        style={
          {
            color,
            fontFamily,
            "--events-accent": accent,
            "--events-font": `${Math.max(20, fontSize)}px`,
          } as import("react").CSSProperties
        }
      >
        <header>
          <span className="events-label">{title}</span>
          <Radio size={16} />
        </header>
        {layout === "stack" ? (
          <div className="events-pile">
            {lines.slice(0, 4).map((line, i) => {
              const p = parts(line.text);
              return (
                <article key={line.key}>
                  <span className="events-order" dir="ltr">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <small>{p.label}</small>
                    <bdi>{p.value}</bdi>
                  </div>
                  <ArrowUpRight size={16} />
                </article>
              );
            })}
          </div>
        ) : layout === "floating" ? (
          <div className="events-carousel">
            {lines.length
              ? [0, 1, 2].map((offset) => {
                  const line = lines[(active + offset) % lines.length]!;
                  const p = parts(line.text);
                  return (
                    <article
                      key={`${offset}-${line.key}`}
                      className={offset === 0 ? "event-line-swap is-current" : ""}
                      data-motion={offset === 0 ? motion : "shown"}
                    >
                      <span className="events-order" dir="ltr">
                        {String(((active + offset) % lines.length) + 1).padStart(2, "0")}
                      </span>
                      <small>{p.label}</small>
                      <bdi>{p.value}</bdi>
                    </article>
                  );
                })
              : null}
          </div>
        ) : layout === "spotlight" ? (
          <div className="events-ledger">
            {lines.map((line, i) => {
              const p = parts(line.text);
              return (
                <article key={line.key}>
                  <div>
                    <span className="events-order" dir="ltr">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <small>{p.label}</small>
                  </div>
                  <bdi>{p.value}</bdi>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="events-ribbon-body">
            <span className="events-ribbon-mark">
              <Activity size={28} />
            </span>
            <div className="event-line-swap" data-motion={motion}>
              <small>{item?.label}</small>
              <bdi>{item?.value}</bdi>
            </div>
            <span className="events-ribbon-index" dir="ltr">
              {lines.length ? `${(active % lines.length) + 1} / ${lines.length}` : "—"}
            </span>
          </div>
        )}
      </div>
    );
  }
  let body;
  if (layout === "island") {
    body = (
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
    );
  } else if (layout === "ticker") {
    body = (
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
    );
  } else if (layout === "timeline") {
    body = (
      <div className="w-[400px] space-y-4 border-s-2 border-white/20 py-3 ps-5">
        {lines.map((line, index) => (
          <div key={line.key} className="relative space-y-1 py-1">
            <span
              className="absolute -start-[27px] top-3 size-3 rounded-full border-2 border-zinc-950"
              style={{ background: accent }}
            />
            <p className="text-xs font-bold" style={{ color: accent }}>
              {title} · {index + 1}
            </p>
            <p style={{ fontSize: textSize }} dir="auto">
              {line.text}
            </p>
          </div>
        ))}
      </div>
    );
  } else if (layout === "stack") {
    body = (
      <div className="w-[400px] space-y-2">
        <div className="mb-3 flex items-center justify-between px-2">
          {heading}
          <Radio size={14} style={{ color: accent }} />
        </div>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#101012] px-4 py-3"
            style={{ marginInlineStart: (index % 3) * 10 }}
          >
            <span className="text-[10px] font-bold tabular-nums opacity-30" dir="ltr">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="h-6 w-px bg-white/10" />
            <span className="min-w-0 flex-1" style={{ fontSize: textSize }} dir="auto">
              {line.text}
            </span>
          </div>
        ))}
      </div>
    );
  } else if (layout === "floating") {
    const next = lines.length ? lines[(active + 1) % lines.length] : null;
    body = (
      <div className="flex w-[570px] items-stretch gap-3 p-3">
        <div
          className="event-line-swap relative min-w-0 flex-1 rounded-2xl border border-white/15 bg-[#101012] p-5"
          data-motion={motion}
        >
          <span className="mb-4 block text-[10px] opacity-35">
            {lang === "ar" ? "الحدث الحالي" : "ON AIR"}
          </span>
          {heading}
          <p className="mt-2 break-words font-semibold" style={{ fontSize: textSize }} dir="auto">
            {selected?.text}
          </p>
          <ArrowUpRight className="mt-4" size={16} style={{ color: accent }} />
        </div>
        <div className="w-[180px] shrink-0 self-center rounded-2xl border border-white/5 bg-[#101012]/70 p-4 opacity-45">
          <p className="mb-3 text-[9px] tracking-widest">{lang === "ar" ? "التالي" : "UP NEXT"}</p>
          <p className="text-sm" dir="auto">
            {next?.text}
          </p>
        </div>
      </div>
    );
  } else if (layout === "spotlight") {
    body = (
      <div className="w-[430px] rounded-xl border border-white/10 bg-[#101012] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          {heading}
          <Activity size={14} className="opacity-40" />
        </div>
        {lines.map((line, index) => (
          <div
            key={line.key}
            className="grid grid-cols-[26px_1fr] items-start gap-3 border-t border-white/8 py-3"
          >
            <span className="pt-1 font-mono text-[10px]" style={{ color: accent }}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span style={{ fontSize: textSize }} dir="auto">
              {line.text}
            </span>
          </div>
        ))}
      </div>
    );
  } else {
    body = (
      <div className="flex w-[700px] items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#101012]">
        <div
          className="flex w-[160px] shrink-0 flex-col justify-center gap-2 px-5 py-4"
          style={{ color: "#0a0a0a", background: accent }}
        >
          <Radio size={17} />
          <span className="text-xs font-bold" dir="auto">
            {title}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-2 overflow-hidden px-5 py-3">
          <span className="text-[9px] font-bold tracking-[0.25em] opacity-35">
            {lang === "ar" ? "نشاط القناة" : "CHANNEL ACTIVITY"}
          </span>
          <div className="overflow-hidden">
            <div
              className="event-ticker-track inline-block whitespace-nowrap"
              style={{ fontSize: textSize }}
            >
              {lines.map((line) => line.text).join("     /     ")}
            </div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div
      data-events-layout={layout}
      dir={lang === "ar" ? "rtl" : "ltr"}
      style={{ color, fontFamily }}
    >
      {body}
    </div>
  );
}
