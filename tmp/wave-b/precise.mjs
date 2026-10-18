import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9335;
const profile = `${process.env.TEMP}\\cylix-wave-b-chrome-precise`;
const origin = "http://127.0.0.1:3001";

mkdirSync(profile, { recursive: true });

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result ?? {});
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

async function waitForJson(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch {
      /* retry */
    }
    await delay(250);
  }
  throw new Error("CDP not ready");
}

function label(url) {
  if (url.includes("/api/demo/state")) return "GET /api/demo/state";
  if (!url.includes("/_serverFn/")) return null;
  try {
    const id = decodeURIComponent(url.split("/_serverFn/")[1] ?? "");
    const json = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
    const file = String(json.file ?? "").split("/").pop()?.split("?")[0] ?? "fn";
    const exp = String(json.export ?? "").replace(/_createServerFn_handler$/, "");
    return `${file}:${exp}`;
  } catch {
    return "serverFn";
  }
}

async function openPage(browser) {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Network.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `(() => { window.__longTasks = []; try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) window.__longTasks.push(entry.duration); }).observe({ type: "longtask", buffered: true }); } catch {} })();`,
    },
    sessionId,
  );
  return { sessionId, targetId: created.targetId };
}

async function navigate(browser, sessionId, url) {
  const calls = new Map();
  const stop = browser.subscribe((message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Network.requestWillBeSent") {
      const requestUrl = message.params.request.url;
      const name = label(requestUrl);
      if (!name) return;
      calls.set(message.params.requestId, {
        name,
        method: message.params.request.method,
        start: message.params.timestamp,
      });
    }
    if (message.method === "Network.responseReceived") {
      const row = calls.get(message.params.requestId);
      if (!row) return;
      row.status = message.params.response.status;
      row.response = message.params.timestamp;
    }
    if (message.method === "Network.loadingFinished" || message.method === "Network.loadingFailed") {
      const row = calls.get(message.params.requestId);
      if (!row) return;
      row.end = message.params.timestamp;
    }
  });
  await browser.send("Page.navigate", { url }, sessionId);
  const started = Date.now();
  let contentMs = null;
  let href = "";
  while (Date.now() - started < 15000) {
    const probe = await browser.send(
      "Runtime.evaluate",
      {
        expression: `(() => ({ href: location.pathname, now: performance.now(), text: (document.body && document.body.innerText || "").slice(0, 180), switches: document.querySelectorAll("[role=switch]").length, discord: (document.body && document.body.innerText || "").includes("!discord") }))()`,
        returnByValue: true,
      },
      sessionId,
    );
    const value = probe.result?.value;
    href = value?.href ?? "";
    const ready =
      (url.endsWith("/commands/creovixstudio") && value?.discord) ||
      (url.endsWith("/custom-commands") && value?.switches > 0) ||
      (url.endsWith("/dashboard") && href.startsWith("/dashboard") && (value?.text || "").includes("CylixStudio") && (value?.text || "").length > 80) ||
      (url.endsWith("/settings") && href.includes("/settings") && (value?.text || "").length > 80) ||
      (url.endsWith("/widgets") && href.includes("/widgets") && (value?.text || "").length > 80) ||
      ((url.endsWith("/") || url.endsWith("/login")) && href.startsWith("/dashboard") && (value?.text || "").includes("CylixStudio"));
    if (ready && contentMs == null) contentMs = value.now;
    if (ready) break;
    await delay(40);
  }
  await delay(200);
  const timing = await browser.send(
    "Runtime.evaluate",
    {
      expression: `(() => { const nav = performance.getEntriesByType("navigation")[0]; const tasks = window.__longTasks || []; return { ttfb: nav ? nav.responseStart - nav.requestStart : null, load: nav ? nav.loadEventEnd : null, dcl: nav ? nav.domContentLoadedEventEnd : null, longCount: tasks.length, longMs: tasks.reduce((s, n) => s + n, 0), maxLong: tasks.reduce((s, n) => Math.max(s, n), 0) }; })()`,
      returnByValue: true,
    },
    sessionId,
  );
  stop();
  const fns = [...calls.values()].map((row) => ({
    name: row.name,
    method: row.method,
    status: row.status ?? null,
    ms: row.end && row.start ? Math.round((row.end - row.start) * 1000) : null,
  }));
  return {
    contentMs: contentMs == null ? null : Math.round(contentMs * 10) / 10,
    href,
    timing: timing.result?.value ?? null,
    fns,
  };
}

