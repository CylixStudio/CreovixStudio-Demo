import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { isDemoBuild } from "@/lib/demoMode";
import { markGatewayCompleted } from "@/lib/plans";
import { PlatformAsset } from "@/components/icons/platformAssets";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { supabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { navigateAfterLogin } from "@/lib/postLogin";
import { enableTestMode, isTestMode } from "@/lib/testMode";
import { useLanguage, type TranslationKey } from "@/lib/i18n";

type LoginSearch = { error?: string | undefined; detail?: string | undefined };

const ERRORS: Record<string, TranslationKey> = {
  twitch_not_configured: "login.error.twitch_not_configured",
  kick_not_configured: "login.error.kick_not_configured",
  state_mismatch: "login.error.state_mismatch",
  missing_code: "login.error.missing_code",
  pkce_verifier_missing: "login.error.pkce_verifier_missing",
  oauth_failed: "login.error.oauth_failed",
  access_denied: "login.error.access_denied",
  supabase_admin_key: "login.error.supabase_admin_key",
};

export const Route = createFileRoute("/login")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    error: typeof search["error"] === "string" ? search["error"] : undefined,
    detail: typeof search["detail"] === "string" ? search["detail"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "CylixStudio — Login" },
      {
        name: "description",
        content: "Sign in with Twitch or Kick to run your subathon timer, rules and overlays.",
      },
      { property: "og:title", content: "CylixStudio — Login" },
      {
        property: "og:description",
        content: "Connect Twitch or Kick to control your subathon timer.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { error, detail } = useSearch({ from: "/login" });
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const goNext = async () => {
      if (!active) return;
      try {
        await navigateAfterLogin(navigate);
      } catch (err) {
        console.warn("[login] post-login routing failed", err);
      }
    };

    if (isDemoBuild()) {
      markGatewayCompleted();
      void navigate({ to: "/dashboard", replace: true });
      return () => {
        active = false;
      };
    }
    if (isTestMode()) {
      void goNext();
      return () => {
        active = false;
      };
    }
    if (!isSupabaseConfigured()) {
      return () => {
        active = false;
      };
    }
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goNext();
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  const signIn = (provider: "twitch" | "kick" | "tiktok") => {
    if (provider === "tiktok") return;
    setPending(provider);
    window.location.href = `/api/auth/${provider}/start`;
  };

  const continueAsGuest = async () => {
    setPending("test");
    enableTestMode();
    try {
      await navigateAfterLogin(navigate);
    } catch (err) {
      console.warn("[login] test-mode routing failed", err);
      void navigate({ to: "/welcome", replace: true });
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-charcoal px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--gradient-glow)" }}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md rounded-2xl border border-black/10 bg-[#0a0a0a] p-8 shadow-xl">
        <div className="flex justify-center px-2">
          <BrandLogo
            variant="full"
            size="lg"
            className="max-w-[13.5rem] sm:max-w-[15.5rem]"
            imgClassName="h-11 sm:h-12"
          />
        </div>
        <h1 className="mt-6 text-center text-xl font-bold tracking-tight text-zinc-50 sm:text-2xl whitespace-nowrap">
          {t("login.title")}
        </h1>

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive-foreground"
          >
            {t(ERRORS[error] ?? "login.error.generic")}
            {import.meta.env.DEV && detail ? (
              <span className="mt-2 block break-words font-mono text-xs opacity-80" dir="ltr">
                {detail}
              </span>
            ) : null}
          </div>
        ) : null}

        {!isSupabaseConfigured() ? (
          <div
            role="status"
            className="mt-6 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          >
            Supabase is not configured for this build. In Vercel/Cloudflare set{" "}
            <code className="text-foreground">VITE_SUPABASE_URL</code> and{" "}
            <code className="text-foreground">VITE_SUPABASE_PUBLISHABLE_KEY</code>{" "}
            (or <code className="text-foreground">SUPABASE_URL</code> +{" "}
            <code className="text-foreground">SUPABASE_PUBLISHABLE_KEY</code>) for{" "}
            <span className="text-foreground">Production and Build</span>, then redeploy.
          </div>
        ) : null}

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => signIn("twitch")}
            disabled={pending !== null || !isSupabaseConfigured()}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-twitch px-5 py-3.5 text-base font-semibold text-twitch-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <PlatformAsset key="login-twitch" name="twitch" size={20} variant="White" className="h-5 w-5" />
            {pending === "twitch" ? t("login.redirecting") : t("login.continueTwitch")}
          </button>

          <button
            type="button"
            onClick={() => signIn("kick")}
            disabled={pending !== null || !isSupabaseConfigured()}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-kick px-5 py-3.5 text-base font-semibold text-kick-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <PlatformAsset key="login-kick" name="kick" size={20} variant="Black" className="h-5 w-5" />
            {pending === "kick" ? t("login.redirecting") : t("login.continueKick")}
          </button>

          <div className="relative overflow-hidden rounded-xl">
            <button
              type="button"
              disabled
              className="pointer-events-none flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-black px-5 py-3.5 text-base font-semibold text-white opacity-60 blur-[2px] saturate-50"
            >
              <PlatformAsset key="login-tiktok" name="tiktok" size={20} variant="White" className="h-5 w-5" />
              {t("login.continueTikTok")}
            </button>
            <div className="absolute inset-0 grid place-items-center bg-black/45 backdrop-blur-[1px]">
              <span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-zinc-950/85 px-3 py-1.5 text-[0.72rem] font-semibold text-foreground">
                <Lock className="size-3.5 text-primary" aria-hidden />
                {t("home.comingSoon")}
              </span>
            </div>
          </div>

          <p className="pt-1 text-center">
            <button
              type="button"
              onClick={continueAsGuest}
              disabled={pending !== null}
              className="cursor-pointer border-0 bg-transparent p-0 text-sm font-normal text-zinc-400 transition-colors hover:text-zinc-200 hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              {pending === "test" ? t("login.testOpening") : t("login.testMode")}
            </button>
          </p>
        </div>

        <p className="mt-8 text-center text-[0.65rem] leading-relaxed text-zinc-500">
          {t("login.legalConsent")}{" "}
          <Link to="/privacy" className="underline-offset-2 hover:text-zinc-400 hover:underline">
            {t("login.privacy")}
          </Link>{" "}
          {t("login.and")}{" "}
          <Link to="/terms" className="underline-offset-2 hover:text-zinc-400 hover:underline">
            {t("login.terms")}
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
