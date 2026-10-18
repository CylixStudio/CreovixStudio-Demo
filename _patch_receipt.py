from pathlib import Path

path = Path(r"E:/Store/Cylix/CylixStudio-Demo/src/lib/kickCommandReceipt.ts")
text = path.read_text(encoding="utf-8")
start = text.find("export type DeliveryOutcome")
end = text.find("export type ReceiptSession")
if start < 0 or end < 0:
    raise SystemExit(f"markers missing start={start} end={end}")

new_block = r'''export type DeliveryOutcome = "sent" | "rejected" | "ambiguous" | "skipped";

/**
 * Claim the durable lock or return the plan for an existing receipt.
 * Does not run command handlers — Kick webhooks must ACK quickly and finish
 * execute via waitUntil (Kick cancels ~3–4s; pre-claim work already burns most of that).
 */
export async function claimKickCommandOrPlan(input: {
  board: ReceiptBoard;
  userId: string;
  providerEventId: string;
  broadcasterUserId: string;
  now: number;
}): Promise<ReceiptPlan & { claimed: boolean }> {
  const claimed = await input.board.claim({
    userId: input.userId,
    providerEventId: input.providerEventId,
    broadcasterUserId: input.broadcasterUserId,
    now: input.now,
  });
  if (claimed) return { action: "execute", claimed: true };
  const current = await input.board.read(input.userId, input.providerEventId);
  if (!current) return { action: "busy", claimed: false };
  return { ...planKickReceipt(current, input.now), claimed: false };
}

/**
 * Run handlers after a successful claim. Marks command_execution_completed only
 * after execute returns. A throw leaves webhook_received (busy window, then
 * execution_unknown) so points/shop/giveaway stay at-most-once.
 */
export async function runClaimedKickExecute(input: {
  board: ReceiptBoard;
  userId: string;
  providerEventId: string;
  now: number;
  execute: () => Promise<void>;
}): Promise<"completed" | "busy"> {
  await input.execute();
  const after = await input.board.read(input.userId, input.providerEventId);
  if (after?.state === "webhook_received") {
    const finished = await input.board.compareAndSet(
      input.userId,
      input.providerEventId,
      "webhook_received",
      { state: "command_execution_completed", now: input.now },
    );
    if (!finished) return "busy";
  }
  return "completed";
}

export async function retryKickReplyDelivery(input: {
  board: ReceiptBoard;
  userId: string;
  providerEventId: string;
  now: number;
  replyText: string;
  deliverStored: (replyText: string) => Promise<DeliveryOutcome>;
}): Promise<{ delivered: boolean }> {
  const pending = await input.board.compareAndSet(
    input.userId,
    input.providerEventId,
    "reply_delivery_failed",
    { state: "reply_delivery_pending", now: input.now },
  );
  if (!pending) return { delivered: false };
  const outcome = await input.deliverStored(input.replyText);
  const next =
    outcome === "sent"
      ? "reply_delivery_succeeded"
      : outcome === "ambiguous"
        ? "reply_delivery_ambiguous"
        : "reply_delivery_failed";
  await input.board.compareAndSet(input.userId, input.providerEventId, "reply_delivery_pending", {
    state: next,
    now: input.now,
  });
  return { delivered: outcome === "sent" };
}

export async function runIdempotentKickCommand(input: {
  board: ReceiptBoard;
  userId: string;
  providerEventId: string;
  broadcasterUserId: string;
  now: number;
  execute: () => Promise<void>;
  deliverStored: (replyText: string) => Promise<DeliveryOutcome>;
}): Promise<ReceiptPlan & { ran: boolean; delivered: boolean }> {
  const plan = await claimKickCommandOrPlan(input);
  if (plan.action === "execute" && plan.claimed) {
    // The insert is the lock. Points, shop, giveaway, and mark writes are separate
    // PostgREST calls, so this is at-most-once rather than one database transaction.
    // Completion is recorded only after execute returns. A throw leaves
    // webhook_received: a retry inside the busy window does not execute, and a
    // later retry acks execution_unknown instead of repeating the write.
    const finished = await runClaimedKickExecute({
      board: input.board,
      userId: input.userId,
      providerEventId: input.providerEventId,
      now: input.now,
      execute: input.execute,
    });
    if (finished === "busy") return { action: "busy", ran: true, delivered: false };
    return { action: "execute", ran: true, delivered: false };
  }
  if (plan.action !== "retry_delivery") return { ...plan, ran: false, delivered: false };
  const { delivered } = await retryKickReplyDelivery({
    board: input.board,
    userId: input.userId,
    providerEventId: input.providerEventId,
    now: input.now,
    replyText: plan.replyText,
    deliverStored: input.deliverStored,
  });
  return { action: "retry_delivery", replyText: plan.replyText, ran: false, delivered };
}

'''

path.write_text(text[:start] + new_block + text[end:], encoding="utf-8")
print("patched kickCommandReceipt.ts", start, end)
