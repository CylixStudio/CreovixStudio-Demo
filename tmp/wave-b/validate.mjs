import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9338;
const profile = `${process.env.TEMP}\\cylix-wave-b-validate`;
const origin = "http://127.0.0.1:3001";
mkdirSync(profile, { recursive: true });

function median(values) {
  const sorted = [...values].filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function fnName(url) {
  if (!url.includes("/_serverFn/")) return null;
  try {
    const id = url.split("/_serverFn/")[1] ?? "";
    const json = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
    return String(json.export ?? "").replace(/_createServerFn_handler$/, "");
  } catch {
    return null;
  }
}

function scanHtml(html) {
  const forbidden = ["service_role", "access_token", "refresh_token", "SUPABASE", "eyJ", "password", "KICK_BOT", "@cylixstudio", "demo@cylix"];
  return {
    length: html.length,
    discord: html.includes("!discord"),
    fixture: html.includes("!fixture1"),
    fixtureLabel: html.includes("FIXTURE hundred"),
    fixtureCount: (html.match(/!fixture\d+/g) ?? []).length,
    forbidden: forbidden.filter((needle) => html.includes(needle)),
  };
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
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result ?? {});
      } else {
        for (const listener of this.listeners) listener(message);
      }
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

async function waitForJson(url) {
  for (let i = 0; i < 40; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    } catch { /* retry */ }
    await delay(250);
  }
  throw new Error("CDP not ready");
}

async function openPage(browser) {
  const created = await browser.send("Target.createTarget", { url: "about:blank" });
  const attached = await browser.send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;
  await browser.send("Page.enable", {}, sessionId);
  await browser.send("Network.enable", {}, sessionId);
  await browser.send("Runtime.enable", {}, sessionId);
  await browser.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  return { sessionId, targetId: created.targetId };
}

async function evalPage(browser, sessionId, expression) {
  const result = await browser.send("Runtime.evaluate", { expression, returnByValue: true }, sessionId);
  return result.result?.value;
}

async function freshCommands(browser, path) {
  const page = await openPage(browser);
  await browser.send("Network.setCacheDisabled", { cacheDisabled: true }, page.sessionId);
  const logs = [];
  const stop = browser.subscribe((message) => {
    if (message.sessionId !== page.sessionId) return;
    if (message.method === "Runtime.consoleAPICalled") {
      const text = (message.params.args ?? []).map((arg) => arg.value ?? arg.description ?? "").join(" ");
      if (/hydrat/i.test(text)) logs.push(text.slice(0, 240));
    }
    if (message.method === "Runtime.exceptionThrown") {
      const text = message.params.exceptionDetails?.text ?? "";
      if (/hydrat/i.test(text)) logs.push(text.slice(0, 240));
    }
  });
  await browser.send("Page.navigate", { url: `${origin}${path}` }, page.sessionId);
  const started = Date.now();
  let contentMs = null;
  while (Date.now() - started < 12000) {
    const probe = await evalPage(
      browser,
      page.sessionId,
      `(() => ({ now: performance.now(), text: document.body ? document.body.innerText : "" }))()`,
    );
    const ready = path.includes("fixture") ? probe?.text?.includes("!fixture1") : probe?.text?.includes("!discord");
    if (ready) {
      contentMs = probe.now;
      break;
    }
    await delay(30);
  }
  await delay(200);
  const detail = await evalPage(
    browser,
    page.sessionId,
    `(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      const grid = document.querySelector("ul");
      const style = grid ? getComputedStyle(grid) : null;
      return {
        ttfb: nav ? nav.responseStart - nav.requestStart : null,
        load: nav ? nav.loadEventEnd : null,
        columns: style ? style.gridTemplateColumns.split(" ").filter(Boolean).length : 0,
        cardH: style ? style.getPropertyValue("--card-h").trim() : "",
        name: (document.querySelector("p") && document.body.innerText.slice(0, 80)) || "",
        pages: [...document.querySelectorAll("nav button")].map((el) => el.textContent.trim()).slice(0, 8),
      };
    })()`,
  );
  stop();
  await browser.send("Target.closeTarget", { targetId: page.targetId });
  return { contentMs: round(contentMs), ttfb: round(detail?.ttfb), load: round(detail?.load), columns: detail?.columns, cardH: detail?.cardH, pages: detail?.pages, hydration: logs };
}

