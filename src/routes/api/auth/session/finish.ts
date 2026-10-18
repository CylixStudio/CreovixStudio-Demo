import { createFileRoute } from "@tanstack/react-router";

/**
 * Consumes the one-shot HttpOnly oauth_session_handoff cookie (HMAC-signed
 * Supabase user id), clears it immediately, mints a fresh access/refresh
 * session server-side, and returns tokens for the client to call setSession.
 *
 * Intentionally mint-only: post-login routing belongs on the client after
 * setSession succeeds — never in this try/catch (a routing DB blip must not
 * turn a successful mint into oauth_failed).
 */
export const Route = createFileRoute("/api/auth/session/finish")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          cookie,
          mintSupabaseSessionForUser,
          readCookie,
          verifySessionHandoff,
        } = await import("@/lib/oauth.server");

        const raw = readCookie(request, "oauth_session_handoff");
        // Consume once: clear handoff + any legacy magic-hash on every response.
        const headers = new Headers({
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        });
        headers.append(
          "Set-Cookie",
          cookie(request, "oauth_session_handoff", "", 0),
        );
        headers.append(
          "Set-Cookie",
          cookie(request, "oauth_session_handoff", "", 0, { hostOnly: true }),
        );
        headers.append(
          "Set-Cookie",
          cookie(request, "oauth_magic_hash", "", 0),
        );
        headers.append(
          "Set-Cookie",
          cookie(request, "oauth_magic_hash", "", 0, { hostOnly: true }),
        );

        const cookieHeader = request.headers.get("cookie");
        console.info("[oauth:session/finish] begin", {
          hasHandoffCookie: Boolean(raw),
          handoffLength: raw?.length ?? 0,
          cookieHeaderPresent: Boolean(cookieHeader),
          cookieNames: cookieHeader
            ? cookieHeader
                .split(";")
                .map((part) => part.trim().split("=")[0])
                .filter(Boolean)
            : [],
          url: request.url,
        });

        if (!raw) {
          console.error("[oauth:session/finish] missing oauth_session_handoff cookie", {
            url: request.url,
            cookieHeaderPresent: Boolean(cookieHeader),
          });
          return new Response(JSON.stringify({ ok: false, error: "missing_handoff" }), {
            status: 400,
            headers,
          });
        }

        const userId = verifySessionHandoff(raw);
        if (!userId) {
          console.error("[oauth:session/finish] invalid or expired handoff");
          return new Response(JSON.stringify({ ok: false, error: "invalid_handoff" }), {
            status: 401,
            headers,
          });
        }

        try {
          const session = await mintSupabaseSessionForUser(userId);
          console.info("[oauth:session/finish] ok", { userId });
          return new Response(
            JSON.stringify({
              ok: true,
              access_token: session.access_token,
              refresh_token: session.refresh_token,
            }),
            { status: 200, headers },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          console.error("[oauth:session/finish] mint failed", { userId, message });
          return new Response(JSON.stringify({ ok: false, error: message }), {
            status: 401,
            headers,
          });
        }
      },
    },
  },
});
