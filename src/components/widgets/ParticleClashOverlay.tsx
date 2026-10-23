import { useEffect, useRef, useState } from "react";

import { PredictionParticles } from "@/components/widgets/PredictionParticles";
import {
  OverlayStage,
  fontScale,
  formatClock,
  formatCount,
  usePresence,
  wholePercents,
} from "@/components/widgets/overlayKit";
import { predictionCardVisible, type PredictionRuntime } from "@/lib/interactiveWidgets";
import { type PredictionConfig } from "@/lib/widgets";
import { useLanguage } from "@/lib/i18n";

export function ParticleClashOverlay({
  config,
  runtime,
  preview,
}: {
  config: PredictionConfig;
  runtime: PredictionRuntime | null;
  preview: boolean;
}) {
  const { t, lang, dir } = useLanguage();
  const ar = lang === "ar";
  const [now, setNow] = useState(Date.now);
  // Classic's historical showcase is not an actual prediction.
  const live = runtime?.eventName === "demo-fixture" ? null : runtime;
  const visible = predictionCardVisible(live, now);
  const last = useRef<PredictionRuntime | null>(null);
  if (visible && live) last.current = live;
  const { mounted, leaving } = usePresence(visible);
  const shown = visible ? live : last.current;
  useEffect(() => {
    if (!live?.endsAt && !live?.hideAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [live?.endsAt, live?.hideAt]);
  const stage = {
    mode: preview ? ("box" as const) : ("viewport" as const),
    dir,
    className: preview ? "w-full aspect-video" : "",
  };
  const textStyle = {
    color: config.textColor,
    fontFamily: config.fontFamily,
    textShadow: "0 2px 6px #000",
  };
  if (!mounted || !shown) {
    return (
      <OverlayStage {...stage}>
        {live?.status === "resolved" ? null : (
          <p
            data-testid="prediction-idle"
            style={{
              ...textStyle,
              position: "absolute",
              bottom: 40,
              left: 80,
              right: 80,
              textAlign: "center",
              fontSize: 24,
            }}
          >
            {t("widget.prediction.idle")}
          </p>
        )}
      </OverlayStage>
    );
  }
  const outcomes = shown.outcomes.slice(0, 2);
  const points = outcomes.map((outcome) => outcome.points);
  const hasPoints = points.some((value) => value > 0);
  const percents = wholePercents(points);
  const status =
    shown.status === "open"
      ? t("widget.prediction.open")
      : shown.status === "locked"
        ? t("widget.prediction.locked")
        : t("widget.prediction.resolved");
  const ends = shown.endsAt ? Date.parse(shown.endsAt) : NaN;
  const remaining = Number.isFinite(ends) ? Math.max(0, Math.ceil((ends - now) / 1000)) : null;
  const size = fontScale(config.fontSize);
  const test = shown.eventName === "demo-prediction-test";
  return (
    <OverlayStage {...stage}>
      <div
        data-testid="particle-clash-overlay"
        data-status={shown.status}
        style={{
          position: "absolute",
          inset: 0,
          opacity: leaving ? 0 : 1,
          transition: "opacity 450ms",
        }}
      >
        <PredictionParticles settings={config} points={points} />
        <div
          style={{
            ...textStyle,
            position: "absolute",
            left: 52,
            right: 52,
            bottom: config.particleHeight + 18,
          }}
        >
          <div style={{ margin: "0 auto 16px", maxWidth: 1180, textAlign: "center" }}>
            {shown.title ? (
              <h2
                data-testid="prediction-title"
                dir="auto"
                title={shown.title}
                style={{
                  margin: 0,
                  fontSize: 26 * size,
                  fontWeight: 650,
                  lineHeight: 1.3,
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {shown.title}
              </h2>
            ) : null}
            <p style={{ margin: "5px 0 0", fontSize: 18 * size, opacity: 0.8 }}>
              {status}
              {shown.status === "open" && remaining !== null ? (
                <>
                  {" "}
                  · <bdi dir="ltr">{formatClock(remaining)}</bdi>
                </>
              ) : null}
              {!hasPoints ? (
                <>
                  {" "}
                  · {ar ? "بانتظار النقاط — لا توجد نتيجة بعد" : "Awaiting points — no result yet"}
                </>
              ) : null}
              {test ? <> · {ar ? "اختبار محلي" : "Local test"}</> : null}
            </p>
          </div>
          <div
            dir="ltr"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 64,
              alignItems: "flex-end",
            }}
          >
            {outcomes.map((outcome, index) => (
              <div
                key={outcome.id}
                dir={dir}
                data-testid={`prediction-outcome-${index}`}
                style={{ width: "42%", minWidth: 0, textAlign: index === 0 ? "left" : "right" }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-end",
                    justifyContent: index === 0 ? "flex-start" : "flex-end",
                  }}
                  dir="ltr"
                >
                  <span
                    dir="auto"
                    title={outcome.label}
                    style={{
                      fontSize: 28 * size,
                      lineHeight: 1.3,
                      overflowWrap: "anywhere",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {outcome.label}
                  </span>
                  <bdi
                    dir="ltr"
                    style={{
                      fontSize: 30 * size,
                      fontWeight: 700,
                      flexShrink: 0,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {hasPoints ? `${percents[index] ?? 0}%` : "—"}
                  </bdi>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: 18 * size, opacity: 0.8 }}>
                  {t("overlay.prediction.points", { n: formatCount(outcome.points) })} ·{" "}
                  {t("overlay.prediction.voters", { n: formatCount(outcome.voters) })}
                  {shown.status === "resolved" && shown.winnerId === outcome.id
                    ? ` · ★ ${t("widget.prediction.winner")}`
                    : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </OverlayStage>
  );
}
