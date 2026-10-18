// Headless Chrome timings for the local Demo app. Prints JSON only.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9334;
const profile = `${process.env.TEMP}\\cylix-wave-b-chrome`;
const origin = "http://127.0.0.1:3001";

const pages = [
  { id: "home", path: "/" },
  { id: "login", path: "/login" },
  { id: "dashboard", path: "/dashboard" },
  { id: "custom-commands", path: "/custom-commands" },
  { id: "widgets", path: "/widgets" },
  { id: "settings", path: "/settings" },
  { id: "public-commands", path: "/commands/creovixstudio" },
];

mkdirSync(profile, { recursive: true });

function classify(url, resourceType) {
  const path = url.split("?")[0] ?? url;
  if (resourceType === "Document") return "document";
  if (path.includes("/api/") || path.includes("/_server") || path.includes("serverFn")) return "server";
  if (
    path.endsWith(".js") ||
    path.endsWith(".css") ||
    path.endsWith(".map") ||
    path.includes("/@") ||
    path.includes("/node_modules/") ||
    path.includes("/src/")
  ) {
    return "asset";
  }
  return "other";
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pending = new Map();
    this.listeners = [];
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

  on(listener) {
    this.listeners.push(listener);
  }
}

async function waitForJson(url, attempts = 40) {
  let last = "";
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
      last = `status ${response.status}`;
    } catch (error) {
      last = error instanceof Error ? error.message : String(error);
    }
    await delay(250);
  }
  throw new Error(`CDP not ready: ${last}`);
}

function launchChrome() {
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
  return child;
}

async function openSession(browser) {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Network.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send(
    "Page.addScriptToEvaluateOnNewDocument",
    {
      source: `(() => {
        window.__longTasks = [];
        try {
          new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              window.__longTasks.push({ duration: entry.duration, start: entry.startTime, name: entry.name });
            }
          }).observe({ type: "longtask", buffered: true });
        } catch {}
      })();`,
    },
    sessionId,
  );
  return { sessionId, targetId: created.targetId };
}

async function readPage(browser, sessionId) {
  const result = await browser.send(
    "Runtime.evaluate",
    {
      expression: `(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        const resources = performance.getEntriesByType("resource");
        const longTasks = window.__longTasks || [];
        return {
          href: location.href,
          title: document.title,
          text: (document.body?.innerText || "").slice(0, 400),
          buttons: [...document.querySelectorAll("button, [role=switch], a")].slice(0, 25).map((el) => ({
            tag: el.tagName,
            role: el.getAttribute("role"),
            text: (el.innerText || el.getAttribute("aria-label") || "").trim().slice(0, 60),
            href: el.getAttribute("href"),
            checked: el.getAttribute("aria-checked"),
          })),
          inputs: [...document.querySelectorAll("input")].slice(0, 8).map((el) => el.getAttribute("placeholder") || el.getAttribute("aria-label") || el.type),
          cards: document.querySelectorAll("article, li").length,
          switches: document.querySelectorAll("[role=switch]").length,
          nav: nav ? {
            ttfbMs: Math.round((nav.responseStart - nav.requestStart) * 10) / 10,
            responseMs: Math.round((nav.responseEnd - nav.requestStart) * 10) / 10,
            domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd * 10) / 10,
            loadMs: Math.round(nav.loadEventEnd * 10) / 10,
            transferSize: nav.transferSize,
            encodedBodySize: nav.encodedBodySize,
            type: nav.type,
          } : null,
          resourceCount: resources.length,
          longTaskCount: longTasks.length,
          longTaskMs: Math.round(longTasks.reduce((sum, entry) => sum + entry.duration, 0) * 10) / 10,
          maxLongTaskMs: Math.round(Math.max(0, ...longTasks.map((entry) => entry.duration)) * 10) / 10,
        };
      })()`,
      returnByValue: true,
    },
    sessionId,
  );
  return result.result?.value ?? null;
}

async function measureNavigation(browser, sessionId, url, cacheDisabled) {
  const requests = [];
  const onMessage = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method === "Network.requestWillBeSent") {
      const request = message.params.request;
      requests.push({
        url: request.url,
        method: request.method,
        type: message.params.type,
        kind: classify(request.url, message.params.type),
      });
    }
  };
  browser.on(onMessage);
  await browser.send("Network.setCacheDisabled", { cacheDisabled }, sessionId);
  const started = Date.now();
  await browser.send("Page.navigate", { url }, sessionId);
  let loaded = false;
  const onLoad = (message) => {
    if (message.sessionId === sessionId && message.method === "Page.loadEventFired") loaded = true;
  };
  browser.on(onLoad);
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (loaded) {
      await delay(600);
      break;
    }
    await delay(100);
  }
  const page = await readPage(browser, sessionId);
  const wallMs = Date.now() - started;
  const counts = { document: 0, server: 0, asset: 0, other: 0 };
  const interesting = [];
  for (const request of requests) {
    counts[request.kind] = (counts[request.kind] ?? 0) + 1;
    if (request.kind !== "asset" && interesting.length < 20) {
      interesting.push(`${request.method} ${request.kind} ${request.url.replace(origin, "")}`);
    }
  }
  return { wallMs, loaded, counts, interesting, page };
}

