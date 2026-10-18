import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const port = 9339;
const profile = `${process.env.TEMP}\\cylix-wave-b-toggle`;
const origin = "http://127.0.0.1:3001";
mkdirSync(profile, { recursive: true });

function median(values) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
const round = (value) => (value == null || !Number.isFinite(value) ? null : Math.round(value * 10) / 10);

function fnName(url) {
  if (!String(url).includes("/_serverFn/")) return null;
  try {
    const json = JSON.parse(Buffer.from(String(url).split("/_serverFn/")[1], "base64url").toString("utf8"));
    return String(json.export ?? "").replace(/_createServerFn_handler$/, "");
  } catch {
    return null;
  }
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const done = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) done.reject(new Error(JSON.stringify(message.error)));
        else done.resolve(message.result ?? {});
      } else for (const listener of this.listeners) listener(message);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

const child = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--no-proxy-server", "--remote-allow-origins=*", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
let version;
for (let i = 0; i < 40; i += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (response.ok) { version = await response.json(); break; }
  } catch { /* retry */ }
  await delay(250);
}
const browser = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
await new Promise((resolve) => browser.ws.addEventListener("open", resolve));
const created = await browser.send("Target.createTarget", { url: "about:blank" });
const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
const sessionId = attached.sessionId;
await browser.send("Page.enable", {}, sessionId);
await browser.send("Network.enable", {}, sessionId);
await browser.send("Runtime.enable", {}, sessionId);
const evalPage = async (expression) => (await browser.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId)).result?.value;

await browser.send("Page.navigate", { url: `${origin}/custom-commands` }, sessionId);
for (let i = 0; i < 40; i += 1) {
  const ready = await evalPage(`document.querySelectorAll("article [role=switch]").length > 0`);
  if (ready) break;
  await delay(100);
}

const clicks = [];
for (let i = 0; i < 3; i += 1) {
  const posts = [];
  const stop = browser.subscribe((message) => {
    if (message.sessionId !== sessionId || message.method !== "Network.loadingFinished") return;
    const request = message.params;
    if (request && posts.length < 5) posts.push(message.params.requestId);
  });
  const names = [];
  const stop2 = browser.subscribe((message) => {
    if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
    const name = fnName(message.params.response.url);
    if (name === "setDefaultCommandEnabled") names.push({ status: message.params.response.status, ts: message.params.timestamp });
  });
  const clicked = await evalPage(`(() => {
    const control = document.querySelector("article [role=switch]");
    const before = control.getAttribute("aria-checked");
    window.__samples = [];
    const started = performance.now();
    const observer = new MutationObserver(() => {
      const checked = control.getAttribute("aria-checked");
      if (checked !== before) window.__samples.push(Math.round((performance.now() - started) * 10) / 10);
    });
    observer.observe(control, { attributes: true, attributeFilter: ["aria-checked"] });
    control.click();
    return { before, started };
  })()`);
  let serverMs = null;
  const wall = Date.now();
  while (Date.now() - wall < 3000) {
    if (names.length) {
      serverMs = Date.now() - wall;
      break;
    }
    await delay(15);
  }
  await delay(120);
  const ui = await evalPage(`(() => ({ samples: window.__samples || [], checked: document.querySelector("article [role=switch]").getAttribute("aria-checked") }))()`);
  stop();
  stop2();
  clicks.push({ before: clicked.before, checked: ui.checked, uiMs: ui.samples?.[0] ?? null, serverMs: round(serverMs), posts: names.length, status: names[0]?.status ?? null });
}

const finalChecked = clicks.at(-1)?.checked;
await browser.send("Page.reload", { ignoreCache: true }, sessionId);
for (let i = 0; i < 30; i += 1) {
  const ready = await evalPage(`document.querySelector("article [role=switch]")?.getAttribute("aria-checked") || ""`);
  if (ready) {
    var reloaded = ready;
    break;
  }
  await delay(100);
}

const failure = await evalPage(`(() => {
  const control = document.querySelectorAll("article [role=switch]")[1];
  const before = control.getAttribute("aria-checked");
  const seen = [];
  const observer = new MutationObserver(() => seen.push(control.getAttribute("aria-checked")));
  observer.observe(control, { attributes: true, attributeFilter: ["aria-checked"] });
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = String(input && input.url ? input.url : input);
    if (url.includes("setDefaultCommandEnabled") || url.includes("/_serverFn/")) {
      try {
        const id = url.split("/_serverFn/")[1] || "";
        const padded = id.replace(/-/g, "+").replace(/_/g, "/");
        const json = JSON.parse(atob(padded));
        if (String(json.export || "").includes("setDefaultCommandEnabled")) {
          return new Response("", { status: 500 });
        }
      } catch {}
    }
    return original(input, init);
  };
  control.click();
  return { before, seen };
})()`);
await delay(350);
const failureAfter = await evalPage(`(() => {
  const control = document.querySelectorAll("article [role=switch]")[1];
  const text = document.body.innerText;
  return { checked: control.getAttribute("aria-checked"), success: text.includes("تم الحفظ") || text.includes("Saved"), error: text.includes("تعذ") || text.includes("Couldn't") || text.includes("Could not") || text.includes("forced") };
})()`);

await browser.send("Page.reload", { ignoreCache: true }, sessionId);
await delay(800);
let doublePosts = 0;
const stopDouble = browser.subscribe((message) => {
  if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
  if (fnName(message.params.response.url) === "setDefaultCommandEnabled") doublePosts += 1;
});
await evalPage(`(() => { const control = document.querySelector("article [role=switch]"); control.click(); control.click(); return true; })()`);
await delay(400);
stopDouble();

const report = {
  clicks,
  uiMedian: round(median(clicks.map((click) => click.uiMs))),
  serverMedian: round(median(clicks.map((click) => click.serverMs))),
  finalChecked,
  reloaded,
  persisted: reloaded === finalChecked,
  failure: { ...failure, after: failureAfter },
  doublePosts,
};
writeFileSync(new URL("./toggle-repeat.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
browser.ws.close();
child.kill();
