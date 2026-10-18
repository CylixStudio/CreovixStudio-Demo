import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
  formatUptime,
  kickChannelUrl,
  loadTestMarks,
  loadTestShareSettings,
  markSpanSeconds,
  markStatusDotClass,
  markStatusLabel,
  markSharePath,
  markTitle,
  MARK_STATUSES,
  setTestMarkStatus,
  testShareGateAllowed,
  type MarkStatus,
  type StreamMark,
} from "@/lib/markPoints";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isTestMode } from "@/lib/testMode";
import { cn } from "@/lib/utils";

type SharedPayload = {
  channelName: string;
  channelUrl: string | null;
  marks: StreamMark[];
};

export const Route = createFileRoute("/marks/$token")({
  head: () => ({
    meta: [
      { title: "CylixStudio — Mark Points" },
      { name: "description", content: "Private review of stream marks. Authorized names only." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: SharedMarksPage,
});

async function bearerHeaders(): Promise<HeadersInit> {
  if (!isSupabaseConfigured()) return {};
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function SharedMarksPage() {
  const { token } = Route.useParams();
  const test = isTestMode();
  const [payload, setPayload] = useState<SharedPayload | null>(null);
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
    empty: "No marks yet.",
    watch: "Watch",
    start: "Start",
    end: "End",
    duration: "Duration",
    status: "Status",
    stream: "Stream",
    open: "open",
    offline: "offline",
    note: "Note",
  };

  const loadLive = async () => {
    const response = await fetch(`/api/public/marks/${encodeURIComponent(token)}/live`, {
      cache: "no-store",
      headers: await bearerHeaders(),
    });
    if (response.ok) {
      setPayload((await response.json()) as SharedPayload);
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
          if (!stopped) {
            setPayload({
              channelName: settings.kickUsername,
              channelUrl: kickChannelUrl(settings.kickUsername),
              marks: loadTestMarks(),
            });
            setPhase("ready");
          }
          return;
        }
        if (!stopped) setPhase("gate");
        return;
      }
      await loadLive();
    };
    void run();
    return () => {
      stopped = true;
    };
  }, [token, test]);

  const unlock = async () => {
    setDenied(false);
    if (test) {
      if (!testShareGateAllowed(username)) {
        setDenied(true);
        return;
      }
      sessionStorage.setItem(`creovix:mark-gate:${token}`, username);
      const settings = loadTestShareSettings();
      setPayload({
        channelName: settings.kickUsername,
        channelUrl: kickChannelUrl(settings.kickUsername),
        marks: loadTestMarks(),
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
    await loadLive();
  };

  const changeStatus = async (id: string, status: MarkStatus) => {
    if (test) {
      setTestMarkStatus(id, status);
      setPayload((current) => (current ? { ...current, marks: loadTestMarks() } : current));
      return;
    }
    const response = await fetch(`/api/public/marks/${encodeURIComponent(token)}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await bearerHeaders()) },
      body: JSON.stringify({ id, status }),
    });
    if (response.ok) await loadLive();
  };

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

      {phase === "ready" && payload ? (
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
          {payload.marks.length === 0 ? (
            <p className="mt-8 text-sm text-zinc-500">{copy.empty}</p>
          ) : (
            <div className="mt-6 grid w-full grid-cols-[repeat(auto-fill,minmax(190px,1fr))] justify-items-start gap-4">
              {payload.marks.map((mark) => (
                <ReviewMarkCard
                  key={mark.id}
                  token={token}
                  mark={mark}
                  copy={copy}
                  onStatus={(status) => void changeStatus(mark.id, status)}
                />
              ))}
            </div>
          )}
        </div>
      ) : null}
    </main>
  );
}

function ReviewMarkCard({
  token,
  mark,
  copy,
  onStatus,
}: {
  token: string;
  mark: StreamMark;
  copy: { duration: string; open: string; offline: string; status: string; watch: string };
  onStatus: (status: MarkStatus) => void;
}) {
  const open = !mark.endedAt;
  const startLabel = mark.offline ? copy.offline : formatUptime(mark.uptimeStartSeconds);
  const endLabel = mark.offline
    ? copy.offline
    : open
      ? copy.open
      : formatUptime(mark.uptimeEndSeconds);
  const span = mark.offline ? null : markSpanSeconds(mark);
  const statusText = markStatusLabel(mark.status);

  return (
    <article className="flex w-full min-w-0 flex-col overflow-hidden rounded-[20px] bg-zinc-900">
      <div className="flex flex-1 flex-col justify-center gap-0.5 px-3 pb-2 pt-3 text-center">
        <div className="flex items-center justify-center gap-1.5">
          <span
            className={cn("size-2 shrink-0 rounded-full", markStatusDotClass(mark.status))}
            title={statusText}
            aria-label={statusText}
          />
          <h3
            className="max-w-full truncate font-mono text-sm font-semibold tracking-tight text-zinc-100"
            dir="auto"
          >
            {markTitle(mark)}
          </h3>
        </div>
        <p className="font-mono text-[0.68rem] tabular-nums text-zinc-400" dir="ltr">
          {startLabel}
          {" → "}
          {endLabel}
        </p>
        <p className="text-[0.68rem] text-zinc-500">
          {copy.duration}{" "}
          <span className="font-mono tabular-nums" dir="ltr">
            {mark.offline ? copy.offline : formatUptime(span)}
          </span>
        </p>
        {open || mark.offline ? (
          <p className="text-[0.6rem] uppercase tracking-wide text-zinc-500">
            {mark.offline ? copy.offline : copy.open}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] px-2 py-1.5">
        <label className="min-w-0">
          <span className="sr-only">{copy.status}</span>
          <select
            value={mark.status}
            onChange={(event) => onStatus(event.target.value as MarkStatus)}
            className="h-7 max-w-full rounded-md border-0 bg-transparent pe-1 text-[0.65rem] text-zinc-200 outline-none"
          >
            {MARK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {markStatusLabel(status)}
              </option>
            ))}
          </select>
        </label>
        <a
          href={markSharePath(token, mark.id)}
          className="shrink-0 rounded-md px-2 py-1 text-[0.68rem] font-medium text-zinc-200 hover:bg-zinc-800"
        >
          {copy.watch}
        </a>
      </div>
    </article>
  );
}