async function waitFor(browser, sessionId, predicateSource, timeoutMs = 8000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const result = await browser.send(
      "Runtime.evaluate",
      { expression: predicateSource, returnByValue: true },
      sessionId,
    );
    const value = result.result?.value;
    if (value?.ok) return { ...value, waitedMs: Date.now() - started };
    await delay(50);
  }
  const page = await readPage(browser, sessionId);
  return { ok: false, waitedMs: Date.now() - started, href: page?.href, text: page?.text?.slice(0, 180) };
}

async function clickAndTime(browser, sessionId, clickSource, readySource) {
  const requests = [];
  const onMessage = (message) => {
    if (message.sessionId !== sessionId) return;
    if (message.method !== "Network.requestWillBeSent") return;
    const request = message.params.request;
    const kind = classify(request.url, message.params.type);
    if (kind !== "asset") {
      requests.push(`${request.method} ${kind} ${request.url.replace(origin, "")}`);
    }
  };
  browser.on(onMessage);
  const clicked = await browser.send(
    "Runtime.evaluate",
    {
      expression: `(() => { const t = performance.now(); const result = (${clickSource})(); return { t, result }; })()`,
      returnByValue: true,
    },
    sessionId,
  );
  const click = clicked.result?.value;
  if (!click?.result?.ok) return { ok: false, click, requests };
  const ready = await waitFor(
    browser,
    sessionId,
    `(() => { const value = (${readySource})(); if (!value?.ok) return value; return { ...value, elapsedMs: Math.round((performance.now() - ${click.t}) * 10) / 10 }; })()`,
  );
  return { ok: Boolean(ready.ok), elapsedMs: ready.elapsedMs ?? ready.waitedMs, detail: ready, requests };
}

