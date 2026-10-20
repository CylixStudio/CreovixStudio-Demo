import { GoalBarView } from "@/components/widgets/WidgetRenderer";
import { WHEEL_SLICE_COLORS } from "@/components/widgets/SpinWheel";
import { useLanguage } from "@/lib/i18n";
import { parseEventLabelsConfig, parseViewerCounterConfig } from "@/lib/widgets";
import type { EventLabelLayout, GoalLayout, ViewerLayout, WheelLayout } from "@/lib/widgetLayouts";

type GoalKind = "donation" | "follower" | "subscriber" | "kicks" | "bar";

const GOAL_SCALE: Record<GoalLayout, number> = {
  classic: 0.3,
  compact: 0.26,
  bold: 0.3,
  glass: 0.3,
};

/** The real goal renderer, scaled down, so each card shows what the overlay would draw. */
export function GoalMini({
  layout,
  kind,
  config,
  title,
  unit,
}: {
  layout: GoalLayout;
  kind: GoalKind;
  config: Record<string, unknown>;
  title: string;
  unit: string;
}) {
  return (
    <div className="pointer-events-none relative h-[92px] overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          transform: `translate(-50%, -50%) scale(${GOAL_SCALE[layout]})`,
          transformOrigin: "center",
        }}
      >
        <GoalBarView
          config={{ ...config, layout }}
          goal={{ title, unit, target: 100, current: 64 }}
          kind={kind}
        />
      </div>
    </div>
  );
}

export function WheelMini({ layout }: { layout: WheelLayout }) {
  const stops = WHEEL_SLICE_COLORS.map((color, index) => {
    const from = (index / WHEEL_SLICE_COLORS.length) * 360;
    const to = ((index + 1) / WHEEL_SLICE_COLORS.length) * 360;
    return `${color.fill} ${from}deg ${to}deg`;
  }).join(", ");
  const disc = (size: number, ring: number, ringColor: string) => (
    <span
      className="block rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${stops})`,
        boxShadow: ring ? `0 0 0 ${ring}px ${ringColor}` : undefined,
      }}
    />
  );
  return (
    <div className="flex h-[92px] items-center justify-center">
      {layout === "classic" ? (
        <span className="flex h-[78px] w-[78px] items-center justify-center rounded-3xl border border-zinc-800 bg-zinc-950">
          {disc(52, 3, "#E4E4E7")}
        </span>
      ) : layout === "compact" ? (
        <span className="flex h-[58px] w-[58px] items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900">
          {disc(40, 1, "#52525B")}
        </span>
      ) : (
        disc(60, 0, "transparent")
      )}
    </div>
  );
}

export function ViewerMini({
  layout,
  config,
}: {
  layout: ViewerLayout;
  config: Record<string, unknown>;
}) {
  const { t } = useLanguage();
  const style = parseViewerCounterConfig(config);
  const label =
    style.metric === "followers" ? t("widget.viewer.followers") : t("widget.viewer.viewers");
  const base = { color: style.textColor, fontFamily: style.fontFamily };
  if (layout === "digits") {
    return (
      <div className="flex h-[92px] items-center justify-center" style={base}>
        <span className="text-2xl font-bold tabular-nums">1,290</span>
      </div>
    );
  }
  if (layout === "bar") {
    return (
      <div className="flex h-[92px] items-center justify-center px-2" style={base}>
        <span className="flex w-full items-center gap-1.5 rounded-full border border-white/10 bg-zinc-950/80 px-2.5 py-2">
          <span className="min-w-0 flex-1">
            <span className="block h-1.5 overflow-hidden rounded-full bg-white/10">
              <span
                className="block h-full w-3/5 rounded-full"
                style={{ background: style.accentColor }}
              />
            </span>
            <span className="mt-1 block truncate text-[7px] opacity-70">{label}</span>
          </span>
          <span className="shrink-0 text-xs font-bold tabular-nums">1,290</span>
        </span>
      </div>
    );
  }
  return (
    <div className="flex h-[92px] items-center justify-center px-2" style={base}>
      <span className="flex flex-col items-center rounded-full border border-white/15 bg-zinc-950/85 px-5 py-2">
        <span className="text-lg font-bold tabular-nums leading-none">1,290</span>
        <span className="mt-1 text-[8px] tracking-[0.14em]" style={{ color: style.accentColor }}>
          {label}
        </span>
      </span>
    </div>
  );
}

export function EventsMini({
  layout,
  config,
}: {
  layout: EventLabelLayout;
  config: Record<string, unknown>;
}) {
  const style = parseEventLabelsConfig(config);
  const base = { color: style.textColor, fontFamily: style.fontFamily };
  const title = (
    <span
      className="truncate text-[8px] font-bold tracking-[0.14em]"
      style={{ color: style.accentColor }}
    >
      {style.title}
    </span>
  );
  const sample = ["Nova", "Luna", "Fox"];
  let body;
  if (layout === "cycle") {
    body = <span className="text-[11px]">{sample[0]} · 5</span>;
  } else if (layout === "ticker") {
    body = (
      <div className="flex w-full flex-col gap-1 overflow-hidden px-2">
        {title}
        <span className="whitespace-nowrap text-[10px]">
          {sample.map((name) => `${name} · 5`).join("   ·   ")}
        </span>
      </div>
    );
  } else if (layout === "stack") {
    body = (
      <div className="flex w-full flex-col gap-0.5 px-2">
        {title}
        {sample.map((name) => (
          <span key={name} className="text-[9px]">
            {name} · 5
          </span>
        ))}
      </div>
    );
  } else {
    body = (
      <span className="flex min-w-0 max-w-full flex-col gap-0.5 rounded-full border border-white/15 bg-zinc-950/85 px-4 py-1.5">
        {title}
        <span className="truncate text-[10px]">{sample[0]} · 5</span>
      </span>
    );
  }
  return (
    <div className="flex h-[92px] items-center justify-center px-2" style={base}>
      {body}
    </div>
  );
}