async function main() {
  const creovixHtml = await (await fetch(`${origin}/commands/creovixstudio`)).text();
  const otherHtml = await (await fetch(`${origin}/commands/otherchannel`)).text();
  const fixtureHtml = await (await fetch(`${origin}/commands/fixture-hundred`)).text();
  const report = {
    html: {
      creovix: scanHtml(creovixHtml),
      other: scanHtml(otherHtml),
      fixture: scanHtml(fixtureHtml),
      otherName: otherHtml.includes("otherchannel"),
      creovixHasFixture: creovixHtml.includes("!fixture1"),
      fixtureHasDiscord: fixtureHtml.includes("!discord"),
      otherHasCreovixName: otherHtml.includes(">creovixstudio<") || otherHtml.includes("creovixstudio\n"),
    },
  };

  const child = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--no-proxy-server", "--remote-allow-origins=*", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--window-size=1440,900", "about:blank"], { stdio: "ignore" });
  const version = await waitForJson(`http://127.0.0.1:${port}/json/version`);
  const browser = new Cdp(new WebSocket(version.webSocketDebuggerUrl));
  await new Promise((resolve, reject) => {
    browser.ws.addEventListener("open", resolve);
    browser.ws.addEventListener("error", reject);
  });
  try {
    const samples = [];
    for (let i = 0; i < 3; i += 1) samples.push(await freshCommands(browser, "/commands/creovixstudio"));
    report.commandsSamples = samples;
    report.commandsMedian = {
      ttfb: round(median(samples.map((sample) => sample.ttfb))),
      contentMs: round(median(samples.map((sample) => sample.contentMs))),
    };
    const fixture = await freshCommands(browser, "/commands/fixture-hundred");
    report.fixtureLoad = fixture;

    const page = await openPage(browser);
    const sessionId = page.sessionId;
    await browser.send("Page.navigate", { url: `${origin}/commands/fixture-hundred` }, sessionId);
    await delay(800);
    report.fixtureInteraction = await evalPage(
      browser,
      sessionId,
      `(() => {
        const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        const input = document.querySelector("input");
        proto.set.call(input, "fixture110");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const afterSearch = document.body.innerText.includes("!fixture110") && !document.body.innerText.includes("!fixture1 ");
        proto.set.call(input, "");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        const next = [...document.querySelectorAll("nav button")].find((el) => (el.getAttribute("aria-label") || "").includes("2") || el.textContent.trim() === "2");
        if (next) next.click();
        return { afterSearch, page2: document.body.innerText.includes("!fixture19") || document.body.innerText.includes("!fixture20"), cards: document.querySelectorAll("li").length };
      })()`,
    );
    await delay(100);
    report.fixturePage2 = await evalPage(browser, sessionId, `document.body.innerText.includes("!fixture19")`);

    await browser.send("Page.navigate", { url: `${origin}/commands/creovixstudio` }, sessionId);
    await delay(500);
    await browser.send("Page.navigate", { url: `${origin}/commands/fixture-hundred` }, sessionId);
    await delay(500);
    report.cacheLeak = await evalPage(
      browser,
      sessionId,
      `(() => ({ fixture: document.body.innerText.includes("FIXTURE"), discord: document.body.innerText.includes("!discord"), name: document.body.innerText.includes("fixture-hundred") || document.body.innerText.includes("FIXTURE hundred") }))()`,
    );

    await browser.send("Page.navigate", { url: `${origin}/custom-commands` }, sessionId);
    await delay(700);
    const clicks = [];
    for (let i = 0; i < 3; i += 1) {
      const posts = [];
      const stop = browser.subscribe((message) => {
        if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
        const name = fnName(message.params.response.url);
        if (name === "setDefaultCommandEnabled") {
          posts.push({ status: message.params.response.status, at: performance.now?.() });
        }
      });
      const startedPosts = posts.length;
      const clicked = await evalPage(
        browser,
        sessionId,
        `(() => {
          const control = document.querySelector("article [role=switch]");
          if (!control) return { ok: false };
          const before = control.getAttribute("aria-checked");
          const trigger = control.closest("article")?.innerText?.split("\\n")[0] ?? "";
          window.__toggleMark = performance.now();
          window.__uiAt = 0;
          control.click();
          const watch = () => {
            const now = document.querySelector("article [role=switch]")?.getAttribute("aria-checked");
            if (now && now !== before && !window.__uiAt) window.__uiAt = performance.now();
          };
          watch();
          requestAnimationFrame(watch);
          return { ok: true, before, trigger };
        })()`,
      );
      let uiMs = null;
      let serverMs = null;
      const waitStart = Date.now();
      while (Date.now() - waitStart < 4000) {
        const probe = await evalPage(
          browser,
          sessionId,
          `(() => ({ ui: window.__uiAt ? window.__uiAt - window.__toggleMark : null, checked: document.querySelector("article [role=switch]")?.getAttribute("aria-checked") }))()`,
        );
        if (probe?.ui != null) uiMs = probe.ui;
        if (posts.length > startedPosts && serverMs == null) serverMs = Date.now() - waitStart;
        if (uiMs != null && posts.length > startedPosts) break;
        await delay(20);
      }
      await delay(150);
      stop();
      clicks.push({ ...clicked, uiMs: round(uiMs), serverMs: round(serverMs), postCount: posts.length - startedPosts, postStatus: posts.at(-1)?.status ?? null });
    }
    report.toggleClicks = clicks;
    report.toggleMedian = {
      uiMs: round(median(clicks.map((click) => click.uiMs))),
      serverMs: round(median(clicks.map((click) => click.serverMs))),
    };
    const beforeReload = await evalPage(browser, sessionId, `document.querySelector("article [role=switch]")?.getAttribute("aria-checked")`);
    await browser.send("Page.reload", { ignoreCache: true }, sessionId);
    await delay(900);
    const afterReload = await evalPage(
      browser,
      sessionId,
      `(() => ({ checked: document.querySelector("article [role=switch]")?.getAttribute("aria-checked"), trigger: document.querySelector("article h3")?.textContent }))()`,
    );
    report.toggleReload = { beforeReload, afterReload };

    const failure = await evalPage(
      browser,
      sessionId,
      `(() => {
        const control = document.querySelectorAll("article [role=switch]")[1];
        if (!control) return { ok: false };
        const before = control.getAttribute("aria-checked");
        const original = window.fetch;
        window.fetch = async (input, init) => {
          const url = String(input?.url || input);
          if (url.includes("/_serverFn/")) {
            try {
              const id = url.split("/_serverFn/")[1] || "";
              const json = JSON.parse(atob(id.replace(/-/g, "+").replace(/_/g, "/")));
              if (String(json.export || "").includes("setDefaultCommandEnabled")) {
                return new Response(JSON.stringify({ ok: false, error: "forced_failure" }), { status: 200, headers: { "content-type": "application/json" } });
              }
            } catch {}
          }
          return original(input, init);
        };
        window.__failMark = performance.now();
        control.click();
        return { ok: true, before };
      })()`,
    );
    await delay(400);
    report.toggleFailure = await evalPage(
      browser,
      sessionId,
      `(() => {
        const control = document.querySelectorAll("article [role=switch]")[1];
        const text = document.body.innerText;
        return { checked: control?.getAttribute("aria-checked"), successToast: text.includes("تم الحفظ") || text.includes("Saved"), errorVisible: text.includes("forced_failure") || text.includes("Could not") || text.includes("تعذ") };
      })()`,
    );
    report.toggleFailure.before = failure?.before;

    await evalPage(browser, sessionId, `window.fetch = window.fetch`);
    await browser.send("Page.reload", { ignoreCache: true }, sessionId);
    await delay(800);
    const posts = [];
    const stop = browser.subscribe((message) => {
      if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
      if (fnName(message.params.response.url) === "setDefaultCommandEnabled") posts.push(message.params.response.status);
    });
    await evalPage(
      browser,
      sessionId,
      `(() => { const control = document.querySelector("article [role=switch]"); control?.click(); control?.click(); return true; })()`,
    );
    await delay(500);
    stop();
    report.doubleClickPosts = posts.length;

    await browser.send("Page.navigate", { url: `${origin}/dashboard` }, sessionId);
    let seal = 0;
    const stopSeal = browser.subscribe((message) => {
      if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
      if (fnName(message.params.response.url) === "resolveSbcCertificateUrl") seal += 1;
    });
    const sealStart = Date.now();
    let firstHref = false;
    while (Date.now() - sealStart < 5000) {
      const probe = await evalPage(browser, sessionId, `(() => { const link = document.querySelector("#sbc-custom-button"); return Boolean(link && !link.hidden && link.getAttribute("href")); })()`);
      if (probe) {
        firstHref = true;
        break;
      }
      await delay(40);
    }
    const firstSeal = { requests: seal, waitedMs: Date.now() - sealStart, link: firstHref };
    await browser.send("Page.navigate", { url: `${origin}/settings` }, sessionId);
    await delay(300);
    const beforeSecond = seal;
    const secondStart = Date.now();
    await browser.send("Page.navigate", { url: `${origin}/dashboard` }, sessionId);
    let secondLink = false;
    while (Date.now() - secondStart < 4000) {
      const probe = await evalPage(browser, sessionId, `(() => { const link = document.querySelector("#sbc-custom-button"); return Boolean(link && !link.hidden && link.getAttribute("href")); })()`);
      if (probe) {
        secondLink = true;
        break;
      }
      await delay(30);
    }
    const keys = await evalPage(browser, sessionId, `Object.keys(sessionStorage).filter((key) => key.includes("sbc-certificate"))`);
    stopSeal();
    report.seal = { firstSeal, second: { requests: seal - beforeSecond, waitedMs: Date.now() - secondStart, link: secondLink }, keys };
    await browser.send("Target.closeTarget", { targetId: page.targetId });
  } finally {
    browser.ws.close();
    child.kill();
  }
  writeFileSync(new URL("./validate.json", import.meta.url), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ commandsMedian: report.commandsMedian, toggleMedian: report.toggleMedian, toggleReload: report.toggleReload, toggleFailure: report.toggleFailure, doubleClickPosts: report.doubleClickPosts, html: report.html, seal: report.seal, fixture: report.fixtureLoad, fixtureInteraction: report.fixtureInteraction, fixturePage2: report.fixturePage2, cacheLeak: report.cacheLeak }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
