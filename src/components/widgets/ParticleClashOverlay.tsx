import { useEffect, useRef, useState } from "react";

import { PredictionParticles } from "@/components/widgets/PredictionParticles";
import {
  OverlayStage,
  fontScale,
  formatClock,
  formatCount,
  wholePercents,
} from "@/components/widgets/overlayKit";
import { type PredictionRuntime } from "@/lib/interactiveWidgets";
import {
  PredictionParticleLifecycle,
  emptyPresentation,
  officialWinner,
  readPredictionReceipt,
} from "@/lib/predictionParticleLifecycle";
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
  const controller = useRef<PredictionParticleLifecycle | null>(null);
  const [presentation, setPresentation] = useState(emptyPresentation);
  const [storageError, setStorageError] = useState(false);
  const settings = useRef(config);
  settings.current = config;
  useEffect(() => {
    const key = `cylixstudio-demo:prediction-presentation:v1:${location.pathname}`;
    if (!controller.current) {
      try {
        controller.current = new PredictionParticleLifecycle(
          preview ? null : readPredictionReceipt(sessionStorage, key),
        );
      } catch (error) {
        console.error("[prediction-particles] lifecycle_receipt_read_failed", error);
        setStorageError(true);
        controller.current = new PredictionParticleLifecycle(null);
      }
    }
    const machine = controller.current;
    machine.receive(
      live,
      Date.now(),
      config.particleWinnerAnimation ? config.particleWinnerDuration : 0,
      config.particleOpeningAnimation,
    );
    try {
      if (!preview && machine.receipt) sessionStorage.setItem(key, JSON.stringify(machine.receipt));
    } catch (error) {
      console.error("[prediction-particles] lifecycle_receipt_write_failed", error);
      setStorageError(true);
    }
    setPresentation(machine.presentation);
  }, [
    live,
    preview,
    config.particleOpeningAnimation,
    config.particleWinnerAnimation,
    config.particleWinnerDuration,
  ]);
  useEffect(() => {
    if (!presentation.until) return;
    const tick = window.setTimeout(
      () => {
        const machine = controller.current;
        if (!machine) return;
        machine.tick(Date.now(), settings.current.particleResultDuration);
        setPresentation(machine.presentation);
      },
      Math.max(0, presentation.until - Date.now()),
    );
    return () => window.clearTimeout(tick);
  }, [presentation.until]);
  const shown = presentation.runtime;
  const leaving = presentation.phase === "CLOSING";
  const winner = officialWinner(shown);
  const announcing =
    presentation.phase === "REVEALING_WINNER" || presentation.phase === "RESULT_DISPLAY";
  useEffect(() => {
    if (shown?.status !== "open" || !shown.endsAt || leaving) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [shown?.status, shown?.endsAt, leaving]);
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
  if (!shown || ["IDLE", "WAITING_FOR_RESULT", "HIDDEN"].includes(presentation.phase)) {
    return (
      <OverlayStage {...stage}>
        <span data-testid="prediction-lifecycle" data-phase={presentation.phase} />
        {preview && storageError ? (
          <p role="alert" style={textStyle}>
            {ar
              ? "تعذر حفظ حالة الإعلان في المتصفح؛ قد يتكرر بعد التحديث."
              : "Could not save reveal receipt; refresh may replay it."}
          </p>
        ) : null}
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
      <style>{`
        @keyframes particle-text-enter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        .particle-text-enter { animation: particle-text-enter 450ms ease-out both; }
        @media (prefers-reduced-motion: reduce) { .particle-text-enter { animation: none; } .particle-lifecycle { transition: none !important; } }
      `}</style>
      <div
        data-testid="particle-clash-overlay"
        data-status={shown.status}
        data-phase={presentation.phase}
        className="particle-lifecycle"
        style={{
          position: "absolute",
          inset: 0,
          opacity: leaving ? 0 : 1,
          transform: leaving ? "translateY(20px)" : "none",
          transition: "opacity 750ms ease, transform 750ms ease",
        }}
      >
        <PredictionParticles
          settings={config}
          key={presentation.key}
          points={points}
          winnerSide={winner}
          cinematicWinner={winner >= 0}
          frozen={leaving}
          instantOpening={!config.particleOpeningAnimation}
        />
        <div
          key={`text-${presentation.key}`}
          className={config.particleOpeningAnimation || announcing ? "particle-text-enter" : ""}
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
            {announcing && winner >= 0 ? (
              <p
                data-testid="prediction-winner"
                dir="auto"
                style={{
                  margin: "8px 0 0",
                  fontSize: 28 * size,
                  fontWeight: 650,
                  color: winner === 0 ? config.particleGreen : config.particleRed,
                }}
              >
                {ar ? "الفائز:" : "Winner:"} {outcomes[winner]?.label}
              </p>
            ) : null}
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
