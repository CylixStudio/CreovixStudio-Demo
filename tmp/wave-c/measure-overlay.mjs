// Same-process overlay timings via Chrome DevTools. Not an OBS test.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const ROOT = "E:/Store/Cylix/CylixStudio-Demo";
const OUT = path.join(ROOT, "tmp/wave-c");
const STATE = path.join(ROOT, ".demo-data/state.json");
const BACKUP = path.join(OUT, "state.before.json");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9333;
const TOKEN = "demo-dff48feb-fec6-408c-8134-d1c6999cd662";
const OVERLAY = `http://127.0.0.1:3001/overlay/${TOKEN}`;

fs.mkdirSync(OUT, { recursive: true });
fs.copyFileSync(STATE, BACKUP);

const profile = path.join(process.env.TEMP || "C:/Windows/Temp", "cylix-wave-c-chrome");
fs.rmSync(profile, { recursive: true, force: true });
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitJson(url) {
  for (let i = 0; i < 50; i += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return await response.json();
    } catch {
      /* chrome still starting */
    }
    await sleep(200);
  }
  throw new Error(`no response from ${url}`);
}

const hook = `
window.__waveC = { requests: [] };
const orig = window.fetch.bind(window);
window.fetch = async (...args) => {
  const input = args[0];
  const url = typeof input === "string" ? input : input instanceof Request ? input.url : String(input);
  const started = performance.now();
  window.__waveC.requests.push({ url, started, method: args[1]?.method || "GET" });
  const response = await orig(...args);
  const row = window.__waveC.requests[window.__waveC.requests.length - 1];
  row.done = performance.now();
  row.status = response.status;
  return response;
};
`;

