# Emergency receipts — production apply outcome

**الحكم: طُبّق ملف الإيصالات فقط على Production بنجاح. لم تُطبَّق الهجرات الأربع الأخرى. لم يُنشر Cloudflare. لم يُختبر رد البوت حياً.**

الملف المطبق:

`supabase/migrations/20261015230000_kick_command_receipts.sql`

(نفس المحتوى في Main و Demo؛ تطابق SHA256.)

ينشئ فقط:

- `public.kick_command_receipts`
- `public.kick_app_bot_identity`

مع PK، فهرس فريد جزئي، state check، FK إلى `auth.users`، RLS، ومنح `service_role`.

---

## قبل الكتابة على Production

| الفحص | النتيجة |
| --- | --- |
| تطبيق نفس SQL على `cylix_prod_restore_verify` (Postgres 17 المحلي، منفذ 55433) | **PASS** — الجدولان + الأعمدة + PK + unique index + state check + FK + RLS + منح service_role |
| أعداد صفوف جداول العملاء قبل/بعد على الاستعادة المحلية | **PASS** — بدون تغيير (6 جداول فُحصت) |
| ملف النسخ `%USERPROFILE%\backups\cylix-pre-receipts.dump` | **PASS** — موجود، ~1.1 MB، بتاريخ اليوم، سبق استعادته محلياً |
| هوية المشروع | **PASS** — `SUPABASE_URL` → `ymvgxarznjqotnaaiida` (جلسة الوكيل ما زالت بلا `supabase login`؛ التأكيد عبر المرجع من الاعتمادات المحلية المتطابقة مع الهدف) |
| قراءة فقط على Production قبل التطبيق | **PASS** — الجدولان غائبان؛ لا يوجد `20261015230000` في التاريخ؛ 70 هجرة؛ آخرها `20261010151000_poll_prediction_widgets` |

ملاحظة محلية فقط: أُنشئ دور `service_role` على قاعدة الاستعادة المحلية لأن الـ dump لم يتضمنه؛ ملف SQL الإنتاج لم يُعدَّل.

---

## على Production (بعد اجتياز الفحوصات)

1. طُبّق SQL في معاملة واحدة — نجح.
2. التحقق: الجدولان، الأعمدة، الفهارس، RLS، المنح، FK — **PASS**.
3. `NOTIFY pgrst, 'reload schema'` — نُفّذ.
4. أُدرج صف التاريخ:
   - `version` = `20261015230000_kick_command_receipts`
   - `name` = `20261015230000_kick_command_receipts.sql`
   - عدد الهجرات بعدها: **71**

**لم يُحذف أي صف عملاء. لم تُعطَّل RLS. لم تُغيَّر أسرار. لم يُعدَّل مصدر Main.**

---

## سجلات Worker (قراءة فقط)

- Worker: `cylixstudio`. آخر نشر معروف قبل هذا الإجراء ما زال نشطاً (لا نشر جديد).
- في نافذة ما بعد التطبيق (~45 دقيقة): **لا أحداث webhook Kick جديدة** — غياب الأحداث ليس دليلاً على اختفاء 503.
- في نافذة أوسع (~6 ساعات، تشمل قبل التطبيق): وُجدت أحداث منها `POST 503` سابقاً، وأحداث لاحقة `POST 200` / `not_a_command` **بدون** `migration_required`.
- بحث `migration_required` في تلك النافذة: 0 تطابقات نصية في العيّنة المسترجعة.
- **رد البوت الحي لم يُختبر** (لم تُرسل رسالة Kick).

الخطوة التالية المنفصلة (تتطلب موافقة لاحقة): اختبار دردشة CylixBot حي — **لم يُطلب ولم يُبدأ هنا**.

---

## ما يبقى معلّقاً

- الهجرات الأربع الأخرى — غير مطبقة.
- اختبار أمر Kick حقيقي يثبت مسار الإيصال بعد إزالة `migration_required`.

---

## تحقق قراءة فقط بعد التطبيق (بدون إرسال Kick)

