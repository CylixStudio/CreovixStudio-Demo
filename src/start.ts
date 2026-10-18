import { createStart, createCsrfMiddleware, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/lib/supabase/auth-attacher";
import { UnauthorizedError } from "@/lib/supabase/auth-middleware";

function isClientAbort(error: unknown): boolean {
  if (error == null || typeof error !== "object") return false;
  const err = error as { name?: string; message?: string; code?: string; cause?: unknown };
  const message = String(err.message ?? "");
  return (
    err.name === "AbortError" ||
    err.code === "ECONNRESET" ||
    /\baborted\b/i.test(message) ||
    /request aborted|socket hang up/i.test(message) ||
    isClientAbort(err.cause)
  );
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    // Clean 401 JSON for auth failures (never a 500 HTML page).
    if (error instanceof UnauthorizedError) {
      return error.toResponse();
    }
    if (error instanceof Response) {
      return error;
    }
    if (error != null && typeof error === "object" && "statusCode" in error) {
      const status = Number((error as { statusCode?: number }).statusCode);
      if (status === 401) {
        return new Response(JSON.stringify({ error: "unauthorized", message: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
        });
      }
      throw error;
    }
    // The browser closed the connection mid-request (navigation, refresh,
    // closed SSE stream). Nothing failed server-side, so don't report it.
    if (isClientAbort(error)) {
      return new Response(null, { status: 499 });
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

// Start installs this automatically when src/start.ts is absent; defining the
// file opts out, so re-add it explicitly to keep server functions protected
// from cross-site requests.
const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === "serverFn",
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, csrfMiddleware],
}));
