import { useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, KeyRound, X } from "lucide-react";
import { useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { formatCode, normalizeCode } from "@/hooks/useSubscription";
type Feedback = { kind: "success" | "error"; message: string } | null;

export function RedeemCodeModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();

  const [value, setValue] = useState("");
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const raw = normalizeCode(value);
  const valid = raw.length === 16;

  const activate = async () => {
    if (!valid) return;
    setPending(true);
    setFeedback(null);
    try {
      const { data, error } = await supabase.rpc("redeem_activation_code", { p_code: raw });
      if (error) throw error;
      const result = data as {
        ok: boolean;
        reason?: string;
        duration_days?: number;
        is_lifetime?: boolean;
        expires_at?: string;
      } | null;
      if (result?.ok) {
        const days = result.duration_days ?? 30;
        const until = result.expires_at ? new Date(result.expires_at).toLocaleDateString() : "";
        setFeedback({
          kind: "success",
          message: result.is_lifetime
            ? "Activated! Lifetime Access ♾️"
            : `Activated! ${days} days added — valid until ${until}.`,
        });
        await queryClient.invalidateQueries({ queryKey: ["subscription"] });
        setTimeout(onClose, 1600);
        return;
      }

      const expired = result?.reason === "expired";
      setFeedback({
        kind: "error",
        message: expired
          ? "This code has expired."
          : "Invalid or already used code.",
      });
    } catch (err) {
      setFeedback({
        kind: "error",
        message: err instanceof Error ? err.message : "Activation failed.",
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={"Activate your subscription"}
      className="fixed inset-0 z-[60] grid place-items-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="glass-3d relative w-full max-w-md rounded-2xl p-6"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={"Close"}
          className="absolute end-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>

        <span
          className="grid size-11 place-items-center rounded-xl border border-[oklch(1_0_0/0.1)]"
          style={{
            background:
              "linear-gradient(140deg, color-mix(in oklab, var(--primary) 55%, transparent), color-mix(in oklab, var(--cyan, #22d3ee) 35%, transparent))",
          }}
        >
          <KeyRound className="size-5 text-primary-foreground" aria-hidden />
        </span>

        <h2 className="mt-4 text-lg font-semibold tracking-tight">
          {"Activate your subscription"}
        </h2>
        <p className="mt-1.5 text-[0.8rem] leading-relaxed text-muted-foreground">
          {"Enter your 16-character license code to unlock all streaming widgets and tools."}
        </p>

        <input
          autoFocus
          dir="ltr"
          value={formatCode(value)}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void activate();
          }}
          placeholder="XXXX - XXXX - XXXX - XXXX"
          aria-label={"License code"}
          className={`mt-5 w-full rounded-xl border bg-[oklch(1_0_0/0.04)] px-4 py-3.5 text-center font-mono text-lg tracking-[0.25em] outline-none transition-colors ${
            raw.length === 0
              ? "border-[oklch(1_0_0/0.1)] focus:border-primary"
              : valid
                ? "border-emerald-500/60"
                : "border-amber-500/50"
          }`}
        />
        <p className="mt-2 text-center text-[0.7rem] text-muted-foreground">
          {raw.length}/16
        </p>

        {feedback ? (
          <div
            className={`mt-4 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-[0.8rem] ${
              feedback.kind === "success"
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                : "border-red-500/40 bg-red-500/10 text-red-400"
            }`}
            role="status"
          >
            {feedback.kind === "success" ? (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
            ) : (
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            )}
            <span>{feedback.message}</span>
          </div>
        ) : null}

        <button
          type="button"
          disabled={!valid || pending}
          onClick={() => void activate()}
          className="mt-5 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_12px_34px_-12px_var(--primary)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending
            ? "Activating…"
            : "Activate code"}
        </button>
      </div>
    </div>
  );
}