- **حزمة Worker الحية:** ما زالت `type: "bot"` فقط؛ لا يوجد `KICK_BOT_ACCESS_TOKEN` في الربط؛ النص الحي يؤكد عدم قراءة ذلك المتغير وعدم الرجوع إلى `type: "user"`. آخر نشر قبل هجرة SQL (لا نشر جديد).
- **سجلات webhook بعد ~10:53 UTC:** 0 أحداث `kick-webhook` / `migration_required` / `503` في العيّنة (السجلات مُعيَّنة بـ head_sampling_rate≈10%). **اختفاء 503 غير مثبت** لعدم وصول webhook بعد الهجرة.
- قبل الهجرة (اليوم): نشاط `kick-webhook` كثير؛ عيّنات `not_a_command`؛ لا `replied` / `send_failed` / `migration_required` في البحث النصي المُعاين.
- **Kick CreovixStudio (64185437):** `chat:write` مسجّل ضمن النطاقات (8 نطاقات، ليست فارغة). `token_expires_at` منتهٍ (~09:07 UTC اليوم) — لم يُحدَّث التوكن. لم يُستدعَ GET للاشتراكات لتجنب refresh يكتب التوكنات.
- `kick_command_receipts` و `kick_app_bot_identity`: صفوف = 0. تفعيل قدرة البوت **غير مُثبت** بدون POST دردشة.
- اختبار مقترح: في قناة **CreovixStudio** أرسل مرة واحدة `!commands` — **نُفِّذ مرة واحدة بعد الموافقة** (انظر أدناه).

---

## اختبار حي واحد: `!commands` في CreovixStudio

**قبل الإرسال**
- تجديد توكن Kick الرسمي: نجح (HTTP 200)، `chat:write` ما زال ضمن النطاقات.
- GET `events/subscriptions`: `chat.message.sent` موجود ضمن 7 اشتراكات (التطبيق `01M45FV2CDHR5YGD4DEMSYX87N`).
- Worker الحي: ما زال `type: "bot"` للردود؛ لا `KICK_BOT_ACCESS_TOKEN`؛ لا fallback إلى `type: "user"` للرد.

**الإرسال (مرة واحدة فقط)**
- كمالك القناة عبر Kick Chat API: `type: "user"`, `content: "!commands"`, `broadcaster_user_id: 64185437`.
- النتيجة: HTTP **200**، وُجد `message_id` (مقبول من Kick كرسالة مالك). لا إعادة محاولة.

**بعد الإرسال**
- وصلت مطالبات إيصال: **صفّان** في `kick_command_receipts` بحالتي أحداث مختلفتين، كلاهما متوقف عند `command_execution_completed` (~11:12 UTC)، بدون `reply_text` / `kick_message_id` / `failure_reason`.
- `kick_app_bot_identity`: ما زال **0** (لم يُتعلَّم معرّف بوت).
- سجلات Cloudflare لتلك النافذة: عيّنة فارغة (head sampling ≈10%) — لا دليل عيّني على `migration_required` / `send_failed` / `replied` / `503` / `exceededResources`.
- **قبول رد البوت من Kick: غير مثبت.** **ظهور الرد في الدردشة: غير مثبت.** لا `migration_required` في الأدلة المتاحة.
- ازدواجية: حدثان مميزان بعد رسالة مالك واحدة — احتمال تسليم مزدوج أو سطرين؛ لم يُرسل أمر ثانٍ من جهتنا.

**الخلاصة:** رسالة المالك وصلت لـ Kick؛ مسار الإيصال اشتغل جزئياً (claim → `command_execution_completed`) لكن مسار رد البوت لم يكتمل إلى `reply_delivery_*`. الخطوة التالية للتشخيص (موافقة منفصلة): التحقق من تفعيل بوت المطوّر في لوحة Kick إن لزم، أو مراجعة سجلات غير مُعيَّنة / سبب توقّف التنفيذ قبل `markReplyPending`.

---

