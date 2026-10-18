# AUDIT_MASTER_REPORT (Demo)

Generated: 2026-10-16 — P0 production bot-reply failure + partial inventory.

## P0 production evidence (live Worker `ced4bc52`, not only `9f501420`)

- Latest receipts after user `!commands` / `!points`:
  - `01M528T3DSM2J1BMTE7SZV97EY` — `webhook_received`, reply_text null, no kick_message_id (~11:51Z)
  - `01M528RBPC716RPN4B5YBEZAJK`, `01M528RBYSHJBJ9TXDNC7N9CT3` — same stuck state (~11:50Z)
- Older receipts (pre-defer era): `command_execution_completed` + null reply (ALS/session bug; already patched earlier).
- Cloudflare: POST `/api/public/webhooks/kick` **outcome=canceled**, wall≈3794ms, cpu≈27ms, version `ced4bc52`.
- Timeline for `01M528T3…`: incoming 11:50:57 → claim(201) ~11:50:59 → Kick fetch 400s → **canceled** 11:51:00. Never reached reply_delivery_*.
- Live bundle (content/v2): contains `await input.execute()` **before** `command_execution_completed` and `receiptSession`. Receipt-session fix was live; cancel still aborted mid-execute.

## Root cause

Kick cancels the webhook HTTP request ~3–4s. Handler did claim+execute+Kick POST **synchronously**. Cancel leaves durable receipt at `webhook_received` (at-most-once busy → later `execution_unknown`). Not an ALS regression on these rows.

## Fix (Demo → Main, bot-reply path only)

- `claimKickCommandOrPlan` + `runClaimedKickExecute` + `retryKickReplyDelivery`
- Webhook: claim sync → `deferRequestWork` (waitUntil) for handlers/send/finalize → HTTP 200 `command_deferred` immediately
- Kick chat AbortSignal timeout 4s → 2.5s
- Did **not** copy Demo `DEMO_BUILD` mock send into Main

## Tests

- Demo + Main: `kick-command-receipt-tests`, `kick-commands-receipt-fix` (incl. evt-defer-claim), `kick-bot-reply-tests`, `kick-webhook-tests` — PASS
- `npm run build:cloudflare` Main — PASS; dist contains `command_deferred`

## Deploy status

- Main working tree ready; restore branches `pre-cylixbot-reply-deploy`, `pre-cylixbot-defer-deploy` (local, unpushed)
- Production deploy of this defer fix: **pending** (Cursor smart-mode approval UI failed to show; do not treat live `ced4bc52` as this fix)

## Reviewed vs unreviewed

### Reviewed (opened / evidence-driven)
- `src/lib/kickCommandReceipt.ts`, `kickChat.server.ts`, `kickChatDeliver.ts`, `kickCommandReceipt.server.ts`
- `src/routes/api/public/webhooks/kick.ts`
- `src/lib/defaultCommands.server.ts`, `pointsCommand.server.ts` (partial)
- `src/lib/requestContext.server.ts`, `src/server.ts`
- `scripts/kick-command-receipt-tests.ts`, `kick-commands-receipt-fix.ts`, `kick-bot-reply-tests.ts`, `kick-webhook-tests.ts`
- Live Worker content markers + observability samples; production `kick_command_receipts` rows (read-only)

### Unreviewed (explicit)
- Most of `src/components/**`, `src/routes/_authenticated/**`, payments/OAuth, shop/giveaway servers beyond call sites
- Full `supabase/migrations/**` (except confirming receipts migration already applied — not re-applied)
- Wave B–D UI button pending-state audit not completed this run
