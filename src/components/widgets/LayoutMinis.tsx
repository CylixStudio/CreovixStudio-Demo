import { GoalBarView } from "@/components/widgets/WidgetRenderer";
import { SpinWheelView } from "@/components/widgets/SpinWheel";
import { ViewerCountFace } from "@/components/widgets/ViewerCountFace";
import { EventLabelsFace } from "@/components/widgets/EventLabelsFace";
import { LayoutThumbnail } from "@/components/widgets/LayoutThumbnail";
import { useLanguage } from "@/lib/i18n";
import { parseEventLabelsConfig, parseViewerCounterConfig } from "@/lib/widgets";
import type { EventLabelLayout, GoalLayout, ViewerLayout, WheelLayout } from "@/lib/widgetLayouts";

export function GoalMini({
  layout,
  kind,
  config,
  title,
  unit,
}: {
  layout: GoalLayout;
  kind: "donation" | "follower" | "subscriber" | "kicks" | "bar";
  config: Record<string, unknown>;
  title: string;
  unit: string;
}) {
  return (
    <LayoutThumbnail>
      <GoalBarView
        config={{ ...config, layout }}
        goal={{ title, unit, target: 100, current: 64 }}
        kind={kind}
      />
    </LayoutThumbnail>
  );
}

export function WheelMini({ layout }: { layout: WheelLayout }) {
  return (
    <LayoutThumbnail>
      <SpinWheelView config={{ layout, entries: ["1", "2", "3", "4", "5"] }} spin={null} />
    </LayoutThumbnail>
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
  return (
    <LayoutThumbnail>
      <ViewerCountFace layout={layout} style={style} digits="1,290" label={label} />
    </LayoutThumbnail>
  );
}

export function EventsMini({
  layout,
  config,
}: {
  layout: EventLabelLayout;
  config: Record<string, unknown>;
}) {
  const { lang } = useLanguage();
  const style = parseEventLabelsConfig(config);
  const lines = [
    { key: "follow", text: `${lang === "ar" ? "آخر متابع" : "Latest follower"} · Nova` },
    { key: "sub", text: `${lang === "ar" ? "آخر مشترك" : "Latest subscriber"} · Luna` },
    { key: "gift", text: `${lang === "ar" ? "اشتراكات مهداة" : "Gifted subscriptions"} · Fox · 5` },
  ];
  return (
    <LayoutThumbnail>
      <EventLabelsFace
        layout={layout}
        title={style.title}
        lines={lines}
        active={0}
        motion="shown"
        accent={style.accentColor}
        color={style.textColor}
        fontFamily={style.fontFamily}
        fontSize={style.fontSize}
        lang={lang}
      />
    </LayoutThumbnail>
  );
}
