import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import { useLanguage } from "@/lib/i18n";

type ErrorFallbackProps = {
  error: unknown;
  reset?: () => void;
};

function asError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Unknown error");
}

export function ErrorFallback({ error, reset }: ErrorFallbackProps) {
  const router = useRouter();
  const { t } = useLanguage();
  const err = asError(error);
  const isDev = import.meta.env.DEV;

  const retry = () => {
    void router.invalidate();
    reset?.();
  };

  return (
    <div className="ambient-field flex min-h-screen items-center justify-center bg-background px-4 py-16 text-foreground">
      <div className="glass-3d w-full max-w-md rounded-2xl p-8 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-[color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color-mix(in_oklab,var(--primary)_16%,transparent)]">
          <AlertTriangle className="size-6 text-primary" aria-hidden />
        </span>
        <h1 className="mt-5 text-xl font-semibold tracking-tight">{t("error.title")}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t("error.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={retry}
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.retry")}
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full border border-[oklch(1_0_0/0.12)] bg-[oklch(1_0_0/0.04)] px-5 py-2 text-sm font-medium text-foreground transition-colors hover:bg-[oklch(1_0_0/0.08)]"
          >
            {t("error.home")}
          </Link>
        </div>
        {isDev ? (
          <details className="mt-6 rounded-xl border border-[oklch(1_0_0/0.08)] bg-[oklch(0_0_0/0.35)] p-3 text-start">
            <summary className="cursor-pointer text-xs font-medium text-primary">
              {t("error.devDetails")}
            </summary>
            <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
              {err.name}: {err.message}
              {err.stack ? `\n\n${err.stack}` : ""}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}
