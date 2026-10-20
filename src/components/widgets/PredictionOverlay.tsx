import { useEffect, useState } from "react";

import { useLiveChat, type ChatSources } from "@/hooks/useLiveChat";
import {
  predictionCardVisible,
  preferNewer,
  sharePercents,
  type PredictionRuntime,
} from "@/lib/interactiveWidgets";
import { useLanguage } from "@/lib/i18n";
import { parsePredictionConfig } from "@/lib/widgets";

export function PredictionOverlay({
  config,
  runtime,
  chat = null,
  demo = false,
}: {
  config: unknown;
  runtime: PredictionRuntime | null;
  chat?: ChatSources | null;
  demo?: boolean;
}) {
  const { t } = useLanguage();
  const parsed = parsePredictionConfig(config);
  const { kickPrediction } = useLiveChat(chat, 1);
  const live = preferNewer(runtime, kickPrediction);
  const [now, setNow] = useState(() => Date.now());
  const visible = predictionCardVisible(live, now);
  const open = live?.status === "open";

  useEffect(() => {
    if (!live?.endsAt && !live?.hideAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(id);
  }, [live?.endsAt, live?.hideAt, live?.status]);

  if (!visible || !live) {
    if (!demo) return null;
    return (
      <p className="rounded-2xl border border-white/15 bg-black/50 px-4 py-3 text-sm text-[#bee1fc]" dir="rtl">
        {t("widget.prediction.idle")}
      </p>
    );
  }

  const outcomes = live.outcomes.slice(0, 2);
  const percents = sharePercents(outcomes.map((outcome) => outcome.points));
  const remaining =
    open && live.endsAt ? Math.max(0, Math.ceil((Date.parse(live.endsAt) - now) / 1000)) : 0;
  const statusLabel = open
    ? `${t("widget.prediction.open")}${live.endsAt ? ` · ${remaining}s` : ""}`
    : live.status === "locked"
      ? t("widget.prediction.locked")
      : t("widget.prediction.resolved");

  // Lower-third overlay design with Kick-style dots
  return (
    <div
      className="overlay-prediction-lower-third fixed bottom-0 left-0 right-0 w-full flex items-end justify-center pointer-events-none"
      style={{
        height: "220px",
      }}
    >
      <div
        className="overlay-prediction-card w-full max-w-2xl rounded-t-3xl border border-b-0 px-8 py-6"
        dir="rtl"
        style={{
          color: parsed.textColor,
          fontFamily: parsed.fontFamily,
          background: "linear-gradient(180deg, rgba(10,16,24,0.92), rgba(8,10,14,0.85))",
          borderColor: "rgba(190,225,252,0.35)",
          backdropFilter: "blur(20px)",
          boxShadow: "0 -24px 60px rgba(0,0,0,0.45), 0 0 32px rgba(190,225,252,0.16)",
        }}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="text-lg font-semibold" dir="auto">
            {live.title}
          </p>
          <span className="text-xs font-semibold tracking-wide text-[#bee1fc]">{statusLabel}</span>
        </div>

        {/* Options with dots indicator */}
        <div className="flex items-stretch gap-6">
          {/* Option A */}
          <div className="flex-1 flex flex-col">
            <p className="text-sm font-medium mb-2" dir="auto">
              {outcomes[0]?.label ?? ""}
            </p>
            <div className="flex-1 flex items-end gap-2">
              <div className="flex-1 flex flex-col items-stretch gap-1">
                {/* Percentage bar */}
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(5, percents[0] ?? 0)}%`,
                      background:
                        live.winnerId && outcomes[1]?.id === live.winnerId
                          ? "rgba(255,255,255,0.25)"
                          : "#bee1fc",
                    }}
                  />
                </div>
                {/* Percentage text */}
                <p className="text-xs text-white/60">
                  {Math.round(percents[0] ?? 0)}%
                </p>
              </div>
              {/* Kick-style green dots */}
              <div className="flex gap-1 pb-0.5">
                {[...Array(Math.max(1, Math.min(5, Math.ceil((percents[0] ?? 0) / 20))))].map(
                  (_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "#00c70f",
                        boxShadow: "0 0 4px rgba(0,199,15,0.6)",
                      }}
                    />
                  )
                )}
              </div>
            </div>
            {live.status === "resolved" && outcomes[0]?.id === live.winnerId && (
              <p className="mt-1 text-xs font-bold text-[#bee1fc]">★ {t("widget.prediction.winner")}</p>
            )}
          </div>

          {/* Divider */}
          <div className="w-px bg-white/10 my-1" />

          {/* Option B */}
          <div className="flex-1 flex flex-col">
            <p className="text-sm font-medium mb-2" dir="auto">
              {outcomes[1]?.label ?? ""}
            </p>
            <div className="flex-1 flex items-end gap-2">
              <div className="flex-1 flex flex-col items-stretch gap-1">
                {/* Percentage bar */}
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.max(5, percents[1] ?? 0)}%`,
                      background:
                        live.winnerId && outcomes[0]?.id === live.winnerId
                          ? "rgba(255,255,255,0.25)"
                          : "#7ec8f5",
                    }}
                  />
                </div>
                {/* Percentage text */}
                <p className="text-xs text-white/60">
                  {Math.round(percents[1] ?? 0)}%
                </p>
              </div>
              {/* Kick-style red dots */}
              <div className="flex gap-1 pb-0.5">
                {[...Array(Math.max(1, Math.min(5, Math.ceil((percents[1] ?? 0) / 20))))].map(
                  (_, i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "#ff2b2b",
                        boxShadow: "0 0 4px rgba(255,43,43,0.6)",
                      }}
                    />
                  )
                )}
              </div>
            </div>
            {live.status === "resolved" && outcomes[1]?.id === live.winnerId && (
              <p className="mt-1 text-xs font-bold text-[#bee1fc]">★ {t("widget.prediction.winner")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