async function clickMeasure(browser, sessionId, clickSource, readySource) {
  const calls = [];
  const stop = browser.subscribe((message) => {
    if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
    const name = label(message.params.response.url);
    if (!name) return;
    calls.push({ name, status: message.params.response.status, method: message.params.type });
  });
  const clicked = await browser.send(
    "Runtime.evaluate",
    {
      expression: `(() => { const result = (${clickSource})(); return { t: performance.now(), result }; })()`,
      returnByValue: true,
    },
    sessionId,
  );
  const click = clicked.result?.value;
  if (!click?.result?.ok) {
    stop();
    return { ok: false, click: click?.result, calls };
  }
  let elapsed = null;
  const started = Date.now();
  let detail = null;
  while (Date.now() - started < 8000) {
    const probe = await browser.send(
      "Runtime.evaluate",
      {
        expression: `(() => { const value = (${readySource})(); return value && value.ok ? { ...value, elapsed: performance.now() - ${click.t} } : { ok: false }; })()`,
        returnByValue: true,
      },
      sessionId,
    );
    detail = probe.result?.value;
    if (detail?.ok) {
      elapsed = Math.round(detail.elapsed * 10) / 10;
      break;
    }
    await delay(30);
  }
  await delay(150);
  stop();
  return { ok: elapsed != null, elapsedMs: elapsed, before: click.result, detail, calls };
}

async function main() {
  const child = spawn(
    chromePath,
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      "--no-proxy-server",
      "--remote-allow-origins=*",
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      "--window-size=1440,900",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browser = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => {
    browser.ws.addEventListener("open", resolve);
    browser.ws.addEventListener("error", reject);
  });
  const report = { cold: {}, warm: {}, interactions: {} };
  try {
    const paths = ["/", "/login", "/dashboard", "/custom-commands", "/widgets", "/settings", "/commands/creovixstudio"];
    for (const pass of ["cold", "warm"]) {
      for (const path of paths) {
        const page = await openPage(browser);
        report[pass][path] = await navigate(browser, page.sessionId, `${origin}${path}`);
        await browser.send("Target.closeTarget", { targetId: page.targetId });
      }
    }
    const page = await openPage(browser);
    await navigate(browser, page.sessionId, `${origin}/dashboard`);
    report.interactions.navCommands = await clickMeasure(
      browser,
      page.sessionId,
      `() => { const link = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("custom-commands")); if (!link) return { ok: false }; link.click(); return { ok: true }; }`,
      `() => ({ ok: location.pathname.includes("custom-commands") && document.querySelectorAll("[role=switch]").length > 0, switches: document.querySelectorAll("[role=switch]").length })`,
    );
    await navigate(browser, page.sessionId, `${origin}/custom-commands`);
    report.interactions.toggle = await clickMeasure(
      browser,
      page.sessionId,
      `() => { const control = document.querySelector("article [role=switch]"); if (!control) return { ok: false }; window.__before = control.getAttribute("aria-checked"); control.click(); return { ok: true, before: window.__before }; }`,
      `() => { const control = document.querySelector("article [role=switch]"); const checked = control && control.getAttribute("aria-checked"); return { ok: Boolean(checked) && checked !== window.__before, checked, before: window.__before }; }`,
    );
    report.interactions.prefixSave = await clickMeasure(
      browser,
      page.sessionId,
      `() => { const tab = [...document.querySelectorAll("button")].find((el) => (el.textContent || "").trim() === "أوامر مخصصة"); if (tab) tab.click(); return { ok: true, tab: Boolean(tab) }; }`,
      `() => ({ ok: [...document.querySelectorAll("button")].some((el) => (el.textContent || "").includes("حفظ المحفّز")) })`,
    );
    report.interactions.prefixSaveClick = await clickMeasure(
      browser,
      page.sessionId,
      `() => { const button = [...document.querySelectorAll("button")].find((el) => (el.textContent || "").includes("حفظ المحفّز")); if (!button) return { ok: false }; button.click(); return { ok: true }; }`,
      `() => ({ ok: (document.body.innerText || "").includes("تم") || document.querySelector("[data-sonner-toast]") != null })`,
    );
    await browser.send("Target.closeTarget", { targetId: page.targetId });
  } finally {
    browser.ws.close();
    child.kill();
  }
  writeFileSync(new URL("./precise.json", import.meta.url), JSON.stringify(report, null, 2));
  console.log("wrote precise.json");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
