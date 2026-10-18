import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const base = 'http://127.0.0.1:3001';
const out = path.resolve('artifacts/alerts-redesign');
const initial = await (await fetch(`${base}/api/demo/alert-studio`)).json();
fs.writeFileSync(path.resolve('.demo-data/alerts-before-browser.json'), JSON.stringify(initial));
const uploaded = new Set();
const report = { checks: [], errors: [] };
const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (error) => report.errors.push(error.message));
const pause = (ms = 200) => new Promise(resolve => setTimeout(resolve, ms));
const check = (name) => { report.checks.push(name); console.log('PASS', name); };
async function clickText(scope, text) {
  const buttons = await page.$$(`${scope} button`);
  for (const button of buttons) {
    if ((await button.evaluate(el => el.textContent.trim())) === text) { await button.scrollIntoView(); await button.click(); return; }
  }
  throw new Error(`Button not found: ${text}`);
}
async function fill(selector, value) {
  const el = await page.waitForSelector(selector);
  await el.scrollIntoView(); await el.click(); await el.evaluate(node => { node.focus(); node.select(); }); await el.type(value);
}
async function save() {
  const response = page.waitForResponse(r => r.url().endsWith('/api/demo/alert-studio') && r.request().method() === 'PUT');
  await clickText('#alert-settings', 'حفظ التغييرات');
  assert.equal((await response).status(), 200); await pause();
}
async function shot(name, selector) {
  if (selector) await page.$eval(selector, el => el.scrollIntoView({ block: 'start' }));
  else await page.evaluate(() => window.scrollTo(0, 0));
  await pause(300); await page.screenshot({ path: path.join(out, name) });
}
try {
  await page.goto(`${base}/alerts`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('#alert-settings textarea');
  const metrics = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth, panel: document.querySelector('.alert-settings-panel').getBoundingClientRect().width, fields: [...document.querySelectorAll('#alert-settings .alert-fields > .alert-row')].map(el => el.dataset.field) }));
  assert.equal(metrics.width, metrics.scroll); assert.ok(metrics.panel > 1200);
  assert.deepEqual(metrics.fields, ['التنبيه النشط','النمط','الموضع','مدة التنبيه','الرسوم المتحركة','الصورة','الصوت','مستوى الصوت','الصوت (TTS)','لون النص العلوي','لون النص السفلي','إخفاء رسالة المستخدم','ظل النص','الخط','موضع النص عموديًا','موضع النص أفقيًا','تحريك النص','حجم الخط','النص','مظهر النص']);
  check('Desktop width and exact field order');
  await shot('01-top.png');
  await fill('#alert-settings [data-field="النص"] textarea', '{username} أهلًا بك في البث · {message}');
  await page.select('#alert-settings [data-field="النمط"] select', 'compact');
  await clickText('#alert-settings [data-field="الموضع"]', 'النص متراكب مع الصورة');
  await page.$eval('#alert-settings [data-field="مستوى الصوت"] input', el => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(el, '52'); el.dispatchEvent(new Event('input', { bubbles: true })); });
  await save();
  await page.reload({ waitUntil: 'networkidle2' });
  assert.equal(await page.$eval('#alert-settings [data-field="النمط"] select', el => el.value), 'compact');
  assert.equal(await page.$eval('#alert-settings [data-field="النص"] textarea', el => el.value), '{username} أهلًا بك في البث · {message}');
  check('Settings persist across reload');

  await clickText('#alert-settings', 'إضافة تنويعة');
  await page.waitForSelector('[role="dialog"] [data-field="النص"] textarea');
  await fill('[role="dialog"] [aria-label="اسم التنويعة"]', 'ترحيب خاص');
  await page.select('#variation-condition', 'min-count');
  await fill('[aria-label="قيمة الشرط"]', '3');
  await fill('[role="dialog"] [data-field="النص"] textarea', 'مرحبًا {name} · هدية خاصة');
  const beforeAccept = page.waitForResponse(r => r.url().endsWith('/api/demo/alert-studio') && r.request().method() === 'PUT');
  await clickText('[role="dialog"]', 'قبول'); await beforeAccept;
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  let stored = await (await fetch(`${base}/api/demo/alert-studio`)).json();
  const variation = stored.alerts.KICK.follow.variations.find(v => v.name === 'ترحيب خاص');
  assert.ok(variation); assert.equal(variation.config.message, 'مرحبًا {name} · هدية خاصة');
  assert.notEqual(variation.config.message, stored.alerts.KICK.follow.message);
  check('Variation acceptance persists independent configuration');

  await page.click('[aria-label="تعديل ترحيب خاص"]');
  await page.waitForSelector('[role="dialog"] #variation-condition');
  await pause(350);
  const footerBefore = await page.$eval('.alert-modal-footer', el => el.getBoundingClientRect().top);
  await page.$eval('.alert-modal-body', el => { el.scrollTop = 0; }); await pause();
  await page.screenshot({ path: path.join(out, '04-variation-top.png') });
  await page.$eval('.alert-modal-body', el => { el.scrollTop = el.scrollHeight; }); await pause();
  const footerAfter = await page.$eval('.alert-modal-footer', el => el.getBoundingClientRect().top);
  assert.equal(footerBefore, footerAfter);
  await page.screenshot({ path: path.join(out, '05-variation-bottom.png') });
  check('Variation body scrolls with stationary acceptance footer');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });
  // Keep existing user media intact; upload into the temporary variation.
  await page.click('[aria-label="تعديل ترحيب خاص"]');
  await page.waitForSelector('[role="dialog"] input[aria-label="ملف الصورة"]');
  const uploadResponse = page.waitForResponse(r => r.url().endsWith('/alert-studio/media') && r.request().method() === 'POST');
  await (await page.$('[role="dialog"] input[aria-label="ملف الصورة"]')).uploadFile(path.resolve('src/assets/Logo/cylix-studio.png'));
  const uploadPayload = await (await uploadResponse).json(); assert.ok(uploadPayload.ok); uploaded.add(uploadPayload.asset.id);
  await page.waitForSelector('[role="dialog"] .alert-media-preview img');
  check('Image upload preview and independent variation media');
  await page.keyboard.press('Escape');
  await page.waitForSelector('[role="dialog"]', { hidden: true });

  await page.$eval('#alert-settings .alert-code-section input[type="checkbox"]', el => el.click());
  await fill('#alert-settings .alert-code-editor textarea', '<div class="alert">{username}</div>');
  await clickText('#alert-settings .alert-code-tabs', 'JavaScript');
  await fill('#alert-settings .alert-code-editor textarea', 'window.__untrustedAlertCode = true;');
  await clickText('#alert-settings .alert-code-tabs', 'CSS');
  await fill('#alert-settings .alert-code-editor textarea', '.alert { color: #bee1fc; font-size: 42px; }');
  await clickText('#alert-settings .alert-code-tabs', 'حقول مخصصة');
  await fill('#alert-settings .alert-code-editor textarea', '{"title":"مرحبًا"}');
  await save();
  stored = await (await fetch(`${base}/api/demo/alert-studio`)).json();
  const code = stored.alerts.KICK.follow.customCode;
  assert.equal(code.html, '<div class="alert">{username}</div>'); assert.equal(code.javascript, 'window.__untrustedAlertCode = true;');
  assert.equal(code.css, '.alert { color: #bee1fc; font-size: 42px; }'); assert.equal(code.fields, '{"title":"مرحبًا"}');
  assert.equal(await page.evaluate(() => window.__untrustedAlertCode), undefined);
  check('All code tabs persist independently without execution');
  await clickText('#alert-settings .alert-code-tabs', 'HTML');
  await shot('06-custom-code.png', '#alert-settings .alert-code-section');
  await shot('02-middle.png', '#alert-settings [data-field="الصورة"]');
  await shot('03-bottom.png', '#alert-settings [data-field="حجم الخط"]');

  const downloadDir = path.resolve('.demo-data/alerts-downloads'); fs.mkdirSync(downloadDir, { recursive: true });
  const cdp = await page.createCDPSession(); await cdp.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
  await clickText('#alert-settings', 'تصدير هذا التنبيه');
  const downloaded = path.join(downloadDir, 'cylix-kick-follow.json');
  for (let attempt = 0; attempt < 30 && !fs.existsSync(downloaded); attempt++) await pause(100);
  const exported = JSON.parse(fs.readFileSync(downloaded, 'utf8')); assert.equal(exported.config.customCode.javascript, code.javascript);
  await fill('#alert-settings [data-field="النص"] textarea', 'changed before import');
  const importedResponse = page.waitForResponse(r => r.url().endsWith('/api/demo/alert-studio') && r.request().method() === 'PUT');
  await (await page.$('input[aria-label="استيراد ملف التنبيه"]')).uploadFile(downloaded); await importedResponse; await pause();
  assert.equal(await page.$eval('#alert-settings [data-field="النص"] textarea', el => el.value), exported.config.message);
  check('Actual JSON download and import round trip');

  const overlay = await browser.newPage(); await overlay.setViewport({ width: 1280, height: 720 });
  await overlay.goto(`${base}/overlay/demo-alerts/${initial.token}`, { waitUntil: 'domcontentloaded' });
  console.log('OBS opened');
  await page.bringToFront();
  const testResponse = page.waitForResponse(r => r.url().endsWith('/alert-studio/test')).catch(error => { console.error('Test request not received', error.message); return null; });
  await clickText('.alert-tests', 'متابع جديد'); const event = (await (await testResponse).json()).event;
  assert.equal(event.variationId, variation.id); assert.equal(event.visualId, uploadPayload.asset.id);
  await overlay.bringToFront();
  await overlay.waitForFunction(() => document.body.textContent.includes('هدية خاصة'), { timeout: 60000, polling: 200 });
  assert.equal(await overlay.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
  assert.equal(await overlay.evaluate(() => window.__untrustedAlertCode), undefined);
  await overlay.waitForFunction(() => { const p = document.querySelector('main p'); return p && getComputedStyle(p).visibility === 'visible' && p.closest('[aria-hidden="false"]'); }, { polling: 100 });
  await pause(500);
  await overlay.screenshot({ path: path.join(out, '07-obs-preview.png') });
  check('Saved variation reaches transparent OBS renderer with correct variables and media');
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await overlay.waitForFunction(() => !document.body.textContent.includes('هدية خاصة'), { timeout: 15000, polling: 200 });
  const pending = await (await fetch(`${base}/api/demo/alert-studio/overlay/${initial.token}/live`)).json();
  assert.ok(!pending.events.some(item => item.id === event.id));
  check('Overlay acknowledges and drains the test queue');
  await overlay.close();

  await page.setViewport({ width: 390, height: 844 });
  // Use the existing sidebar collapse control; the global sidebar is unchanged.
  const collapse = await page.$('button[aria-label="طي الشريط الجانبي"]'); if (collapse) await collapse.click();
  await pause(350);
  const mobile = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth })); assert.equal(mobile.scroll, mobile.width);
  await shot('08-mobile.png');
  await clickText('#alert-settings', 'إضافة تنويعة'); await page.waitForSelector('[role="dialog"]');
  await pause(350);
  const modal = await page.$eval('[role="dialog"]', el => ({ width: el.getBoundingClientRect().width, height: el.getBoundingClientRect().height, scroll: el.scrollWidth }));
  assert.ok(modal.width <= 390 && modal.height <= 844 && modal.scroll <= modal.width + 1);
  await page.screenshot({ path: path.join(out, '09-mobile-variation.png') });
  await page.keyboard.press('Escape'); check('Mobile has no horizontal overflow; modal fits viewport');

  await page.setViewport({ width: 1600, height: 1000 });
  await page.click('[aria-label="حذف ترحيب خاص"]');
  await page.waitForSelector('[role="dialog"]'); await clickText('[role="dialog"]', 'إلغاء');
  assert.ok((await (await fetch(`${base}/api/demo/alert-studio`)).json()).alerts.KICK.follow.variations.some(v => v.id === variation.id));
  await page.click('[aria-label="حذف ترحيب خاص"]');
  const deletedResponse = page.waitForResponse(r => r.url().endsWith('/api/demo/alert-studio') && r.request().method() === 'PUT');
  await clickText('[role="dialog"]', 'تأكيد الحذف'); await deletedResponse;
  assert.ok(!(await (await fetch(`${base}/api/demo/alert-studio`)).json()).alerts.KICK.follow.variations.some(v => v.id === variation.id));
  check('Variation delete requires confirmation and persists');
  assert.deepEqual(report.errors, []);
} catch (error) {
  console.error('VERIFICATION FAILED', error.message);
  await page.screenshot({ path: path.resolve('.demo-data/alerts-failure.png') });
  throw error;
} finally {
  for (const id of uploaded) await fetch(`${base}/api/demo/alert-studio/media/${id}`, { method: 'DELETE' });
  await fetch(`${base}/api/demo/alert-studio`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ alerts: initial.alerts, simulation: initial.simulation, plan: initial.plan }) });
  fs.writeFileSync(path.join(out, 'verification.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
