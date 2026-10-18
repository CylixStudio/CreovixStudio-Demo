from pathlib import Path
p = Path(r"E:/Store/Cylix/CylixStudio-Demo/scripts/kick-commands-receipt-fix.ts")
t = p.read_text(encoding="utf-8")
if "claimKickCommandOrPlan" in t:
    print("test already has claim helper")
else:
    t = t.replace(
        """import {
  createMemoryReceiptBoard,
  finalizeKickReceiptAfterCommand,
  markReplyPending,
  markReplyResult,
  runIdempotentKickCommand,
  withKickReceipt,
  type ReceiptSession,
} from "@/lib/kickCommandReceipt";""",
        """import {
  claimKickCommandOrPlan,
  createMemoryReceiptBoard,
  finalizeKickReceiptAfterCommand,
  markReplyPending,
  markReplyResult,
  runClaimedKickExecute,
  runIdempotentKickCommand,
  withKickReceipt,
  type ReceiptSession,
} from "@/lib/kickCommandReceipt";""",
    )
    append = r'''

// Claim-then-finish (webhook waitUntil path): claim returns before execute; finish after.
{
  const board = createMemoryReceiptBoard();
  const eventId = "evt-defer-claim";
  const session: ReceiptSession = { board, userId: "user-a", providerEventId: eventId };
  const claimed = await claimKickCommandOrPlan({
    board,
    userId: "user-a",
    providerEventId: eventId,
    broadcasterUserId: "64185437",
    now,
  });
  assert.equal(claimed.action, "execute");
  assert.equal(claimed.claimed, true);
  assert.equal((await board.read("user-a", eventId))?.state, "webhook_received");
  let ran = false;
  await runClaimedKickExecute({
    board,
    userId: "user-a",
    providerEventId: eventId,
    now: now + 1,
    execute: () =>
      withKickReceipt(session, async () => {
        ran = true;
        const sent = await sendKickChatMessage("user-a", "64185437", "commands list", null, {
          receiptSession: session,
          loadToken: async () => "channel-token",
          fetchImpl: mockFetch(200),
        });
        assert.equal(sent, true);
      }),
  });
  assert.equal(ran, true);
  const row = await board.read("user-a", eventId);
  assert.equal(row?.state, "reply_delivery_succeeded");
  assert.ok(row?.replyText);
}
'''
    # insert before final ok log
    needle = 'console.log("kick-commands-receipt-fix: ok");'
    if needle not in t:
        raise SystemExit("ok log missing")
    t = t.replace(needle, append + "\n" + needle)
    p.write_text(t, encoding="utf-8")
    print("appended defer-claim test")
