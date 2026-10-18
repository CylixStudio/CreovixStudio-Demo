import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CheckoutPayloadSchema = z.object({
  email: z.string().email(),
  user_id: z.string().uuid().optional().nullable(),
  interval: z.enum(["monthly", "six_months", "yearly", "lifetime", "custom"]),
  duration_days: z.number().int().min(1).max(36500).optional(),
  amount_cents: z.number().int().nonnegative().optional().nullable(),
  currency: z.string().min(3).max(8).optional(),
  provider: z.string().min(2).max(64).default("checkout"),
  payment_id: z.string().min(4).max(191),
  phone: z.string().min(6).max(32).optional().nullable(),
  locale: z.enum(["ar", "en"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** direct = activate on account; gift = email activation code (default) */
  purchase_type: z.enum(["direct", "gift"]).optional().default("gift"),
  gift_recipient_email: z.string().email().optional().nullable(),
  gift_message: z.string().max(500).optional().nullable(),
  buyer_name: z.string().max(120).optional().nullable(),
});

/**
 * Payment provider webhook: successful Pro checkout.
 *
 * - purchase_type=direct → activate Pro on user_id immediately (confirmation email)
 * - purchase_type=gift → generate activation code + gift/activation email
 *
 * Path: POST /api/public/webhooks/pro-checkout
 * Auth: Authorization: Bearer <PRO_CHECKOUT_WEBHOOK_SECRET>
 */
export const Route = createFileRoute("/api/public/webhooks/pro-checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const started = Date.now();
        try {
          const { fulfillProPurchase } = await import("@/lib/proPurchase.server");
          const { publicSiteUrl } = await import("@/lib/siteUrl.server");
          const { safeEqual } = await import("@/lib/webhooks/verify.server");

          const expected = (
            process.env["PRO_CHECKOUT_WEBHOOK_SECRET"] ??
            process.env["CHECKOUT_WEBHOOK_SECRET"] ??
            ""
          ).trim();
          if (!expected || expected.length < 16) {
            console.error("[pro-checkout] webhook secret missing or too short");
            return Response.json({ error: "webhook_not_configured" }, { status: 503 });
          }

          const auth = request.headers.get("authorization") ?? "";
          const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
          const headerSecret =
            request.headers.get("x-pro-checkout-secret") ??
            request.headers.get("x-checkout-secret") ??
            "";
          const provided = (bearer || headerSecret).trim();
          if (!provided || !safeEqual(provided, expected)) {
            console.warn("[pro-checkout] unauthorized webhook attempt");
            return Response.json({ error: "unauthorized" }, { status: 401 });
          }

          let json: unknown;
          try {
            json = await request.json();
          } catch {
            return Response.json({ error: "invalid_json" }, { status: 400 });
          }

          const parsed = CheckoutPayloadSchema.safeParse(json);
          if (!parsed.success) {
            console.warn("[pro-checkout] invalid payload", parsed.error.flatten());
            return Response.json(
              { error: "invalid_payload", details: parsed.error.flatten() },
              { status: 400 },
            );
          }

          const body = parsed.data;

          if (body.purchase_type === "direct" && !body.user_id) {
            return Response.json(
              { error: "direct_requires_user", message: "user_id is required for direct activation" },
              { status: 400 },
            );
          }

          const { supabaseAdmin, assertSupabaseAdminConfigured } = await import(
            "@/lib/supabase/client.server"
          );

          try {
            await assertSupabaseAdminConfigured();
          } catch (adminError) {
            console.error("[pro-checkout] admin client rejected", adminError);
            return Response.json({ error: "database_not_configured" }, { status: 503 });
          }

          const result = await fulfillProPurchase(supabaseAdmin, {
            email: body.email,
            interval: body.interval,
            provider: body.provider,
            providerPaymentId: body.payment_id,
            siteUrl: publicSiteUrl(request),
            locale: body.locale ?? "ar",
            purchaseType: body.purchase_type,
            ...(body.user_id != null ? { userId: body.user_id } : {}),
            ...(body.duration_days != null ? { durationDays: body.duration_days } : {}),
            ...(body.amount_cents !== undefined ? { amountCents: body.amount_cents } : {}),
            ...(body.currency ? { currency: body.currency } : {}),
            ...(body.phone != null ? { phone: body.phone } : {}),
            ...(body.metadata ? { metadata: body.metadata } : {}),
            ...(body.gift_recipient_email != null
              ? { giftRecipientEmail: body.gift_recipient_email }
              : {}),
            ...(body.gift_message != null ? { giftMessage: body.gift_message } : {}),
            ...(body.buyer_name != null ? { buyerName: body.buyer_name } : {}),
          });

          if (!result.ok) {
            console.error("[pro-checkout] fulfill failed", {
              error: result.error,
              payment_id: body.payment_id,
              provider: body.provider,
              purchase_type: body.purchase_type,
              ms: Date.now() - started,
            });
            return Response.json({ error: result.error }, { status: 500 });
          }

          const exposeCode =
            process.env["NODE_ENV"] !== "production" && result.purchaseType === "gift";

          console.info("[pro-checkout] ok", {
            purchase_id: result.purchaseId,
            purchase_type: result.purchaseType,
            activation: result.activation,
            email_delivered: result.email.delivered,
            email_error: result.email.error ?? null,
            idempotent: result.idempotent,
            ms: Date.now() - started,
          });

          return Response.json({
            ok: true,
            purchase_id: result.purchaseId,
            purchase_type: result.purchaseType,
            duration_days: result.durationDays,
            email_delivered: result.email.delivered,
            email_error: result.email.error ?? null,
            sms_delivered: result.sms.delivered,
            idempotent: result.idempotent,
            activation: result.activation,
            ...(result.expiresAt ? { expires_at: result.expiresAt } : {}),
            ...(exposeCode && result.code ? { code: result.code } : {}),
          });
        } catch (err) {
          console.error("[pro-checkout] unhandled exception", {
            message: err instanceof Error ? err.message : String(err),
            ms: Date.now() - started,
          });
          return Response.json({ error: "internal_error" }, { status: 500 });
        }
      },
    },
  },
});
