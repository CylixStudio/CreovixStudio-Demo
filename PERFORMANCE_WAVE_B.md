# موجة الأداء B — Demo

التاريخ: 2026-10-16. لم يُنشر شيء. لم تُمس قاعدة Supabase الإنتاجية. لم تُطبَّق تهجيرات. رقعة Main جاهزة في شجرة العمل ولم تُلتزَم.

## طريقة القياس

متصفح Chrome بلا واجهة، نافذة 1440×900، بروتوكول DevTools، على `http://127.0.0.1:3001` فقط. كل مسار قيس بارداً ثم دافئاً في هدف جديد. زمن المحتوى هو `performance.now()` عند ظهور العلامة (بطاقات `!discord`، أو مفاتيح الأوامر، أو نص لوحة التحكم). زمن الدوال من بداية الطلب حتى انتهاء التحميل. لا توجد أرقام مخترعة؛ ما لم يُقرأ كُتب Not Measured.

إنتاج للقراءة فقط، طلب واحد لكل عنوان عبر curl، وليس جلسة متصفح:

| الصفحة | HTTP | TTFB | الزمن الكلي |
| --- | --- | --- | --- |
| `https://www.cylixstudio.com/` | 200 | 0.760 ث | 0.920 ث |
| `https://www.cylixstudio.com/commands/creovixstudio` | 200 | 0.383 ث | 0.548 ث |

العامل الحي، `wrangler deployments status`، بلا نشر: الإصدار `34f46ead-a456-4351-827c-ba1d02b2e6c1` بنسبة 100%، أُنشئ `2026-10-16T17:28:12.064Z`.

## جدول الإصلاح

| Feature | Before | After | Improvement |
| --- | --- | --- | --- |
| Page Navigation | ظهور بطاقات الأوامر العامة الدافئ 419.3 ms. مستند TTFB 19.5 ms وload 72.1 ms، ثم POST للعميل 9 ms | ظهور البطاقات 52.5 ms داخل HTML الأول. مستند TTFB 38.3 ms وload 139.4 ms. لا طلب دالة من العميل | البطاقات 419.3 → 52.5 ms. ارتفع TTFB لأن التحميل صار داخل المستند |
| Button Interaction | مفتاح الأمر الافتراضي بقي `aria-checked=true` طوال انتظار 8000 ms. POST ثم GET للقائمة | 60.2 ms حتى `aria-checked=false`. POST واحد بلا إعادة جلب | من عدم تغيّر خلال 8000 ms إلى 60.2 ms، وطلبان إلى طلب واحد |
| Save Settings | حفظ المحفّز 59.6 ms: POST للإعداد ثم GET للحالة | إعادة القياس 45.0 ms وبالطلبين نفسيهما | المسار لم يُعدَّل. الفرق عينة متكررة لا إصلاح |
| Server Functions | أوامر عامة: POST عميل واحد. التبديل: POST+GET. زيارة اللوحة الثانية: طلب ختم واحد | أوامر عامة: 0 من العميل. التبديل: POST فقط. الزيارة الثانية: 0 | أُزيلت جولة القائمة وجولة الختم المعادة وPOST العميل |
| Supabase Queries | Not Measured على الإنتاج. Demo لا يضرب Supabase الإنتاجي | Not Measured على الإنتاج | لا استعلام إنتاجي أُضيف أو حُذف |
| Worker CPU | Not Measured | Not Measured | Not Measured |

LCP وINP للإنتاج: Not Measured. لم تُفتح لوحة إنتاجية بحساب مسجّل. لم يُجرَ اختبار حمل.

## الصفحات الدافئة قبل الإصلاح

| المسار | TTFB | load | المحتوى | دوال ملحوظة |
| --- | --- | --- | --- | --- |
| `/` ثم لوحة التحكم | 17.3 ms | 49.6 ms | 560.7 ms | حالة Demo 8 ms، سحب 10 ms، ختم 71 ms |
| `/login` ثم اللوحة | 22.8 ms | 61.1 ms | 366.3 ms | حالة Demo وبدء السحب |
| `/dashboard` | 24.8 ms | 89.4 ms | 572.9 ms | حالة Demo 8 ms، سحب 8 ms، ختم بدأ |
| `/custom-commands` | 18.7 ms | 69.1 ms | 507.2 ms | ثلاث دوال قائمة، 9–11 ms لكل واحدة |
| `/widgets` | 17.3 ms | 74.2 ms | 475.0 ms | `GET /api/demo/state` 9 ms |
| `/settings` | 26.0 ms | 89.2 ms | 512.5 ms | لا دالة بيانات |
| `/commands/creovixstudio` | 19.5 ms | 72.1 ms | 419.3 ms | POST صفحة الأوامر 9 ms |
| نقرة من اللوحة إلى الأوامر | — | — | 126.3 ms | ثلاث دوال قائمة |
| بحث الأوامر العامة | — | — | 9.2 ms | بلا شبكة، النتيجة بطاقة واحدة |