## تشخيص توقف الإيصال عند command_execution_completed (إصلاح Demo)

**السبب الجذري (Worker الحي = Main):**
1. `runIdempotentKickCommand` يضع `command_execution_completed` **قبل** `execute` (حزمة Worker الحية).
2. تحديث `reply_text` يعتمد على `activeKickReceipt()` (ALS). إذا فُقدت الجلسة، `sendKickChatMessage` قد يرسل أو يفشل **بدون** `markReplyPending` → يبقى الإيصال عند `command_execution_completed` و`reply_text` فارغ.
3. الصمت المقصود (cooldown/reserved/…) كان يترك نفس الحالة بدون `failure_reason` واضح.

**إيصالات الاختبار الحي (قراءة فقط):**
- `01M526JVASQK154RJ3B3A1DRJM` و `01M526JV2B2QN91QAQTDXYJNWJ` — broadcaster `64185437`، state `command_execution_completed`، `reply_text`/`kick_message_id`/`failure_reason` كلها null. حدثان مميزان من Kick (ليست id مولّدة سيئة).

**إصلاح Demo (دُمج انتقائياً إلى Main ونُشر — انظر قسم نشر Cloudflare أدناه):**
- تمرير `receiptSession` صراحةً إلى مسار الإرسال + مراحل سجل آمنة.
- `finalizeKickReceiptAfterCommand` يغلق الحالات الصامتة/غير المتتبَّعة.
- اختبارات `scripts/kick-commands-receipt-fix.ts` نجحت؛ `npm run build:cloudflare` نجح.

**تم:** دُمج انتقائياً ونُشر Worker 9f501420-79bf-410f-9cbe-9a85a2069415. الاختبار الحي بانتظار المستخدم.

---

## نشر Cloudflare (2026-10-16)

| البند | القيمة |
| --- | --- |
| Worker | `cylixstudio` |
| الإصدار السابق (حي قبل النشر) | `7eebe6a4-3a68-40b5-83ca-19faf6e6211e` |
| الإصدار الجديد (حي الآن) | `9f501420-79bf-410f-9cbe-9a85a2069415` |
| فرع استعادة محلي غير مدفوع على Main | `pre-cylixbot-reply-deploy` عند `ccbffa24` |
| اختبارات | receipt / receipt-fix / bot-reply / webhook — PASS |
| build:cloudflare | PASS؛ الحزمة تحتوي receiptSession + execute قبل complete |
| المواقع | cylixstudio.com / www /login / webhook — HTTP 200 |
| اختبار حي !commands | بانتظار المستخدم — لم يُرسل الوكيل أي رسالة Kick |

**الحالة:** الإصلاح منشور على Production. الاختبار الحي معلّق حتى يكتب المستخدم !commands مرة واحدة في شات CreovixStudio.

---

## P0 follow-up 2026-10-16 (cancel / webhook_received)

Live during user retest was Worker `ced4bc52` (after `9f501420`). New receipts stuck at **webhook_received** (not completed). Evidence: POST kick webhook **canceled** ~3.8s wall.

Fix prepared in Demo+Main: claim then `deferRequestWork` / waitUntil (`command_deferred`). Tests PASS. نُشر: ``68f8bdcd-a651-4a2c-97f7-80e70b86c9ef`` (حي). الاختبار الحي بانتظار المستخدم.

---

## نشر defer/waitUntil (2026-10-16)

| البند | القيمة |
| --- | --- |
| Worker | `cylixstudio` |
| الإصدار السابق | `ced4bc52-656d-4b98-ab82-dfdb628273f7` |
| الإصدار الجديد (حي 100%) | `68f8bdcd-a651-4a2c-97f7-80e70b86c9ef` |
| الحزمة الحية | تحتوي `command_deferred` / `deferRequestWork` / `claimKickCommandOrPlan` |
| المواقع | cylixstudio.com / www /login — HTTP 200 |
| اختبار حي | بانتظار المستخدم: `!commands` ثم `!points` |