async function main() {
  const child = launchChrome();
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browser = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => {
    browser.ws.addEventListener("open", resolve);
    browser.ws.addEventListener("error", reject);
  });
  const report = { pages: {}, interactions: {} };
  try {
    for (const pass of ["cold", "warm"]) {
      for (const page of pages) {
        const session = await openSession(browser);
        const measured = await measureNavigation(browser, session.sessionId, `${origin}${page.path}`, pass === "cold");
        const marker = await waitFor(
          browser,
          session.sessionId,
          `(() => {
            const href = location.pathname;
            const text = document.body?.innerText || "";
            const nowMs = Math.round(performance.now() * 10) / 10;
            if (${JSON.stringify(page.id)} === "public-commands") {
              const card = text.includes("!discord") || text.includes("أمر متاح");
              return { ok: card, href, nowMs, snippet: text.slice(0, 120) };
            }
            const refused = text.includes("refused to connect") || text.includes("ERR_CONNECTION");
            if (refused) return { ok: false, href, nowMs, snippet: text.slice(0, 120) };
            if (${JSON.stringify(page.id)} === "home" || ${JSON.stringify(page.id)} === "login") {
              return { ok: href.startsWith("/dashboard") && Boolean(document.querySelector("a[href]")), href, nowMs, snippet: text.slice(0, 120) };
            }
            if (${JSON.stringify(page.id)} === "custom-commands") {
              return { ok: href.includes("custom-commands") && document.querySelectorAll("[role=switch]").length > 0, href, nowMs, snippet: text.slice(0, 120) };
            }
            return { ok: href.includes(${JSON.stringify(page.path)}) && text.trim().length > 40, href, nowMs, snippet: text.slice(0, 120) };
          })()`,
          12000,
        );
        report.pages[`${pass}:${page.id}`] = {
          requested: page.path,
          wallMs: measured.wallMs,
          loaded: measured.loaded,
          counts: measured.counts,
          interesting: measured.interesting,
          timing: measured.page?.nav ?? null,
          href: measured.page?.href ?? marker.href,
          longTaskCount: measured.page?.longTaskCount ?? null,
          longTaskMs: measured.page?.longTaskMs ?? null,
          maxLongTaskMs: measured.page?.maxLongTaskMs ?? null,
          resourceCount: measured.page?.resourceCount ?? null,
          cards: measured.page?.cards ?? null,
          switches: measured.page?.switches ?? null,
          contentWaitMs: marker.waitedMs,
          contentReadyMs: marker.nowMs ?? null,
          contentOk: marker.ok,
          snippet: marker.snippet ?? measured.page?.text?.slice(0, 160),
          buttons: pass === "warm" ? measured.page?.buttons : undefined,
          inputs: pass === "warm" ? measured.page?.inputs : undefined,
        };
        await browser.send("Target.closeTarget", { targetId: session.targetId });
      }
    }

    const session = await openSession(browser);
    await measureNavigation(browser, session.sessionId, `${origin}/dashboard`, false);
    await waitFor(
      browser,
      session.sessionId,
      `(() => ({ ok: location.pathname.startsWith("/dashboard") && (document.body?.innerText || "").length > 40 }))()`,
    );
    report.interactions.navCustomCommands = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const link = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("custom-commands"));
        if (!link) return { ok: false, reason: "missing-link" };
        link.click();
        return { ok: true };
      }`,
      `() => ({ ok: location.pathname.includes("custom-commands") && document.querySelectorAll("[role=switch]").length > 0, href: location.pathname, switches: document.querySelectorAll("[role=switch]").length })`,
    );
    report.interactions.navSettings = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const link = [...document.querySelectorAll("a")].find((el) => (el.getAttribute("href") || "").includes("/settings"));
        if (!link) return { ok: false, reason: "missing-link", hrefs: [...document.querySelectorAll("a")].map((el) => el.getAttribute("href")).filter(Boolean).slice(0, 20) };
        link.click();
        return { ok: true };
      }`,
      `() => ({ ok: location.pathname.includes("/settings") && (document.body?.innerText || "").length > 40, href: location.pathname })`,
    );

    await browser.send("Page.navigate", { url: `${origin}/custom-commands` }, session.sessionId);
    await waitFor(
      browser,
      session.sessionId,
      `(() => ({ ok: document.querySelectorAll("[role=switch]").length > 0 }))()`,
    );
    report.interactions.toggleDefault = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const control = document.querySelector("[role=switch]");
        if (!control) return { ok: false, reason: "missing-switch" };
        const before = control.getAttribute("aria-checked");
        control.click();
        return { ok: true, before };
      }`,
      `() => {
        const control = document.querySelector("[role=switch]");
        const checked = control?.getAttribute("aria-checked");
        return { ok: Boolean(control) && checked && checked !== ${JSON.stringify("PENDING")}, checked, href: location.pathname };
      }`,
    );
    // The ready predicate above is wrong because it does not compare to before.
    // Re-measure with the before value captured in the page.
    report.interactions.toggleDefaultCompared = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const controls = [...document.querySelectorAll("[role=switch]")];
        const control = controls[1] || controls[0];
        if (!control) return { ok: false, reason: "missing-switch" };
        window.__toggleBefore = control.getAttribute("aria-checked");
        window.__toggleLabel = control.getAttribute("aria-label");
        control.click();
        return { ok: true, before: window.__toggleBefore };
      }`,
      `() => {
        const controls = [...document.querySelectorAll("[role=switch]")];
        const control = controls[1] || controls[0];
        const checked = control?.getAttribute("aria-checked");
        return { ok: Boolean(checked) && checked !== window.__toggleBefore, checked, before: window.__toggleBefore };
      }`,
    );

    await browser.send("Page.navigate", { url: `${origin}/commands/creovixstudio` }, session.sessionId);
    await waitFor(
      browser,
      session.sessionId,
      `(() => ({ ok: (document.body?.innerText || "").includes("!discord") }))()`,
    );
    report.interactions.publicSearch = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const input = document.querySelector("input");
        if (!input) return { ok: false, reason: "missing-input" };
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        proto.set.call(input, "discord");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        return { ok: true, before: document.querySelectorAll("li").length };
      }`,
      `() => {
        const text = document.body?.innerText || "";
        const count = document.querySelectorAll("li").length;
        return { ok: text.includes("!discord") && count > 0 && count < 12, count };
      }`,
    );
    report.interactions.publicTab = await clickAndTime(
      browser,
      session.sessionId,
      `() => {
        const button = [...document.querySelectorAll("button")].find((el) => (el.textContent || "").includes("الافتراضية"));
        if (!button) return { ok: false, reason: "missing-tab" };
        button.click();
        return { ok: true };
      }`,
      `() => {
        const text = document.body?.innerText || "";
        return { ok: text.includes("!points") || text.includes("!uptime") || text.includes("!lurk") || text.includes("!so"), snippet: text.slice(0, 180) };
      }`,
    );

    const finalPage = await readPage(browser, session.sessionId);
    report.final = {
      href: finalPage?.href,
      buttons: finalPage?.buttons,
      inputs: finalPage?.inputs,
    };
    await browser.send("Target.closeTarget", { targetId: session.targetId });
  } finally {
    browser.ws.close();
    child.kill();
  }
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
