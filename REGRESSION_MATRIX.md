# REGRESSION_MATRIX

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
