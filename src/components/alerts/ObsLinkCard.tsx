import { useState } from "react";
import { Check, Copy, Radio } from "lucide-react";

import { overlayUrl } from "@/components/alerts/alertApi";

export function ObsLinkCard({ token, seenAt }: { token: string; seenAt: number }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window === "undefined"
      ? `/overlay/demo-alerts/${token}`
      : overlayUrl(window.location.origin, token);
  const connected = seenAt > 0 && Date.now() - seenAt < 12_000;

  return (
    <section className="rounded-3xl border border-white/10 bg-[#12151a] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">رابط OBS Browser Source</h2>
        <span
          className="inline-flex items-center gap-1.5 text-xs"
          style={{ color: connected ? "#bee1fc" : "#a3a3a3" }}
        >
          <Radio className="size-3.5" />
          {connected ? "المعاينة متصلة" : "بانتظار فتح الرابط"}
        </span>
      </div>
      <p className="mb-3 text-xs leading-5 text-white/50">
        رابط Demo فقط. لا يحتوي مفاتيح حساب، ولا يعمل كرابط Production.
      </p>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/40 px-3 py-2">
        <code dir="ltr" className="min-w-0 flex-1 truncate text-xs text-white/80">
          {url}
        </code>
        <button
          type="button"
          className="grid size-8 shrink-0 place-items-center rounded-xl text-white/70 hover:bg-white/5"
          onClick={() => {
            void navigator.clipboard.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          }}
          aria-label="نسخ رابط OBS"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </button>
      </div>
    </section>
  );
}
