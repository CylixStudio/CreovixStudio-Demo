import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { matchDefaultCommand, mergeRuntimeDefaultCommands } from "@/lib/defaultCommands";
import { sendOfficialKickBot } from "@/lib/kickChatDeliver";
import {
  createMemoryReceiptBoard,
  decideAppBotIdentity,
  markReplyPending,
  markReplyResult,
  runIdempotentKickCommand,
  withKickReceipt,
} from "@/lib/kickCommandReceipt";
import { chatTextNeedsHandlers } from "@/lib/kickWebhookParse";

const webhook = readFileSync(new URL("../src/routes/api/public/webhooks/kick.ts", import.meta.url), "utf8");
const channelAt = webhook.indexOf("findKickConnection");
const receiptAt = webhook.indexOf("createSupabaseReceiptBoard");
assert.ok(channelAt > 0 && receiptAt > channelAt);
assert.equal(webhook.includes("KICK_BOT_ACCESS_TOKEN"), false);
assert.equal(chatTextNeedsHandlers("hello from chat"), false);
assert.equal(webhook.slice(0, webhook.indexOf("createSupabaseReceiptBoard")).includes("from(\"kick_command_receipts\")"), false);

const channel = { userId: "channel-a", broadcasterUserId: "42" };
const text = "!lurk";
assert.equal(chatTextNeedsHandlers(text), true);
const matched = matchDefaultCommand(text, mergeRuntimeDefaultCommands([]), "KICK");
assert.equal(matched?.command.id, "lurk");

const identity = decideAppBotIdentity({
  senderUserId: "7",
  configuredBotUserId: null,
  learnedBotUserId: null,
  incomingChatMessageId: "chat-viewer",
  outboundChatMessageId: null,
});
assert.equal(identity.ignore, false);

const board = createMemoryReceiptBoard();
const sends: Array<{ type?: string; broadcaster_user_id?: number }> = [];
let effects = 0;

async function deliver(content: string) {
  return sendOfficialKickBot({
    userId: channel.userId,
    broadcasterUserId: channel.broadcasterUserId,
    content,
    loadToken: async () => "channel-token",
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body) as { type?: string; broadcaster_user_id?: number };
      sends.push(body);
      return { ok: true, status: 200, text: async () => JSON.stringify({ data: { message_id: "bot-msg-1" } }) };
    },
  });
}

const first = await runIdempotentKickCommand({
  board,
  userId: channel.userId,
  providerEventId: "evt-lurk",
  broadcasterUserId: channel.broadcasterUserId,
  now: 5_000,
  deliverStored: async (reply) => {
    const result = await deliver(reply);
    return result.outcome === "skipped" ? "rejected" : result.outcome;
  },
  execute: () =>
    withKickReceipt({ board, userId: channel.userId, providerEventId: "evt-lurk" }, async () => {
      effects += 1;
      const armed = await markReplyPending(board, channel.userId, "evt-lurk", "lurk noted", 5_000);
      assert.equal(armed, true);
      const sent = await deliver("lurk noted");
      await markReplyResult(
        board,
        channel.userId,
        "evt-lurk",
        sent.outcome === "skipped" ? "rejected" : sent.outcome,
        5_000,
        sent.kickMessageId,
        sent.ok ? null : sent.reason,
      );
    }),
});
assert.equal(first.ran, true);
assert.equal(effects, 1);
assert.equal(sends.length, 1);
assert.equal(sends[0]?.type, "bot");
assert.equal(sends[0]?.broadcaster_user_id, undefined);
assert.equal((await board.read(channel.userId, "evt-lurk"))?.state, "reply_delivery_succeeded");

const second = await runIdempotentKickCommand({
  board,
  userId: channel.userId,
  providerEventId: "evt-lurk",
  broadcasterUserId: channel.broadcasterUserId,
  now: 5_100,
  deliverStored: async (reply) => {
    const result = await deliver(reply);
    return result.outcome === "skipped" ? "rejected" : result.outcome;
  },
  execute: async () => {
    effects += 1;
  },
});
assert.equal(second.action, "ack");
assert.equal(second.ran, false);
assert.equal(effects, 1);
assert.equal(sends.length, 1);

console.log(JSON.stringify({ ok: true, effects, sends: sends.length, type: sends[0]?.type }));
