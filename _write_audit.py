from pathlib import Path
demo = Path(r"E:/Store/Cylix/CylixStudio-Demo")

(demo / "AUDIT_MASTER_REPORT.md").write_text("""# AUDIT_MASTER_REPORT (Demo)

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
""", encoding="utf-8")

(demo / "PERFORMANCE_BASELINE.md").write_text("""# PERFORMANCE_BASELINE (Demo)

Date: 2026-10-16

## Measured
- `kick-bot-reply-tests` synthetic: p50≈91ms, p95≈101ms, max≈103ms (fixture CPU-ish, not Lighthouse)
- coldParseMs≈0.3–0.4
- Production canceled webhook: wall≈3794ms, cpu≈27ms (I/O bound before Kick cancel)
- Pre-claim work on that event ≈2.4s (incoming → claim 201)

## Not measured
- Lighthouse / browser Core Web Vitals (no browser run this session)
- Full route SSR timings for marketing pages

## Notes after fix
- Target: ACK Kick <~500ms after claim; send under waitUntil
""", encoding="utf-8")

(demo / "PRODUCTION_RELEASE_PLAN.md").write_text("""# PRODUCTION_RELEASE_PLAN

## Wave A (this run) — bot reply cancel/defer
1. Evidence: canceled webhook + webhook_received receipts
2. Fix Demo → test → merge Main (no DEMO_BUILD)
3. Deploy Worker `cylixstudio` only (existing wrangler)
4. User types `!commands` then `!points` once each — agent does not send
5. Rollback: previous live before defer deploy (currently `ced4bc52` until defer ships; prior known good attempt `9f501420` / older `7eebe6a4`)

## Out of scope for this deploy
- Payments, auth, DNS, secrets, migrations, Demo mocks

## Waves B–D
- Demo-only investigation; no production deploy until separately approved
""", encoding="utf-8")

(demo / "REGRESSION_MATRIX.md").write_text("""# REGRESSION_MATRIX

| Case | Expected | Covered by |
| --- | --- | --- |
| !commands send ok | reply_delivery_succeeded + kick_message_id | kick-commands-receipt-fix |
| Empty reply | no send / silent or ignored | receipt-fix emptyReply |
| Concurrent claim | single execute | receipt-fix concurrent + unit tests |
| Ambiguous timeout | no auto-resend | unit + fix script |
| Crash mid-execute | stays webhook_received; no second execute in busy | kick-command-receipt-tests |
| Claim then deferred finish | claim webhook_received → later succeeded | evt-defer-claim |
| type bot only | no type user / no KICK_BOT_ACCESS_TOKEN send | kickChatDeliver + comments |
| Kick cancel mid-sync (prod) | mitigated by command_deferred waitUntil | webhook code path |

Live user check after deploy: !commands once, !points once — not automated.
""", encoding="utf-8")

# Update recovery doc
rec = demo / "PRODUCTION_SCHEMA_RECOVERY.md"
rt = rec.read_text(encoding="utf-8")
if "defer/waitUntil" not in rt:
    rt += """

---

## P0 follow-up 2026-10-16 (cancel / webhook_received)

Live during user retest was Worker `ced4bc52` (after `9f501420`). New receipts stuck at **webhook_received** (not completed). Evidence: POST kick webhook **canceled** ~3.8s wall.

Fix prepared in Demo+Main: claim then `deferRequestWork` / waitUntil (`command_deferred`). Tests PASS. **Defer deploy version id: pending Cursor deploy approval** — do not treat current live as this fix until a new version id is recorded here.
"""
    rec.write_text(rt, encoding="utf-8")
print("wrote audit docs")