مهام طويلة على اللوحة الدافئة: مهمتان، مجموعهما 232 ms، أطولها 181 ms.

## الإصلاحات الثلاثة

1. `src/routes/commands.$slug.tsx` — `PublicCommandsRoute` كان يجلب `loadPublicCommandsPage` بعد الرسم. صار الجلب في `loader` فيصل مع HTML. الشكل والـ CSS لم يتغيرا. عند 1440 px الشبكة 6 أعمدة، والبحث عن discord يبقي بطاقة واحدة. الصفحة المفتوحة: `http://127.0.0.1:3001/commands/creovixstudio`.

2. `src/routes/_authenticated/custom-commands.tsx` مع `src/lib/commandEnabled.ts` و`src/lib/demoDefaultCommandStore.ts` وفرع Demo في `src/lib/defaultCommands.functions.ts`. السبب: عميل Demo الوهمي كان يتجاهل الكتابة، ثم `invalidateQueries` يعيد القائمة بالقيمة القديمة فيبقى المفتاح بلا تغيير. الآن تُحفظ حالة التفعيل في ذاكرة عملية Demo، وتُحدَّث الذاكرة المؤقتة للواجهة بلا إعادة جلب، والنقرة الثانية تُمنع أثناء الطلب. بعد إعادة التحميل تبقى القيمة لأن القراءة من المخزن نفسه.

3. `src/components/brand/SaudiBusinessSeal.tsx`. زيارة اللوحة الثانية كانت تنتظر 566 ms مع استجابة ختم واحدة. بعد حفظ الرابط في الجلسة: 286 ms حتى ظهور الرابط، و0 طلبات ختم. الزيارة الأولى ما زالت تجلب الشبكة (عينة 887 ms قبل الإصلاح، وعينة 1538 ms بعد الإصلاح). لم يُحسَب متوسط.

لم يُضف مؤشر قاعدة بيانات. الانتظار المقاس كان جولات HTTP لا فحص جدول. لا ملف SQL، ولم يُطبَّق شيء.

## الاختبارات

- `node --experimental-strip-types --test scripts/demo-default-command-store.test.ts`: اختباران ناجحان.
- `node --import ./scripts/command-match-loader.mjs ./scripts/assert-command-access.mjs`: نجح.
- `npm run build:cloudflare` في Demo: خرج 0. نجاح البناء ليس نجاح أداء.

## Main

نقطة البداية `6c559b548b3ca41d8665320b04068807a157ef2f`. فرع الاسترجاع المحلي `restore/pre-performance-wave-b` على تلك النقطة. لم يُعمل reset.

التزام محلي واحد على `main`، بلا دفع: `c112dc3` — `fix: preserve the approved public commands page layout`. الملفات: `src/routes/commands.$slug.tsx` و`src/routes/commands.page.module.css` و`scripts/assert-public-commands-layout.mjs`. مسار البوت (`deferRequestWork` و`type: "bot"`) كان ملتزماً مسبقاً ولم يدخل هذا الالتزام. لقطات `tmp/commands-page` بقيت خارج الالتزام.

إصلاحات الأداء بقيت في Demo ولم تُدمج ولم تُنشر. شكل صفحة الأوامر المعتمد (6 أعمدة، 170px، توسيط عمودي) وملفات البوت لم تُمس في هذه الموجة.

رقعة لاحقة انتقائية، بلا تجاوز المصادقة أو Pro:

- `src/routes/commands.$slug.tsx`
- `src/lib/commandEnabled.ts`
- إعادة التصدير في `src/lib/defaultCommands.ts`
- `src/routes/_authenticated/custom-commands.tsx`
- `src/components/brand/SaudiBusinessSeal.tsx`
- `scripts/demo-default-command-store.test.ts`

