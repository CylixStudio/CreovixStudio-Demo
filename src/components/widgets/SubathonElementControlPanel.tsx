import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Pause, Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SessionAwareError } from "@/components/widgets/SessionAwareError";
import { widgetErrorText } from "@/lib/createWidget";
import { InfoTip } from "@/components/ui/info-tip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { adjustTimer, pauseTimer, resetTimer, setTimer, startTimer } from "@/lib/timer.functions";
import { useLanguage, type TranslationKey } from "@/lib/i18n";
import { publishDemoTimerFrame } from "@/lib/subathonDemoSync";
import { displayedSeconds, formatDuration, remainingMsAt, type TimerFrame } from "@/lib/timer";

const ADJUSTMENTS = [
  { seconds: 60, labelKey: "sub.ctl.p1m" },
  { seconds: 600, labelKey: "sub.ctl.p10m" },
  { seconds: 3600, labelKey: "sub.ctl.p1h" },
  { seconds: -60, labelKey: "sub.ctl.m1m" },
  { seconds: -600, labelKey: "sub.ctl.m10m" },
  { seconds: -3600, labelKey: "sub.ctl.m1h" },
] as const;

const STATUS_KEY: Record<string, TranslationKey> = {
  IDLE: "sub.ctl.status.IDLE",
  RUNNING: "sub.ctl.status.RUNNING",
  PAUSED: "sub.ctl.status.PAUSED",
  ENDED: "sub.ctl.status.ENDED",
};

const channelName = (subathonId: string) => `creovix-timer-${subathonId}`;

const projectSeconds = (next: TimerFrame) => displayedSeconds(remainingMsAt(next, Date.now()));

const twoDigits = (value: number) => String(Math.max(0, Math.floor(value))).padStart(2, "0");

