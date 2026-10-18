// Chrome headless timings. This is not an OBS Browser Source test.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/Store/Cylix/CylixStudio-Demo";
const OUT = path.join(ROOT, "tmp/wave-c");
const STATE = path.join(ROOT, ".demo-data/state.json");
const BACKUP = path.join(OUT, "state.before.json");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
const TOKEN = "demo-dff48feb-fec6-408c-8134-d1c6999cd662";
const OVERLAY = `http://127.0.0.1:3001/overlay/${TOKEN}`;
const profile = path.join(process.env.TEMP || "C:/Windows/Temp", "cylix-wave-c-chrome2");

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(STATE, BACKUP);
fs.rmSync(profile, { recursive: true, force: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--window-size=1280,720",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitJson() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (response.ok) return response.json();
    } catch {
      /* starting */
    }
    await sleep(250);
  }
  throw new Error("chrome debugging port did not open");
}

let id = 0;
function send(ws, method, params = {}) {
  const messageId = ++id;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id !== messageId) return;
      ws.removeEventListener("message", onMessage);
      if (data.error) reject(new Error(`${method} ${JSON.stringify(data.error)}`));
      else resolve(data.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
}

async function evaluate(ws, expression) {
  const result = await send(ws, "Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed");
  }
  return result.result?.value;
}

let page;
try {
  const version = await waitJson();
  const browser = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browser.addEventListener("open", resolve, { once: true });
    browser.addEventListener("error", reject, { once: true });
  });
  const { targetId } = await send(browser, "Target.createTarget", { url: "about:blank" });
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
  const target = list.find((item) => item.id === targetId);
  browser.close();
  page = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    page.addEventListener("open", resolve, { once: true });
    page.addEventListener("error", reject, { once: true });
  });
  await send(page, "Page.enable");
  await send(page, "Runtime.enable");
  await send(page, "Page.navigate", { url: OVERLAY });
  let boot = null;
  for (let attempt = 0; attempt < 24; attempt += 1) {
    await sleep(500);
    boot = await evaluate(page, `(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const demo = performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/demo/state"));
      const span = demo.length > 1 ? demo[demo.length - 1].startTime - demo[0].startTime : 0;
      return {
        href: location.href,
        title: document.title,
        text: document.body ? document.body.innerText.slice(0, 180) : "",
        chatNodes: document.querySelectorAll("[data-chat-id]").length,
        status: document.querySelector("[role=status]")?.textContent || "",
        nav: nav ? { ttfb: nav.responseStart, dcl: nav.domContentLoadedEventEnd, load: nav.loadEventEnd } : null,
        demoRequests: demo.length,
        spanMs: Math.round(span),
        perSecond: span > 0 ? Math.round((demo.length / (span / 1000)) * 10) / 10 : demo.length,
        waitedMs: ${attempt * 500 + 500},
      };
    })()`);
    if (boot.chatNodes > 0 || boot.status) break;
  }
  fs.writeFileSync(path.join(OUT, "overlay-after-boot.json"), JSON.stringify(boot, null, 2));
  console.log("BOOT", JSON.stringify(boot));

  const samples = await evaluate(page, `(async () => {
    const token = ${JSON.stringify(TOKEN)};
    async function publish(text) {
      const mark = "m" + Math.random().toString(36).slice(2, 10);
      const t0 = performance.now();
      const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
      const prev = Array.isArray(state.messages[token]) ? state.messages[token] : [];
      state.messages[token] = [{
        id: mark,
        platform: "KICK",
        author: "Wave",
        color: "#7dd3fc",
        badges: ["moderator"],
        badgeList: [{ type: "moderator", text: "MOD", count: null }],
        text: text + " " + mark,
        at: Date.now(),
      }, ...prev].slice(0, 40);
      const put0 = performance.now();
      const saved = await fetch("/api/demo/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const put1 = performance.now();
      let seen = null;
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        if (document.body.innerText.includes(mark)) { seen = performance.now(); break; }
        await new Promise((resolve) => setTimeout(resolve, 16));
      }
      const first = document.querySelector("[data-chat-id]");
      return {
        status: saved.status,
        visible: seen != null,
        putMs: Math.round((put1 - put0) * 10) / 10,
        afterPutMs: seen == null ? null : Math.round((seen - put1) * 10) / 10,
        totalMs: seen == null ? null : Math.round((seen - t0) * 10) / 10,
        ordered: first ? first.getAttribute("data-chat-id") === mark : false,
      };
    }
    const singles = [];
    for (let i = 0; i < 8; i += 1) singles.push(await publish("one"));
    const arabic = await publish("هذا سطر عربي طويل جداً للتحقق من ظهور الرسالة داخل الأوفرلاي");
    const mixed = await publish("hello مرحبا world يسار يمين");
    const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
    const added = [];
    for (let i = 0; i < 50; i += 1) {
      added.push({ id: "b" + String(i).padStart(2, "0"), platform: "TEST", author: "Burst", color: "#fff", badges: ["vip"], badgeList: [{ type: "vip", text: "VIP", count: 1 }], text: "burst " + i, at: 1700000000000 + (50 - i) });
    }
    state.messages[token] = added;
    const burst0 = performance.now();
    await fetch("/api/demo/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
    const burstPut = performance.now();
    let burstSeen = null;
    const deadline = performance.now() + 5000;
    while (performance.now() < deadline) {
      if (document.body.innerText.includes("burst 0")) { burstSeen = performance.now(); break; }
      await new Promise((resolve) => setTimeout(resolve, 16));
    }
    const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
    return {
      singles,
      arabic,
      mixed,
      burst: {
        visible: burstSeen != null,
        afterPutMs: burstSeen == null ? null : Math.round((burstSeen - burstPut) * 10) / 10,
        wallMs: Math.round((performance.now() - burst0) * 10) / 10,
        rendered: ids.length,
        first: ids[0] || null,
        hasBadgeText: document.body.innerText.includes("burst 0"),
      },
    };
  })()`);
  const idleStart = await evaluate(page, `performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/demo/state")).length`);
  await sleep(2000);
  const idle = await evaluate(page, `(() => {
    const rows = performance.getEntriesByType("resource").filter((entry) => entry.name.includes("/api/demo/state"));
    const recent = rows.filter((entry) => performance.now() - entry.startTime < 2000);
    return { total: rows.length, recent: recent.length };
  })()`);
  const report = { browser: "Chrome headless, not OBS", overlay: OVERLAY, boot, samples, idleStart, idle2s: idle };
  fs.writeFileSync(path.join(OUT, "overlay-after.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try { fs.copyFileSync(BACKUP, STATE); } catch { /* keep going */ }
  try { page?.close(); } catch { /* closed */ }
  chrome.kill();
}