خاص بـ Demo ولا يُنسخ كما هو إلى Main: `src/lib/demoDefaultCommandStore.ts` وفرع `DEMO_BUILD` في `src/lib/defaultCommands.functions.ts` وبيانات `fixture-hundred`.

## إعادة التحقق

Postgres المحلي على 55432 و55433 كان يعمل. هو نسخة استعادة محلية (`cylix_prod_restore_verify`) ولم يُكتب إليه. الإثبات على مخزن Demo في ذاكرة العملية، مفصول حسب المستخدم.

### 1. ثبات التبديل — PASS

ثلاث نقرات ناجحة، كل واحدة POST واحد بحالة 200:

| النقرة | واجهة حتى تغيّر `aria-checked` | تأكيد الخادم |
| --- | --- | --- |
| 1 | 20.0 ms | 36 ms |
| 2 | 15.6 ms | 42 ms |
| 3 | 352.9 ms | 41 ms |
| الوسيط | 20.0 ms | 41 ms |

الحالة الأخيرة `true` بقيت `true` بعد إعادة تحميل الصفحة. قبل هذه السلسلة كانت القيمة المحفوظة `false` وظهرت كذلك في تحميل جديد. النقرة المزدوجة المتزامنة أنتجت POST واحداً فقط. عند إرجاع 500 من الطلب: المفتاح بقي على القيمة السابقة، ظهر خطأ، ولم تظهر رسالة نجاح. اختبار الوحدة يعيد الصفوف السابقة عندما تكون النتيجة `ok: false`.

### 2. ذاكرة رابط التوثيق — PASS

الرابط العام فقط (`certificate-details` أو `/request/` على نطاق المركز). المفتاح `cylix.sbc-certificate-href:` متبوعاً بمعرّف المستخدم، وليس ذاكرة مشتركة. المستخدم الآخر لا يقرأ سجل الأول. بعد 15 دقيقة يُرفض السجل وتُعاد الجلبة. لا رموز ولا بريد في السجل. مسارات OAuth لم تُغيّر. زيارة اللوحة الأولى: طلب واحد خلال 807 ms. الزيارة الثانية: 0 طلبات، والرابط ظاهر خلال 461 ms.

### 3. HTML الأوامر العامة — PASS

ثلاث تحميلات جديدة لـ `/commands/creovixstudio`، الكاش معطّل:

| التحميل | TTFB | ظهور البطاقات |
| --- | --- | --- |
| 1 | 53.9 ms | 69.8 ms |
| 2 | 94.9 ms | 107.7 ms |
| 3 | 362.6 ms | 377.5 ms |
| الوسيط | 94.9 ms | 107.7 ms |

لا رسائل hydration. عينتان بعد استقرار التخطيط: 6 أعمدة و`170px`. HTML القناتين `creovixstudio` و`otherchannel` بلا `service_role` أو `access_token` أو `eyJ` أو بريد. اسم القناة لا يتسرب. المسار المعلّم `fixture-hundred` (110 أمراً، Demo فقط) لا يحتوي `!discord`، والصفحة العادية لا تحتوي `!fixture`. البحث عن fixture110 أظهر البطاقة، والصفحة 2 أظهرت `!fixture19`. معالج العامل: Not Measured.

## رقعة Main الجاهزة

لم تُلتزَم ولم تُنشر. الملفات:

- `src/routes/commands.$slug.tsx`
- `src/routes/_authenticated/custom-commands.tsx`
- `src/routes/_authenticated/dashboard.tsx`
- `src/components/brand/SaudiBusinessSeal.tsx`
- `src/lib/commandEnabled.ts`
- `src/lib/commandToggle.ts`
- `src/lib/sbcSealCache.ts`
- `scripts/wave-b-command-seal.test.ts`

`npm run build:cloudflare` خرج 0 في Demo وفي Main. `tsc --noEmit` ما زال يفشل بأخطاء سابقة خارج هذه الملفات؛ ملفات الرقعة بلا أخطاء tsc بعد توسيع نوع نتيجة التبديل. الاختبارات الجديدة نجحت، و`assert-command-access` نجح.

الفحوص الثلاثة ناجحة. الموجة B جاهزة لموافقة النشر، ولم يُنشر شيء. العامل الحي ما زال `34f46ead-a456-4351-827c-ba1d02b2e6c1`.