let ws;
try {
  const version = await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("cdp socket failed")));
  });

  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  });
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });

  const created = await send("Target.createTarget", { url: "about:blank" });
  const attached = await send("Target.attachToTarget", { targetId: created.targetId, flatten: true });
  const sessionId = attached.sessionId;

  const evaluate = async (expression) => {
    const result = await send(
      "Runtime.evaluate",
      { expression, awaitPromise: true, returnByValue: true },
      sessionId,
    );
    if (result.exceptionDetails) {
      const text = result.exceptionDetails.exception?.description || result.exceptionDetails.text || "evaluate failed";
      throw new Error(text);
    }
    return result.result?.value;
  };

  await send("Page.enable", {}, sessionId);
  await send("Page.addScriptToEvaluateOnNewDocument", { source: hook }, sessionId);
  const navStart = Date.now();
  await send("Page.navigate", { url: OVERLAY }, sessionId);
  const ready = await evaluate(`(async () => {
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
      const text = document.body ? document.body.innerText : "";
      if (text.includes("Waiting for chat") || text.includes("Connecting") || document.querySelector("[data-chat-id]")) return performance.now();
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  })()`);
  await sleep(2000);
  const boot = await evaluate(`(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const demo = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state"));
    return {
      readyMs: ${ready === null ? "null" : Number(ready).toFixed(1)},
      nav: nav ? {
        ttfb: nav.responseStart,
        dcl: nav.domContentLoadedEventEnd,
        load: nav.loadEventEnd,
        transfer: nav.responseEnd - nav.responseStart,
      } : null,
      href: location.href,
      demoRequests: demo.length,
      demoWindowMs: demo.length ? Math.round(demo[demo.length - 1].started - demo[0].started) : 0,
      perSecond: demo.length && demo[demo.length - 1].started > demo[0].started
        ? Math.round((demo.length / ((demo[demo.length - 1].started - demo[0].started) / 1000)) * 10) / 10
        : demo.length,
    };
  })()`);
  fs.writeFileSync(path.join(OUT, "overlay-before-boot.json"), JSON.stringify(boot, null, 2));
  console.log("BOOT", JSON.stringify(boot));

  const one = await evaluate(`(async () => {
    const token = ${JSON.stringify(TOKEN)};
    async function publish(text, extra) {
      const mark = "m" + Math.random().toString(36).slice(2, 10);
      const full = text + " " + mark;
      const t0 = performance.now();
      const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
      const row = {
        id: mark,
        platform: "KICK",
        author: extra.author || "Wave",
        color: "#7dd3fc",
        badges: extra.badges || [],
        badgeList: extra.badgeList || [],
        text: full,
        at: Date.now(),
      };
      const prev = Array.isArray(state.messages[token]) ? state.messages[token] : [];
      state.messages[token] = [row, ...prev].slice(0, 40);
      const put0 = performance.now();
      const saved = await fetch("/api/demo/state", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(state),
      });
      const put1 = performance.now();
      let seen = null;
      const deadline = performance.now() + 6000;
      while (performance.now() < deadline) {
        if (document.body.innerText.includes(mark)) {
          seen = performance.now();
          break;
        }
        await new Promise((r) => setTimeout(r, 16));
      }
      const node = document.querySelector("[data-chat-id]");
      return {
        ok: saved.ok,
        visible: seen != null,
        putMs: Math.round((put1 - put0) * 10) / 10,
        afterPutMs: seen == null ? null : Math.round((seen - put1) * 10) / 10,
        totalMs: seen == null ? null : Math.round((seen - t0) * 10) / 10,
        firstId: node ? node.getAttribute("data-chat-id") : null,
        expectedFirst: mark,
        ordered: node ? node.getAttribute("data-chat-id") === mark : false,
      };
    }
    const singles = [];
    for (let i = 0; i < 8; i += 1) singles.push(await publish("one", {}));
    const ten = await (async () => {
      const token = ${JSON.stringify(TOKEN)};
      const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
      const marks = [];
      const t0 = performance.now();
      const prev = Array.isArray(state.messages[token]) ? state.messages[token] : [];
      const added = [];
      for (let i = 0; i < 10; i += 1) {
        const id = "t" + i + Math.random().toString(36).slice(2, 6);
        marks.push(id);
        added.push({ id, platform: "KICK", author: "Wave", color: null, badges: [], text: "ten " + id, at: Date.now() + (10 - i) });
      }
      state.messages[token] = [...added, ...prev].slice(0, 40);
      await fetch("/api/demo/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
      const put1 = performance.now();
      const deadline = performance.now() + 6000;
      let seen = null;
      while (performance.now() < deadline) {
        const text = document.body.innerText;
        const shown = marks.filter((id) => text.includes(id)).length;
        if (shown >= 8) { seen = performance.now(); break; }
        await new Promise((r) => setTimeout(r, 16));
      }
      const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
      const text = document.body.innerText;
      const shown = marks.filter((id) => text.includes(id)).length;
      return { visible: shown >= 8, shown, afterPutMs: seen == null && shown < 8 ? null : Math.round(((seen || performance.now()) - put1) * 10) / 10, count: ids.length, newestFirst: ids[0] === marks[0] };
    })();
    const burst = await (async () => {
      const token = ${JSON.stringify(TOKEN)};
      const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
      const t0 = performance.now();
      const added = [];
      for (let i = 0; i < 50; i += 1) {
        added.push({ id: "b" + String(i).padStart(2, "0"), platform: "TEST", author: "Burst", color: "#fff", badges: ["vip"], badgeList: [{ type: "vip", text: "VIP", count: 1 }], text: "burst " + i, at: 1_700_000_000_000 + (50 - i) });
      }
      state.messages[token] = added;
      await fetch("/api/demo/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
      const put1 = performance.now();
      let seen = null;
      const deadline = performance.now() + 6000;
      while (performance.now() < deadline) {
        const text = document.body.innerText;
        if (text.includes("burst 0") && text.includes("burst 7")) {
          seen = performance.now();
          break;
        }
        await new Promise((r) => setTimeout(r, 16));
      }
      const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
      const longTasks = performance.getEntriesByType("longtask").map((entry) => Math.round(entry.duration));
      return {
        visible: seen != null,
        afterPutMs: seen == null ? null : Math.round((seen - put1) * 10) / 10,
        rendered: ids.length,
        first: ids[0] || null,
        last: ids[ids.length - 1] || null,
        longTasks,
        wallMs: Math.round((performance.now() - t0) * 10) / 10,
      };
    })();
    const arabic = await publish("هذا سطر عربي طويل جداً للتحقق من ظهور الرسالة داخل الأوفرلاي بدون قص الاتجاه", {});
    const mixed = await publish("hello مرحبا world يسار يمين", { author: "Mixed" });
    const badges = await publish("badge line", { badges: ["moderator", "subscriber"], badgeList: [{ type: "moderator", text: "MOD", count: null }, { type: "subscriber", text: "SUB", count: 12 }] });
    return { singles, ten, burst, arabic, mixed, badges };
  })()`);

  const idleBefore = await evaluate(`window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state")).length`);
  await sleep(3000);
  const idle = await evaluate(`(() => {
    const rows = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state"));
    const recent = rows.filter((row) => performance.now() - row.started < 3000);
    return { total: rows.length, recent: recent.length, gets: recent.filter((row) => row.method === "GET").length };
  })()`);

  let reopen = null;
  try {
    await send("Page.reload", { ignoreCache: true }, sessionId);
  } catch (error) {
    console.log("reload-ack", error instanceof Error ? error.message : String(error));
  }
  for (let i = 0; i < 40; i += 1) {
    await sleep(150);
    try {
      const value = await evaluate(`(() => {
        const text = document.body ? document.body.innerText : "";
        if (!text.includes("burst 0") && !text.includes("Waiting for chat") && !text.includes("Connecting")) return null;
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          ms: Math.round(performance.now() * 10) / 10,
          load: nav ? Math.round(nav.loadEventEnd) : null,
          sawBurst: text.includes("burst 0"),
        };
      })()`);
      if (value) {
        reopen = value;
        break;
      }
    } catch {
      /* context restarts after reload */
    }
  }

  const report = {
    overlay: OVERLAY,
    browser: "Chrome headless, not OBS",
    navWallClockMs: Date.now() - navStart,
    boot,
    one,
    idleBefore,
    idle3s: idle,
    reopenMs: reopen,
  };
  fs.writeFileSync(path.join(OUT, "overlay-after.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  try {
    fs.copyFileSync(BACKUP, STATE);
  } catch (error) {
    console.error("restore failed", error);
  }
  if (ws) ws.close();
  chrome.kill();
}
