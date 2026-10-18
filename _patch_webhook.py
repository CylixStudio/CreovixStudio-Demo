from pathlib import Path

path = Path(r"E:/Store/Cylix/CylixStudio-Demo/src/routes/api/public/webhooks/kick.ts")
text = path.read_text(encoding="utf-8")

# Ensure deferRequestWork import usage — add dynamic import in block
old_import = '''              const {
                decideAppBotIdentity,
                finalizeKickReceiptAfterCommand,
                logKickReceiptStage,
                runIdempotentKickCommand,
                withKickReceipt,
              } = await import("@/lib/kickCommandReceipt");'''

new_import = '''              const {
                claimKickCommandOrPlan,
                decideAppBotIdentity,
                finalizeKickReceiptAfterCommand,
                logKickReceiptStage,
                retryKickReplyDelivery,
                runClaimedKickExecute,
                withKickReceipt,
              } = await import("@/lib/kickCommandReceipt");
              const { deferRequestWork } = await import("@/lib/requestContext.server");'''

if old_import not in text:
    raise SystemExit("import block not found")
text = text.replace(old_import, new_import, 1)

# Replace the runIdempotentKickCommand try block through its catch.
# Anchor on logKickReceiptStage webhook_received then try {
start_marker = '              logKickReceiptStage(messageId, "webhook_received", { needsHandlers, giveaway: giveawayMatches });\n              try {\n                const plan = await runIdempotentKickCommand({'
end_marker = '              } catch (error) {\n                const missing = error instanceof Error && error.message === "kick_command_receipts_missing";'

si = text.find(start_marker)
ei = text.find(end_marker)
if si < 0 or ei < 0:
    raise SystemExit(f"block markers missing si={si} ei={ei}")

