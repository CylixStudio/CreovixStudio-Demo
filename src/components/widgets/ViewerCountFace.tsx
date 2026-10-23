import { Eye, Radio, Users } from "lucide-react";

import { useLanguage } from "@/lib/i18n";
import type { ViewerLayout } from "@/lib/widgetLayouts";
import { withAlpha } from "@/lib/overlayTheme";
import type { parseViewerCounterConfig } from "@/lib/widgets";

export function ViewerCountFace({
  layout,
  style,
  digits,
  label,
}: {
  layout: ViewerLayout;
  style: ReturnType<typeof parseViewerCounterConfig>;
  digits: string;
  label: string;
}) {
  const { lang, dir } = useLanguage();
  const accent = style.accentColor;
  const numberStyle = {
    fontSize: Math.max(28, style.fontSize * 0.78),
    fontWeight: 750,
    fontVariantNumeric: "tabular-nums",
  } as const;
  const live = lang === "ar" ? "مباشر" : "LIVE";
  const number = (
    <strong style={numberStyle} dir="ltr">
      {digits}
    </strong>
  );
  const caption = (
    <span className="text-xs font-medium opacity-65" dir="auto">
      {label}
    </span>
  );
  const root = { color: style.textColor, fontFamily: style.fontFamily };
  if (layout === "digits") {
    return (
      <div className="bg-transparent text-center" style={root}>
        <span
          style={{ fontSize: style.fontSize, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
          dir="ltr"
        >
          {digits}
        </span>
      </div>
    );
  }
  let body;
  if (layout === "island") {
    body = (
      <div className="flex items-center gap-5 rounded-full border border-white/15 bg-[#101012] px-6 py-3 shadow-xl">
        <span className="relative grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
          <Eye size={22} style={{ color: accent }} />
          <span
            className="absolute -bottom-0.5 end-0 size-2.5 rounded-full border-2 border-[#101012]"
            style={{ background: accent }}
          />
        </span>
        <div className="flex min-w-[100px] flex-col leading-tight">
          {number}
          {caption}
        </div>
        <div className="flex -space-x-1.5 border-s border-white/10 ps-4" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="grid size-6 place-items-center rounded-full border-2 border-[#101012] bg-zinc-800"
            >
              <Users size={10} style={{ opacity: 1 - i * 0.2 }} />
            </span>
          ))}
        </div>
      </div>
    );
  } else if (layout === "live") {
    body = (
      <div className="w-[260px] overflow-hidden rounded-2xl border border-white/15 bg-[#101012] shadow-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
          <span
            className="flex items-center gap-2 text-[10px] font-bold tracking-widest"
            style={{ color: accent }}
          >
            <Radio size={12} />
            {live}
          </span>
          <span className="font-mono text-[10px] opacity-40">{style.platform}</span>
        </div>
        <div className="flex items-center justify-between gap-5 px-5 py-4">
          <div className="flex flex-col">
            {number}
            {caption}
          </div>
          <Eye size={36} strokeWidth={1} style={{ color: accent, opacity: 0.6 }} />
        </div>
        <div
          className="h-1"
          style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        />
      </div>
    );
  } else if (layout === "digital") {
    body = (
      <div className="space-y-3 p-3">
        <div className="flex items-center justify-between gap-6 px-1">
          {caption}
          <span className="text-[9px] font-bold tracking-[0.2em]" style={{ color: accent }}>
            {live}
          </span>
        </div>
        <div className="flex gap-1.5" dir="ltr">
          {Array.from(digits).map((digit, index) =>
            /\d/.test(digit) ? (
              <span
                key={index}
                className="relative grid min-w-12 place-items-center overflow-hidden rounded-lg border border-white/15 bg-[#141416] px-2.5 py-2 font-mono font-bold shadow-lg"
                style={{ fontSize: style.fontSize * 0.7 }}
              >
                <span className="absolute inset-x-0 top-1/2 h-px bg-black/70" />
                {digit}
                <span
                  className="absolute inset-x-0 bottom-0 h-0.5"
                  style={{ background: withAlpha(accent, 40) }}
                />
              </span>
            ) : (
              <span key={index} className="self-end pb-3 text-xl opacity-40">
                {digit}
              </span>
            ),
          )}
        </div>
      </div>
    );
  } else if (layout === "bar") {
    body = (
      <div className="w-[360px] rounded-2xl border border-white/10 bg-[#101012] p-5">
        <div className="flex items-center justify-between gap-5">
          <span className="flex items-center gap-2 text-xs font-medium">
            <Users size={16} style={{ color: accent }} />
            {label}
          </span>
          {number}
        </div>
        <div className="mt-4 flex h-7 items-end gap-1" aria-hidden>
          {Array.from({ length: 32 }, (_, i) => (
            <span
              key={i}
              className="flex-1 rounded-t-sm"
              style={{
                height: `${25 + ((i * 7) % 11) * 7}%`,
                background:
                  i < 22 ? withAlpha(accent, 35 + (i % 4) * 15) : "rgba(255,255,255,0.06)",
              }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between border-t border-white/10 pt-2 text-[9px] tracking-widest opacity-50">
          <span>{live}</span>
          <span>{style.platform}</span>
        </div>
      </div>
    );
  } else if (layout === "lower-third") {
    body = (
      <div className="flex w-[460px] items-stretch overflow-hidden rounded-e-xl border border-white/10 bg-[#101012]">
        <div
          className="grid w-16 shrink-0 place-items-center"
          style={{ background: accent, color: "#0a0a0a" }}
        >
          <Radio size={26} strokeWidth={1.5} />
        </div>
        <div className="flex flex-1 items-center justify-between gap-6 px-5 py-3">
          <div className="flex flex-col gap-2">
            <span className="text-[9px] font-bold tracking-[0.25em]" style={{ color: accent }}>
              {live} / {style.platform}
            </span>
            {caption}
          </div>
          {number}
        </div>
      </div>
    );
  } else if (layout === "hud") {
    body = (
      <div className="relative grid size-64 place-items-center" style={{ color: accent }}>
        <svg viewBox="0 0 240 240" className="absolute inset-0 size-full" aria-hidden>
          <path
            d="M25 80V25H80 M160 25H215V80 M215 160V215H160 M80 215H25V160"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            opacity=".5"
          />
          <circle
            cx="120"
            cy="120"
            r="84"
            fill="#101012"
            stroke="currentColor"
            strokeOpacity=".15"
          />
          <path
            d="M55 76A78 78 0 0 1 185 76 M185 164A78 78 0 0 1 55 164"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path d="M120 6V18 M120 222V234 M6 120H18 M222 120H234" stroke="currentColor" />
        </svg>
        <div
          className="relative flex flex-col items-center gap-2"
          style={{ color: style.textColor }}
        >
          <Eye size={20} style={{ color: accent }} />
          {number}
          {caption}
        </div>
      </div>
    );
  } else {
    body = (
      <div className="relative flex w-[360px] flex-col items-center gap-1 py-12 text-center">
        <div
          className="absolute inset-4 rounded-[50%] border border-white/5"
          style={{
            background: `radial-gradient(ellipse, ${withAlpha(accent, 12)}, transparent 65%)`,
          }}
        />
        <div className="absolute inset-x-12 inset-y-7 rounded-[50%] border border-white/10" />
        <span className="relative mb-2 text-[9px] tracking-[0.35em]" style={{ color: accent }}>
          {live}
        </span>
        <span className="relative">{number}</span>
        <span className="relative">{caption}</span>
        <div className="relative mt-3 flex items-center gap-2" aria-hidden>
          <span className="h-px w-12 bg-white/10" />
          <Users size={12} style={{ color: accent }} />
          <span className="h-px w-12 bg-white/10" />
        </div>
      </div>
    );
  }
  return (
    <div data-viewer-layout={layout} dir={dir} style={root}>
      {body}
    </div>
  );
}