export function SubathonElementControlPanel({
  widgetId,
  subathonId,
  frame,
  remaining,
  compact = false,
  embedded = false,
}: {
  widgetId: string;
  subathonId: string | null;
  frame: TimerFrame | null;
  remaining: number;
  config?: Record<string, unknown>;
  onConfigChange?: (key: string, value: unknown) => void;
  onSaveConfig?: () => Promise<unknown> | void;
  compact?: boolean;
  embedded?: boolean;
  lang?: "ar" | "en";
}) {
  const start = useServerFn(startTimer);
  const pause = useServerFn(pauseTimer);
  const reset = useServerFn(resetTimer);
  const adjust = useServerFn(adjustTimer);
  const setTime = useServerFn(setTimer);
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFrame, setLocalFrame] = useState<TimerFrame | null>(frame);
  const [localRemaining, setLocalRemaining] = useState(remaining);
  const [hours, setHours] = useState("00");
  const [minutes, setMinutes] = useState("00");
  const [seconds, setSeconds] = useState("00");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLocalFrame(frame);
    setLocalRemaining(remaining);
  }, [frame, remaining]);

  // Keep the editable digits in sync with the live timer while untouched.
  useEffect(() => {
    if (editing) return;
    const total = Math.max(0, Math.floor(localRemaining));
    setHours(twoDigits(total / 3600));
    setMinutes(twoDigits((total % 3600) / 60));
    setSeconds(twoDigits(total % 60));
  }, [localRemaining, editing]);

  useEffect(() => {
    if (!subathonId) return;
    const channel = new BroadcastChannel(channelName(subathonId));
    channel.onmessage = (event: MessageEvent<{ frame?: TimerFrame }>) => {
      if (event.data.frame) {
        setLocalFrame(event.data.frame);
        setLocalRemaining(projectSeconds(event.data.frame));
      }
    };
    return () => channel.close();
  }, [subathonId]);

  const publishFrame = (next: TimerFrame) => {
    setLocalFrame(next);
    setLocalRemaining(projectSeconds(next));
    publishDemoTimerFrame(widgetId, next);
    if (!subathonId) return;
    const channel = new BroadcastChannel(channelName(subathonId));
    channel.postMessage({ frame: next });
    channel.close();
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const result = await action();
      publishFrame(result as TimerFrame);
    } catch (caught) {
      setError(widgetErrorText(caught, t("sub.ctl.actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  const applyCustomTime = () => {
    const total =
      Math.min(999, Math.max(0, Number(hours) || 0)) * 3600 +
      Math.min(59, Math.max(0, Number(minutes) || 0)) * 60 +
      Math.min(59, Math.max(0, Number(seconds) || 0));
    setEditing(false);
    void run(() => setTime({ data: { ...payload, seconds: total } }));
  };

  const payload = subathonId ? { subathonId } : {};
  const status = localFrame?.status ?? "IDLE";
  const primaryLabel =
    status === "RUNNING"
      ? t("sub.ctl.pause")
      : status === "PAUSED"
        ? t("sub.ctl.resume")
        : t("sub.ctl.start");

  const digitInput =
    "w-full rounded-md bg-transparent text-center font-mono text-4xl font-bold tabular-nums text-foreground outline-none transition focus:bg-primary/10 focus:ring-1 focus:ring-primary sm:text-5xl";

  return (
    <section className={embedded ? "space-y-4" : "surface-card overflow-hidden"}>
      <header
        className={`flex items-center justify-between gap-2 ${embedded ? "" : "border-b border-white/8 px-4 py-3"}`}
      >
        <div className="min-w-0">
          <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-primary">{t("sub.ctl.title")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("sub.ctl.subtitle")}</p>
        </div>
        {!compact ? (
          <Button type="button" variant="ghost" size="icon" onClick={() => window.open(`/widgets/${widgetId}/control`, `creovix-timer-${widgetId}`, "popup=yes,width=520,height=820,resizable=yes,scrollbars=yes")} title={t("sub.ctl.popout")} aria-label={t("sub.ctl.popout")}>
            <ExternalLink aria-hidden />
          </Button>
        ) : null}
      </header>

      <div className={embedded ? "space-y-5" : "space-y-5 p-4"}>
        <div className="surface-inset px-4 py-6 text-center">
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.24em] text-muted-foreground">{t(STATUS_KEY[status] ?? "sub.ctl.status.IDLE")}</span>
          <div className="mt-2 flex items-center justify-center gap-1" dir="ltr">
            <input
              aria-label={t("sub.ctl.hours")}
              inputMode="numeric"
              className={`${digitInput} max-w-[2.4ch]`}
              value={hours}
              onFocus={() => setEditing(true)}
              onChange={(event) => setHours(event.target.value.replace(/\D/g, "").slice(0, 3))}
              onKeyDown={(event) => { if (event.key === "Enter") applyCustomTime(); }}
            />
            <span className="font-mono text-4xl font-bold text-muted-foreground sm:text-5xl">:</span>
            <input
              aria-label={t("sub.ctl.minutes")}
              inputMode="numeric"
              className={`${digitInput} max-w-[2.2ch]`}
              value={minutes}
              onFocus={() => setEditing(true)}
              onChange={(event) => setMinutes(event.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(event) => { if (event.key === "Enter") applyCustomTime(); }}
            />
            <span className="font-mono text-4xl font-bold text-muted-foreground sm:text-5xl">:</span>
            <input
              aria-label={t("sub.ctl.seconds")}
              inputMode="numeric"
              className={`${digitInput} max-w-[2.2ch]`}
              value={seconds}
              onFocus={() => setEditing(true)}
              onChange={(event) => setSeconds(event.target.value.replace(/\D/g, "").slice(0, 2))}
              onKeyDown={(event) => { if (event.key === "Enter") applyCustomTime(); }}
            />
          </div>
          {editing ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="mt-3"
              disabled={busy || !subathonId}
              onClick={applyCustomTime}
            >
              {t("sub.ctl.setTime")}
            </Button>
          ) : (
            <p className="mt-2 text-[0.65rem] text-muted-foreground">
              {t("sub.ctl.clickDigits")}
            </p>
          )}
        </div>

        <Button
          type="button"
          size="lg"
          className="h-12 w-full text-base"
          disabled={busy || !subathonId}
          onClick={() => void run(() => status === "RUNNING" ? pause({ data: payload }) : start({ data: payload }))}
        >
          {status === "RUNNING" ? <Pause aria-hidden /> : <Play aria-hidden />}{primaryLabel}
        </Button>

        <div>
          <p className="mb-2 inline-flex items-center gap-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            {t("sub.ctl.changeDuration")}
            <InfoTip text={t("tooltips.subathon.changeDuration")} />
          </p>
          <div className="grid grid-cols-3 gap-2">
            {ADJUSTMENTS.map((entry) => (
              <Button key={entry.seconds} type="button" variant="outline" disabled={busy || !subathonId} onClick={() => void run(() => adjust({ data: { ...payload, seconds: entry.seconds } }))}>
                <bdi>{t(entry.labelKey)}</bdi>
              </Button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-destructive/35 bg-destructive/5 p-4">
          <p className="font-semibold text-destructive">{t("sub.ctl.resetQuestion")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("sub.ctl.resetHint")}</p>
          <Button type="button" variant="destructive" className="mt-3 w-full" disabled={busy || !subathonId} onClick={() => setResetOpen(true)}>
            <RotateCcw aria-hidden />{t("sub.ctl.reset")}
          </Button>
        </div>
      </div>

      <SessionAwareError error={error} signedOutLabel={t("widget.signedOut")} className="mx-4 mb-4 text-xs" />

      <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sub.ctl.resetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("sub.ctl.resetDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => void run(() => reset({ data: payload }))}>{t("sub.ctl.reset")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