replacement = r'''              logKickReceiptStage(messageId, "webhook_received", { needsHandlers, giveaway: giveawayMatches });
              try {
                const deliverStored = async (replyText: string) => {
                  const { sendOfficialKickBot } = await import("@/lib/kickChatDeliver");
                  const { getKickAccessToken } = await import("@/lib/platformTokens.server");
                  logKickReceiptStage(messageId, "reply_delivery_started", { retry: true });
                  const result = await sendOfficialKickBot({
                    userId,
                    broadcasterUserId: broadcasterId,
                    content: replyText,
                    loadToken: (id, forceRefresh) =>
                      getKickAccessToken(id, { requireScopes: ["chat:write"], forceRefresh }),
                  });
                  logKickReceiptStage(messageId, "kick_api_response", {
                    ok: result.ok,
                    status: result.status,
                    reason: result.reason,
                    outcome: result.outcome,
                    retry: true,
                  });
                  return result.outcome === "skipped" ? "rejected" : result.outcome;
                };

                const runHandlers = () =>
                  withKickReceipt(receiptSession, async () => {
                    logKickReceiptStage(messageId, "command_execution_started", {});
                    if (needsHandlers) {
                      const { matchMarkCommand } = await import("@/lib/markPoints");
                      const markMatch = matchMarkCommand(text);
                      if (markMatch) {
                        markHandled = true;
                        trace.mark("command_matched");
                        const { handleMarkCommand } = await import("@/lib/markPoints.server");
                        try {
                          commandResult = await handleMarkCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            platform: "KICK",
                            text,
                            sender: { username, platformId: senderId, identityBadges },
                          });
                        } catch (error) {
                          console.error("[kick-webhook] mark command failed", error);
                          commandResult = { status: "error", reason: "command_threw" };
                        }
                        trace.mark("command_executed");
                      }
                    }
                    if (text && needsHandlers && !markHandled) {
                      trace.mark("command_matched");
                      try {
                        const { requestPublicOrigin } = await import("@/lib/commandsUrl");
                        const origin = requestPublicOrigin(request);
                        const { isPointsCommandAttempt } = await import("@/lib/pointsCommand");
                        if (isPointsCommandAttempt(text)) {
                          const { handlePointsCommand } = await import("@/lib/pointsCommand.server");
                          commandResult = await handlePointsCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            text,
                            sender: username,
                            senderPlatformId: senderUserId,
                            identityBadges,
                            receiptSession,
                          });
                        } else if (/^!?(?:shop|store|متجر)$/i.test(text.trim())) {
                          const { handleShopDirectoryCommand } = await import("@/lib/shopDirectory.server");
                          commandResult = await handleShopDirectoryCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            text,
                            senderPlatformId: senderUserId,
                            identityBadges,
                          });
                        } else if (/^!buy(?:\s|$)/i.test(text.trim())) {
                          const { handleShopBuyCommand } = await import("@/lib/shopBuy.server");
                          commandResult = await handleShopBuyCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            platform: "KICK",
                            text,
                            sender: { username },
                            isTest: false,
                          });
                        } else if (/^!?(?:wheel|spin|عجلة)$/i.test(text.trim())) {
                          const { handleWheelChatCommand } = await import("@/lib/wheelCommand.server");
                          commandResult = await handleWheelChatCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            platform: "KICK",
                            text,
                            sender: { username },
                            isTest: false,
                          });
                        } else {
                          const { handleDefaultChatCommand } = await import("@/lib/defaultCommands.server");
                          logKickReceiptStage(messageId, "command_matched", { kind: "default_or_custom" });
                          const defaultResult = await handleDefaultChatCommand({
                            userId,
                            broadcasterUserId: broadcasterId,
                            platform: "KICK",
                            text,
                            sender: { username, identityBadges, senderPlatformId: senderUserId },
                            origin,
                            replyToMessageId: viewerChatMessageId(body),
                            receiptSession,
                          });
                          commandResult = defaultResult;
                          if (defaultResult.status === "ignored" && defaultResult.reason === "no_match") {
                            const { handleCustomChatCommand } = await import("@/lib/customCommands.server");
                            commandResult = await handleCustomChatCommand({
                              userId,
                              broadcasterUserId: broadcasterId,
                              platform: "KICK",
                              text,
                              sender: { username, identityBadges },
                              receiptSession,
                            });
                          }
                        }
                      } catch (error) {
                        console.error("[kick-webhook] chat command failed", error);
                        commandResult = { status: "error", reason: "command_threw" };
                      }
                      trace.mark("command_executed");
                    }

                    if (giveawayMatches) {
                      const { captureGiveawayEntry, confirmGiveawayPresence } = await import("@/lib/giveaway.server");
                      const isTest =
                        (body as { isTest?: unknown }).isTest === true ||
                        (body as { is_test?: unknown }).is_test === true;
                      await confirmGiveawayPresence(supabaseAdmin, userId, { username, text, isTest });
                      await captureGiveawayEntry(supabaseAdmin, userId, {
                        platform: "KICK",
                        username,
                        text,
                        isSubscriber: identityBadges.some((badge) => /sub|founder|og|vip/i.test(badge)),
                      });
                    }
                  });

                const plan = await claimKickCommandOrPlan({
                  board,
                  userId,
                  providerEventId: messageId,
                  broadcasterUserId: broadcasterId,
                  now: Date.now(),
                });

                if (plan.action === "busy") {
                  logOutcome({ messageId, outcome: "failed", reason: "receipt_busy", eventType: type });
                  return jsonResponse({ status: "failed", reason: "receipt_busy" }, 503);
                }

                if (plan.action === "ack") {
                  commandResult = { status: "ignored", reason: plan.reason, command: "duplicate" };
                } else if (plan.action === "retry_delivery") {
                  // ACK Kick immediately; finish resend under waitUntil so Kick cannot cancel mid-send.
                  deferRequestWork(
                    request,
                    (async () => {
                      const { delivered } = await retryKickReplyDelivery({
                        board,
                        userId,
                        providerEventId: messageId,
                        now: Date.now(),
                        replyText: plan.replyText,
                        deliverStored,
                      });
                      logKickReceiptStage(messageId, "reply_delivery_finalized", {
                        outcome: delivered ? "sent" : "failed",
                        retry: true,
                        deferred: true,
                      });
                    })(),
                  );
                  rememberKickEvent(messageId);
                  logOutcome({ messageId, outcome: "processed", reason: "retry_delivery_deferred", eventType: type });
                  return jsonResponse({ status: "accepted", reason: "retry_delivery_deferred" });
                } else if (plan.action === "execute" && plan.claimed) {
                  // Production evidence 2026-10-16: Kick canceled the webhook at ~3.8s wall
                  // after claim, leaving receipts at webhook_received with null reply_text.
                  // Claim sync (at-most-once), ACK 200, finish handlers+send via waitUntil.
                  deferRequestWork(
                    request,
                    (async () => {
                      try {
                        await runClaimedKickExecute({
                          board,
                          userId,
                          providerEventId: messageId,
                          now: Date.now(),
                          execute: runHandlers,
                        });
                        if (needsHandlers) {
                          logKickReceiptStage(messageId, "command_execution_completed", {
                            status: commandResult.status,
                            reason: commandResult.reason ?? null,
                            deferred: true,
                          });
                          await finalizeKickReceiptAfterCommand({
                            board,
                            userId,
                            providerEventId: messageId,
                            now: Date.now(),
                            commandStatus: commandResult.status,
                            commandReason: commandResult.reason ?? null,
                          });
                        }
                      } catch (error) {
                        const missing = error instanceof Error && error.message === "kick_command_receipts_missing";
                        console.error(
                          "[kick-webhook] deferred command failed",
                          missing ? "migration_required" : "command_deferred_failed",
                        );
                      }
                    })(),
                  );
                  rememberKickEvent(messageId);
                  logOutcome({ messageId, outcome: "processed", reason: "command_deferred", eventType: type });
                  return jsonResponse({ status: "accepted", reason: "command_deferred" });
                }
'''

text = text[:si] + replacement + text[ei:]
path.write_text(text, encoding="utf-8")
print("patched kick webhook")
