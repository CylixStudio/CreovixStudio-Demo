import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase/client";
import { isGatewayCompleted } from "@/lib/plans";
import { navigateAfterLogin } from "@/lib/postLogin";

export const Route = createFileRoute("/auth/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "CylixStudio — Finishing Sign-in" },
      { name: "description", content: "Completing your Twitch or Kick sign-in." },
      { property: "og:title", content: "CylixStudio — Finishing Sign-in" },
      { property: "og:description", content: "Completing your streaming platform sign-in." },
    ],
  }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;

    const failToLogin = () => {
      if (!active) return;
      setFailed(true);
      void navigate({ to: "/login", search: { error: "oauth_failed" }, replace: true });
    };

    /** Session is already established — routing must never send the user back to login. */
    const goNextSafely = async () => {
      try {
        await navigateAfterLogin(navigate);
      } catch (err) {
        console.warn("[auth/callback] post-login routing failed; using gateway fallback", err);
        const fallback = isGatewayCompleted() ? "/dashboard" : "/welcome";
        if (active) void navigate({ to: fallback, replace: true });
      }
    };

    (async () => {
      // Prefer HttpOnly cookie handoff (no token_hash in the URL).
      // Fall back to legacy ?token_hash= / #token_hash= for in-flight redirects.
      let legacyHash: string | null = null;
      try {
        const params = new URLSearchParams(window.location.search);
        legacyHash = params.get("token_hash");
        if (!legacyHash && window.location.hash.startsWith("#")) {
          const hashParams = new URLSearchParams(window.location.hash.slice(1));
          legacyHash = hashParams.get("token_hash");
        }
      } catch {
        /* ignore */
      }

      if (legacyHash) {
        const { error } = await supabase.auth.verifyOtp({
          type: "magiclink",
          token_hash: legacyHash,
        });
        window.history.replaceState({}, "", "/auth/callback");
        if (!active) return;
        if (error) {
          console.error("[auth/callback] legacy verifyOtp failed", error.message);
          failToLogin();
          return;
        }
        await goNextSafely();
        return;
      }

      const response = await fetch("/api/auth/session/finish", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      const payload = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        access_token?: string;
        refresh_token?: string;
      } | null;
      if (!active) return;
      if (!response.ok || !payload?.ok || !payload.access_token || !payload.refresh_token) {
        console.error("[auth/callback] session/finish failed", {
          status: response.status,
          error: payload?.error ?? null,
        });
        failToLogin();
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: payload.access_token,
        refresh_token: payload.refresh_token,
      });
      if (!active) return;
      if (error) {
        console.error("[auth/callback] setSession failed", error.message);
        failToLogin();
        return;
      }

      // Confirm the client session is readable before routing (storage write).
      const { data: confirmed } = await supabase.auth.getSession();
      if (!active) return;
      if (!confirmed.session) {
        console.error("[auth/callback] session missing after setSession");
        failToLogin();
        return;
      }

      // Session is live. Destination routing is best-effort only.
      await goNextSafely();
    })().catch((err) => {
      console.error("[auth/callback] unexpected failure", err);
      failToLogin();
    });

    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-charcoal px-6">
      <p className="text-muted-foreground">
        {failed ? "Sign-in failed, redirecting…" : "Finishing sign-in…"}
      </p>
    </main>
  );
}
