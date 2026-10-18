import { useState } from "react";
import { toast } from "sonner";

import { appendDemoMessages, clearDemoMessages, type DemoChatMessage } from "@/lib/demoStore";

const BADGES = [
  { type: "broadcaster", label: "Broadcaster" },
  { type: "moderator", label: "Moderator" },
  { type: "vip", label: "VIP" },
  { type: "subscriber", label: "Subscriber" },
  { type: "sub_gifter", label: "Sub gifter" },
  { type: "verified", label: "Verified" },
  { type: "founder", label: "Founder" },
  { type: "og", label: "OG" },
  { type: "staff", label: "Staff" },
] as const;

const AVATARS = [
  { id: "cyan", label: "Cyan", url: svgAvatar("#7ee7ff") },
  { id: "amber", label: "Amber", url: svgAvatar("#f5c16c") },
  { id: "violet", label: "Violet", url: svgAvatar("#c4b5fd") },
] as const;

const ARABIC = "مرحباً بالجميع، هذه رسالة تجريبية من الدردشة المحلية.";
const ENGLISH = "Hello chat, this is a local demo message.";
const LONG =
  "This is a long demo message meant to wrap inside the live chat bubble. It stays on the local overlay only, uses the real chat renderer, and should show the full line without calling Kick or Supabase.";

function svgAvatar(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#141820"/><circle cx="32" cy="24" r="12" fill="${color}"/><ellipse cx="32" cy="58" rx="20" ry="16" fill="${color}"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function message(partial: Omit<DemoChatMessage, "id" | "at" | "platform"> & { at?: number }): DemoChatMessage {
  return {
    id: `demo-msg-${crypto.randomUUID()}`,
    platform: "KICK",
    at: partial.at ?? Date.now(),
    author: partial.author,
    color: partial.color,
    badges: partial.badges,
    badgeList: partial.badgeList,
    avatarUrl: partial.avatarUrl,
    text: partial.text,
  };
}

export function DemoChatTester({
  publicToken,
  onEnableSubscriberBadge,
}: {
  publicToken: string;
  onEnableSubscriberBadge: () => void;
}) {
  const [author, setAuthor] = useState("DemoChatter");
  const [color, setColor] = useState("#7ee7ff");
  const [avatar, setAvatar] = useState<string>(AVATARS[0].url);
  const [selected, setSelected] = useState<string[]>(["subscriber", "moderator"]);
  const [months, setMonths] = useState(6);
  const [text, setText] = useState("احح تصويت");
  const [busy, setBusy] = useState(false);

  const build = (text: string, at = Date.now()): DemoChatMessage => {
    if (selected.includes("subscriber")) onEnableSubscriberBadge();
    const badgeList = selected.map((type) =>
      type === "subscriber"
        ? { type, text: `${months}`, count: months }
        : type === "sub_gifter"
          ? { type, text: "25", count: 25 }
          : { type, text: type, count: null },
    );
    return message({
      author: author.trim() || "DemoChatter",
      color,
      avatarUrl: avatar,
      badges: selected,
      badgeList,
      text,
      at,
    });
  };

  const send = async (rows: DemoChatMessage[]) => {
    setBusy(true);
    try {
      await appendDemoMessages(publicToken, rows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the demo message.");
    } finally {
      setBusy(false);
    }
  };

  const sendSequence = async () => {
    setBusy(true);
    try {
      const start = Date.now();
      await appendDemoMessages(publicToken, [
        build(LONG, start),
        build(ENGLISH, start + 1),
        build(ARABIC, start + 2),
      ]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the demo sequence.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div>
        <h3 className="text-sm font-semibold">Demo chat tester</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Local messages only. They render in the live preview and on the local overlay. Kick is not connected.
        </p>
      </div>
      <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Username
        <input
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal"
          value={author}
          onChange={(event) => setAuthor(event.target.value)}
        />
      </label>
      <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        User color
        <input className="mt-2 h-9 w-full" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
      </label>
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Avatar</p>
        <div className="mt-2 flex gap-2">
          {AVATARS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={avatar === item.url}
              onClick={() => setAvatar(item.url)}
              className={`rounded-full border p-0.5 ${avatar === item.url ? "border-primary" : "border-transparent"}`}
            >
              <img src={item.url} alt={item.label} className="size-8 rounded-full" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Kick badges</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BADGES.map((badge) => {
            const on = selected.includes(badge.type);
            return (
              <button
                key={badge.type}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setSelected((current) =>
                    current.includes(badge.type) ? current.filter((type) => type !== badge.type) : [...current, badge.type],
                  )
                }
                className={`rounded-full border px-2.5 py-1 text-[11px] ${on ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}
              >
                {badge.label}
              </button>
            );
          })}
        </div>
      </div>
      <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Subscriber months
        <input
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal"
          type="number"
          min={1}
          max={120}
          value={months}
          onChange={(event) => setMonths(Math.min(120, Math.max(1, Number(event.target.value) || 1)))}
        />
      </label>
      <label className="block text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
        Message
        <input
          className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      <button
        type="button"
        disabled={busy || !text.trim()}
        className="w-full rounded-lg border border-primary/40 px-3 py-2 text-xs"
        onClick={() => void send([build(text.trim())])}
      >
        Send line
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => void send([build(ARABIC)])}>
          Arabic message
        </button>
        <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => void send([build(ENGLISH)])}>
          English message
        </button>
        <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => void sendSequence()}>
          Send a sequence
        </button>
        <button type="button" disabled={busy} className="rounded-lg border border-border px-3 py-2 text-xs" onClick={() => void send([build(LONG)])}>
          Long message
        </button>
      </div>
      <button
        type="button"
        disabled={busy}
        className="w-full rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground"
        onClick={() => void clearDemoMessages(publicToken)}
      >
        Clear demo messages
      </button>
    </section>
  );
}
