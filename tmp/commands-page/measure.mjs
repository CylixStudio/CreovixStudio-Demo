import { spawn } from "node:child_process";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9334;
const profile = "C:\\Users\\igopf\\AppData\\Local\\Temp\\cylix-commands-measure";
const url = process.argv[2] || "http://127.0.0.1:3001/commands/creovixstudio";

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1650,927",
    "about:blank",
  ],
  { stdio: "ignore" },
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitJson() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) return res.json();
    } catch {
      // starting
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
      if (data.error) reject(new Error(JSON.stringify(data.error)));
      else resolve(data.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id: messageId, method, params }));
  });
}

const requests = [];

try {
  const version = await waitJson();
  const browser = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    browser.addEventListener("open", resolve, { once: true });
    browser.addEventListener("error", reject, { once: true });
  });
  const { targetId } = await send(browser, "Target.createTarget", { url: "about:blank" });
  const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  const pageUrl = list.find((item) => item.id === targetId).webSocketDebuggerUrl;
  browser.close();
  const page = new WebSocket(pageUrl);
  await new Promise((resolve, reject) => {
    page.addEventListener("open", resolve, { once: true });
    page.addEventListener("error", reject, { once: true });
  });
  page.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.method === "Network.requestWillBeSent") {
      requests.push(data.params.request.url);
    }
  });
  await send(page, "Network.enable");
  await send(page, "Page.enable");
  await send(page, "Emulation.setDeviceMetricsOverride", {
    width: 1650,
    height: 927,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send(page, "Page.navigate", { url });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await sleep(300);
    const ready = await send(page, "Runtime.evaluate", {
      returnByValue: true,
      expression: `document.body.innerText.includes("أمر متاح")`,
    });
    if (ready.result?.value) break;
  }
  await sleep(400);
  const timing = await send(page, "Runtime.evaluate", {
    returnByValue: true,
    awaitPromise: true,
    expression: `(async () => {
      const nav = performance.getEntriesByType("navigation")[0];
      const resources = performance.getEntriesByType("resource").map((entry) => ({
        name: entry.name.slice(0, 180),
        type: entry.initiatorType,
        dur: Math.round(entry.duration),
        size: entry.transferSize || 0,
      }));
      const cls = performance.getEntriesByType("layout-shift").reduce((sum, entry) => sum + (entry.hadRecentInput ? 0 : entry.value), 0);
      const click = async (label) => {
        const start = performance.now();
        [...document.querySelectorAll("button")].find((button) => button.textContent.includes(label))?.click();
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return Math.round((performance.now() - start) * 100) / 100;
      };
      const timers = await click("الرسائل المؤقتة");
      const defaults = await click("الأوامر الافتراضية");
      const custom = await click("الأوامر المخصصة");
      const input = document.querySelector("input");
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      const filterStart = performance.now();
      setter.call(input, "discord");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const searchMs = Math.round((performance.now() - filterStart) * 100) / 100;
      const searchHits = document.querySelectorAll("article").length;
      setter.call(input, "");
      input.dispatchEvent(new Event("input", { bubbles: true }));
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const pageStart = performance.now();
      [...document.querySelectorAll("button")].find((button) => button.textContent.trim() === "2")?.click();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const pageMs = Math.round((performance.now() - pageStart) * 100) / 100;
      const cols = getComputedStyle(document.querySelector("ul")).gridTemplateColumns;
      return {
        dcl: Math.round(nav.domContentLoadedEventEnd),
        load: Math.round(nav.loadEventEnd),
        response: Math.round(nav.responseEnd),
        ttfb: Math.round(nav.responseStart),
        cls: Math.round(cls * 1000) / 1000,
        timers,
        defaults,
        custom,
        searchMs,
        searchHits,
        pageMs,
        articles: document.querySelectorAll("article").length,
        columns: (cols.match(/px/g) || []).length,
        avatar: document.querySelector("img")?.src.slice(0, 48) || "fallback",
        count: (document.body.innerText.match(/\\d+ أمر متاح/) || [""])[0],
        resources,
      };
    })()`,
  });
  const value = timing.result.value;
  const supabase = requests.filter((item) => /supabase\\.co/i.test(item));
  const serverFns = requests.filter((item) => item.includes("_server") || item.includes("serverFn") || item.includes("/_server"));
  console.log(JSON.stringify({
    supabase: supabase.length,
    serverFnUrls: serverFns,
    requestCount: requests.length,
    hosts: [...new Set(requests.map((item) => {
      try { return new URL(item).host; } catch { return item.slice(0, 40); }
    }))],
    dcl: value.dcl,
    load: value.load,
    response: value.response,
    ttfb: value.ttfb,
    cls: value.cls,
    timers: value.timers,
    defaults: value.defaults,
    custom: value.custom,
    searchMs: value.searchMs,
    searchHits: value.searchHits,
    pageMs: value.pageMs,
    articles: value.articles,
    columns: value.columns,
    avatar: value.avatar,
    count: value.count,
    js: value.resources.filter((entry) => entry.type === "script" || entry.name.includes(".js") || entry.name.includes("commands")),
  }, null, 2));
  page.close();
} finally {
  chrome.kill();
}
