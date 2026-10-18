import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { MarkVodPlayer } from "@/components/marks/MarkVodPlayer";
import {
  formatUptime,
  kickChannelUrl,
  loadTestMarks,
  loadTestShareSettings,
  markSpanSeconds,
  markStatusDotClass,
  markStatusLabel,
  markTitle,
  MARK_STATUSES,
  setTestMarkStatus,
  testShareGateAllowed,
  type MarkPlaybackPayload,
  type MarkStatus,
} from "@/lib/markPoints";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isTestMode } from "@/lib/testMode";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/marks/$token/$markId")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Mark Points" },
      { name: "description", content: "Private playback of a stream mark. Authorized names only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: MarkPlaybackPage,
});

async function bearerHeaders(): Promise<HeadersInit> {
  if (!isSupabaseConfigured()) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function MarkPlaybackPage() {
  const { token, markId } = Route.useParams();
  const test = isTestMode();
  const [payload, setPayload] = useState<MarkPlaybackPayload | null>(null);
  const [phase, setPhase] = useState<"loading" | "gate" | "ready" | "missing">("loading");
  const [username, setUsername] = useState("");
  const [denied, setDenied] = useState(false);

  const copy = {
    title: "Mark Points",
    gateHint: "Enter your Kick username. The link alone is not enough.",
    username: "Kick username",
    enter: "Enter",
    denied: "That name is not allowed.",
    missing: "This link is not valid.",
    back: "All marks",
    start: "Start",
    end: "End",
    duration: "Duration",
    status: "Status",
    open: "open",
    offline: "offline",
    emptyVod: "No recording yet",
    seekHint: "Starts at",
  };

  const loadPlayback = async () => {
    const response = await fetch(
      `/api/public/marks/${encodeURIComponent(token)}/vod/${encodeURIComponent(markId)}`,
      { cache: "no-store", headers: await bearerHeaders() },
    );
    if (response.ok) {
      setPayload((await response.json()) as MarkPlaybackPayload);
      setPhase("ready");
      return true;
    }
    if (response.status === 404) {
      setPhase("missing");
      return false;
    }
    setPhase("gate");
    return false;
  };

  useEffect(() => {
    let stopped = false;
    const run = async () => {
      if (test) {
        const settings = loadTestShareSettings();
        if (token !== settings.shareToken) {
          if (!stopped) setPhase("missing");
          return;
        }
        const stored = sessionStorage.getItem(`creovix:mark-gate:${token}`);
        if (stored && testShareGateAllowed(stored)) {
          const mark = loadTestMarks().find((row) => row.id === markId);
          if (!mark) {
            if (!stopped) setPhase("missing");
            return;
          }
          if (!stopped) {
            setPayload({
              channelName: settings.kickUsername,
              channelUrl: kickChannelUrl(settings.kickUsername),
              mark,
              vod: null,
            });
            setPhase("ready");
          }
          return;
        }
        if (!stopped) setPhase("gate");
        return;
      }
      await loadPlayback();
    };
    void run();
    return () => {
      stopped = true;
    };
  }, [token, markId, test]);

  const unlock = async () => {
    setDenied(false);
    if (test) {
      if (!testShareGateAllowed(username)) {
        setDenied(true);
        return;
      }
      sessionStorage.setItem(`creovix:mark-gate:${token}`, username);
      const settings = loadTestShareSettings();
      const mark = loadTestMarks().find((row) => row.id === markId);
      if (!mark) {
        setPhase("missing");
        return;
      }
      setPayload({
        channelName: settings.kickUsername,
        channelUrl: kickChannelUrl(settings.kickUsername),
        mark,
        vod: null,
      });
      setPhase("ready");
      return;
    }
    const response = await fetch(`/api/public/marks/${encodeURIComponent(token)}/gate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    if (!response.ok) {
      setDenied(true);
      if (response.status === 404) setPhase("missing");
      return;
    }
    await loadPlayback();
  };

  const changeStatus = async (status: MarkStatus) => {
    if (!payload) return;
    if (test) {
      setTestMarkStatus(payload.mark.id, status);
      const mark = loadTestMarks().find((row) => row.id === payload.mark.id);
      if (mark) setPayload({ ...payload, mark });
      return;
    }
    const response = await fetch(`/api/public/marks/${encodeURIComponent(token)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearerHeaders()) },
      body: JSON.stringify({ id: payload.mark.id, status }),
    });
    if (response.ok) await loadPlayback();
  };

  const mark = payload?.mark;
  const open = mark ? !mark.endedAt : false;
  const startLabel = mark
    ? mark.offline
      ? copy.offline
      : formatUptime(mark.uptimeStartSeconds)
    : "—";
  const endLabel = mark
    ? mark.offline
      ? copy.offline
      : open
        ? copy.open
        : formatUptime(mark.uptimeEndSeconds)
    : "—";
  const span = mark && !mark.offline ? markSpanSeconds(mark) : null;

  return (
    <main className="min-h-svh bg-zinc-950 px-4 text-zinc-100" dir={"ltr"}>
      {phase === "loading" || phase === "missing" || phase === "gate" ? (
        <div className="flex min-h-svh items-center justify-center">
          {phase === "loading" ? <p className="text-sm text-zinc-500">…</p> : null}
          {phase === "missing" ? <p className="text-sm text-zinc-500">{copy.missing}</p> : null}
          {phase === "gate" ? (
            <form
              className="w-full max-w-sm rounded-[20px] bg-zinc-900 p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void unlock();
              }}
            >
              <h1 className="text-lg font-semibold tracking-tight">{copy.title}</h1>
              <p className="mt-2 text-sm text-zinc-400">{copy.gateHint}</p>
              <label className="mt-4 block">
                <span className="mb-1.5 block text-[0.72rem] uppercase tracking-wide text-zinc-500">
                  {copy.username}
                </span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm outline-none focus:border-zinc-600"
                  dir="auto"
                />
              </label>
              {denied ? <p className="mt-2 text-[0.78rem] text-red-400">{copy.denied}</p> : null}
              <button
                type="submit"
                className="mt-4 rounded-full bg-zinc-100 px-4 py-2 text-[0.82rem] font-semibold text-zinc-900"
              >
                {copy.enter}
              </button>
            </form>
          ) : null}
        </div>
      ) : null}

      {phase === "ready" && payload && mark ? (
        <div className="mx-auto w-full max-w-5xl py-10 text-start">
          <h1 className="text-xl font-semibold tracking-tight">{copy.title}</h1>
          {payload.channelUrl ? (
            <a
              href={payload.channelUrl}
              className="mt-2 inline-block text-start text-sm text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline"
              dir="ltr"
            >
              {payload.channelUrl}
            </a>
          ) : null}
          <Link
            to="/marks/$token"
            params={{ token }}
            className="mt-4 inline-block text-[0.78rem] text-zinc-500 underline-offset-4 hover:text-zinc-200 hover:underline"
          >
            {copy.back}
          </Link>

          <div className="mt-6 overflow-hidden rounded-[20px] bg-zinc-900">
            <div className="aspect-video w-full bg-zinc-950">
              <MarkVodPlayer vod={payload.vod} emptyLabel={copy.emptyVod} />
            </div>
            <div className="space-y-3 p-5">
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-2 shrink-0 rounded-full", markStatusDotClass(mark.status))}
                  aria-hidden
                />
                <h2 className="truncate text-[1.05rem] font-semibold" dir="auto">
                  {markTitle(mark)}
                </h2>
              </div>
              <p className="text-[0.78rem] text-zinc-400">
                {copy.start}{" "}
                <span className="font-mono tabular-nums" dir="ltr">
                  {startLabel}
                </span>
                {" · "}
                {copy.end}{" "}
                <span className="font-mono tabular-nums" dir="ltr">
                  {endLabel}
                </span>
                {" · "}
                {copy.duration}{" "}
                <span className="font-mono tabular-nums" dir="ltr">
                  {mark.offline ? copy.offline : formatUptime(span)}
                </span>
              </p>
              {payload.vod?.seekSeconds != null ? (
                <p className="text-[0.72rem] text-zinc-500">
                  {copy.seekHint}{" "}
                  <span className="font-mono tabular-nums" dir="ltr">
                    {formatUptime(payload.vod.seekSeconds)}
                  </span>
                </p>
              ) : null}
              <label className="block max-w-48">
                <span className="sr-only">{copy.status}</span>
                <select
                  value={mark.status}
                  onChange={(event) => void changeStatus(event.target.value as MarkStatus)}
                  className="h-8 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 text-[0.72rem] text-zinc-100 outline-none"
                >
                  {MARK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {markStatusLabel(status)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
