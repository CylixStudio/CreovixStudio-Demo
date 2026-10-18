import { useLanguage } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AlertStage, type AlertStageHandle } from "@/components/alerts/AlertStage";
import { ALERT_FONT_HREF, type AlertEvent } from "@/lib/alertStudio";

export const Route = createFileRoute("/overlay/demo-alerts/$token")({
  head: () => ({
    meta: [{ title: "CylixStudio — Demo Alerts" }, { name: "robots", content: "noindex" }],
    links: [{ rel: "stylesheet", href: ALERT_FONT_HREF }],
  }),
  component: DemoAlertsOverlay,
});

function DemoAlertsOverlay() {
  const { t } = useLanguage();
  const { token } = Route.useParams();
  const [current, setCurrent] = useState<AlertEvent | null>(null);
  const [missing, setMissing] = useState(false);
  const stageRef = useRef<AlertStageHandle>(null);
  const overlayId = useRef<string>("");
  if (!overlayId.current && typeof crypto !== "undefined") overlayId.current = crypto.randomUUID();

  useEffect(() => {
    document.body.classList.add("overlay-transparent");
    const previous = document.documentElement.style.background;
    document.documentElement.style.background = "transparent";
    return () => {
      document.body.classList.remove("overlay-transparent");
      document.documentElement.style.background = previous;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let source: EventSource | null = null;
    let retry: number | null = null;
    let poll: number | null = null;
    let fallback = false;
    let finish: number | null = null;
    let playing = false;
    let currentId: string | null = null;
    let paused = false;

    const clearFinish = () => {
      if (finish) {
        window.clearTimeout(finish);
        finish = null;
      }
    };

    const ack = (id: string) =>
      fetch(`/api/demo/alert-studio/overlay/${token}/ack`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      }).catch(() => undefined);

    // Unmounting the stage stops its timers, audio and speech, which is exactly
    // what Skip needs: stop the alert on screen without waiting for it to finish.
    const endCurrent = () => {
      clearFinish();
      playing = false;
      currentId = null;
      setCurrent(null);
    };

    const requestNext = async () => {
      if (cancelled || playing || !overlayId.current) return;
      try {
        const response = await fetch(`/api/demo/alert-studio/overlay/${token}/claim`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ overlayId: overlayId.current }),
        });
        if (cancelled) return;
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) return;
        const payload = (await response.json()) as { status: string; event?: AlertEvent };
        if (cancelled || playing || payload.status !== "granted" || !payload.event) return;
        const event = payload.event;
        playing = true;
        currentId = event.id;
        setCurrent(event);
        finish = window.setTimeout(
          () => {
            void ack(event.id);
            endCurrent();
            void requestNext();
          },
          event.config.delayMs + event.config.durationMs + 320,
        );
      } catch {
        /* transient network issue; the next heartbeat retries */
      }
    };

    const handleControl = (payload: {
      type?: string;
      paused?: boolean;
      skipId?: string | null;
    }) => {
      paused = Boolean(payload.paused);
      if (payload.type === "skip") {
        // The server already removed the skipped alert; just stop the display.
        if (payload.skipId && payload.skipId === currentId) {
          endCurrent();
          void requestNext();
        }
        return;
      }
      if (!paused) void requestNext();
    };

    const syncFallback = async () => {
      try {
        const response = await fetch(`/api/demo/alert-studio/overlay/${token}/live`, {
          cache: "no-store",
        });
        if (cancelled) return;
        if (response.status === 404) {
          setMissing(true);
          return;
        }
        if (!response.ok) return;
        const payload = (await response.json()) as { paused?: boolean };
        paused = Boolean(payload.paused);
        if (!paused) void requestNext();
      } catch {
        /* transient */
      }
    };

    const connect = () => {
      source?.close();
      source = new EventSource(`/api/demo/alert-studio/overlay/${token}/stream`);
      source.addEventListener("init", (event) => {
        fallback = false;
        if (poll) window.clearInterval(poll);
        poll = null;
        const payload = JSON.parse((event as MessageEvent).data) as { paused?: boolean };
        paused = Boolean(payload.paused);
        void requestNext();
      });
      source.addEventListener("alert", () => {
        if (!paused) void requestNext();
      });
      source.addEventListener("control", (event) => {
        handleControl(JSON.parse((event as MessageEvent).data));
      });
      source.onerror = () => {
        source?.close();
        if (cancelled || fallback) return;
        fallback = true;
        void syncFallback();
        poll = window.setInterval(() => void syncFallback(), 2000);
        retry = window.setTimeout(connect, 2000);
      };
    };

    connect();

    const beat = () => {
      void fetch(`/api/demo/alert-studio/overlay/${token}/presence`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ overlayId: overlayId.current }),
      }).catch(() => undefined);
      // An idle source keeps nudging the queue: this both claims the display
      // lease when it is free and picks up work the moment it becomes active.
      if (!playing) void requestNext();
    };
    void beat();
    const presence = window.setInterval(beat, 4000);

    return () => {
      cancelled = true;
      source?.close();
      if (retry) window.clearTimeout(retry);
      if (poll) window.clearInterval(poll);
      if (finish) window.clearTimeout(finish);
      window.clearInterval(presence);
    };
  }, [token]);

  useEffect(() => {
    if (!current) return;
    const frame = window.requestAnimationFrame(() => stageRef.current?.play());
    return () => window.cancelAnimationFrame(frame);
  }, [current]);

  return (
    <main className="grid min-h-screen place-items-center bg-transparent p-8">
      {missing ? <p className="text-sm text-white/50">{t("alerts.badOverlay")}</p> : null}
      {current ? (
        <AlertStage
          key={current.id}
          ref={stageRef}
          mode="overlay"
          config={current.config}
          alertId={current.alertId}
          text={current.text}
          username={current.username}
          count={current.count}
          months={current.months}
          amount={current.amount}
          message={current.message}
          visualId={current.visualId}
          visualMime={current.visualMime}
          audioId={current.audioId}
        />
      ) : null}
    </main>
  );
}
