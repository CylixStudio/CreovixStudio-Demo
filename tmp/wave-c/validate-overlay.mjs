// Chrome headless timings for the Demo chat overlay. Not an OBS test.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const ROOT = "E:/Store/Cylix/CylixStudio-Demo";
const STATE = path.join(ROOT, ".demo-data/state.json");
const OUT = path.join(ROOT, "tmp/wave-c");
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 9334;
const profile = path.join(os.tmpdir(), "cylix-wave-c-chrome");

fs.mkdirSync(OUT, { recursive: true });
const backup = fs.readFileSync(STATE, "utf8");
const initial = JSON.parse(backup);
const widget = (initial.widgets || []).find((item) => item.type === "CHAT_BOX" && String(item.public_token || "").startsWith("demo-"));
if (!widget) throw new Error("no demo chat widget");
const TOKEN = widget.public_token;
const OVERLAY = `http://127.0.0.1:3001/overlay/${TOKEN}`;

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
  const method = (args[1] && args[1].method) || "GET";
  const row = { url, method, started };
  window.__waveC.requests.push(row);
  try {
    const response = await orig(...args);
    row.done = performance.now();
    row.status = response.status;
    return response;
  } catch (error) {
    row.done = performance.now();
    row.status = 0;
    throw error;
  }
};
`;

fs.rmSync(profile, { recursive: true, force: true });
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--disable-extensions",
    "--enable-precise-memory-info",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { stdio: "ignore" },
);

function connectSocket(ws) {
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
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || JSON.stringify(result.exceptionDetails));
    }
    return result.result?.value;
  };
  return { send, evaluate };
}

async function openPage(url) {
  const created = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
  const page = await created.json();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", () => reject(new Error("cdp socket failed")));
  });
  const api = connectSocket(ws);
  await api.send("Page.enable");
  await api.send("Network.enable");
  await api.send("Performance.enable");
  await api.send("Page.addScriptToEvaluateOnNewDocument", { source: hook });
  await api.send("Page.navigate", { url });
  return { ws, ...api };
}

async function putMessages(rows) {
  const state = JSON.parse(fs.readFileSync(STATE, "utf8"));
  const prev = Array.isArray(state.messages?.[TOKEN]) ? state.messages[TOKEN] : [];
  state.messages = state.messages || {};
  state.messages[TOKEN] = [...rows, ...prev].slice(0, 40);
  const started = performance.now();
  const response = await fetch("http://127.0.0.1:3001/api/demo/state", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(state),
  });
  return { ok: response.ok, putMs: Math.round((performance.now() - started) * 10) / 10 };
}

async function waitForText(evaluate, mark, timeoutMs) {
  return evaluate(`(async () => {
    const mark = ${JSON.stringify(mark)};
    const started = performance.now();
    const deadline = started + ${timeoutMs};
    while (performance.now() < deadline) {
      if (document.body && document.body.innerText.includes(mark)) {
        return Math.round((performance.now() - started) * 10) / 10;
      }
      await new Promise((r) => setTimeout(r, 16));
    }
    return null;
  })()`);
}

let pages = [];
try {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const primary = await openPage(OVERLAY);
  pages.push(primary);
  const booted = await primary.evaluate(`(async () => {
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
      const rows = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state") && row.done);
      if (rows.length > 0 && document.body) return { requests: rows.length, text: document.body.innerText.slice(0, 80) };
      await new Promise((r) => setTimeout(r, 50));
    }
    return null;
  })()`);

  const one = await primary.evaluate(`(async () => {
    const samples = [];
    for (let i = 0; i < 8; i += 1) {
      const mark = "s" + i + Math.random().toString(36).slice(2, 8);
      const state = await (await fetch("/api/demo/state", { cache: "no-store" })).json();
      const row = { id: mark, platform: "KICK", author: "Wave", color: "#7dd3fc", badges: [], text: "one " + mark, at: Date.now() };
      const prev = Array.isArray(state.messages[${JSON.stringify(TOKEN)}]) ? state.messages[${JSON.stringify(TOKEN)}] : [];
      state.messages[${JSON.stringify(TOKEN)}] = [row, ...prev].slice(0, 40);
      const put0 = performance.now();
      const saved = await fetch("/api/demo/state", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(state) });
      const put1 = performance.now();
      let seen = null;
      const deadline = performance.now() + 8000;
      while (performance.now() < deadline) {
        if (document.body.innerText.includes(mark)) { seen = performance.now(); break; }
        await new Promise((r) => setTimeout(r, 16));
      }
      const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
      samples.push({
        ok: saved.ok,
        visible: seen != null,
        putMs: Math.round((put1 - put0) * 10) / 10,
        afterPutMs: seen == null ? null : Math.round((seen - put1) * 10) / 10,
        duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index).length,
        newestFirst: ids[0] === mark,
      });
    }
    return samples;
  })()`);

  const tenMarks = Array.from({ length: 10 }, (_, index) => `t${index}${Math.random().toString(36).slice(2, 6)}`);
  await putMessages(tenMarks.map((id, index) => ({
    id,
    platform: "KICK",
    author: "Wave",
    color: "#7dd3fc",
    badges: [],
    text: "ten " + id,
    at: Date.now() + (10 - index),
  })));
  const tenSeen = await waitForText(primary.evaluate, tenMarks[0], 8000);
  const ten = await primary.evaluate(`(() => {
    const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
    const marks = ${JSON.stringify(tenMarks)};
    return { rendered: ids.length, newest: ids[0], expectedNewest: marks[0], duplicates: ids.filter((id, index) => ids.indexOf(id) !== index).length, shownMarks: marks.filter((id) => ids.includes(id)).length };
  })()`);

  const burst = Array.from({ length: 50 }, (_, index) => ({
    id: `b${String(index).padStart(2, "0")}`,
    platform: "TEST",
    author: "Burst",
    color: "#fff",
    badges: [],
    text: `burst ${index}`,
    at: Date.now() + (50 - index),
  }));
  const burstPut = await putMessages(burst);
  const burstSeen = await waitForText(primary.evaluate, "burst 0", 8000);
  const burstView = await primary.evaluate(`(() => {
    const ids = [...document.querySelectorAll("[data-chat-id]")].map((node) => node.getAttribute("data-chat-id"));
    return { rendered: ids.length, first: ids[0] || null, last: ids[ids.length - 1] || null, duplicates: ids.filter((id, index) => ids.indexOf(id) !== index).length };
  })()`);

  const dupId = "dup" + Math.random().toString(36).slice(2, 8);
  await putMessages([
    { id: dupId, platform: "KICK", author: "Wave", color: "#fff", badges: [], text: "dup " + dupId, at: Date.now() },
    { id: dupId, platform: "KICK", author: "Wave", color: "#fff", badges: [], text: "dup " + dupId, at: Date.now() - 1 },
  ]);
  await waitForText(primary.evaluate, dupId, 8000);
  const duplicates = await primary.evaluate(`(() => {
    const id = ${JSON.stringify(dupId)};
    return [...document.querySelectorAll("[data-chat-id]")].filter((node) => node.getAttribute("data-chat-id") === id).length;
  })()`);

  const beforeOffline = await primary.evaluate(`window.__waveC.requests.length`);
  await primary.send("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
  });
  await sleep(1500);
  const duringOffline = await primary.evaluate(`(() => {
    const recent = window.__waveC.requests.filter((row) => performance.now() - row.started < 1600);
    return { count: recent.length, failed: recent.filter((row) => row.status === 0).length };
  })()`);
  await primary.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  const recoverMark = "back" + Math.random().toString(36).slice(2, 8);
  await sleep(400);
  await putMessages([{ id: recoverMark, platform: "KICK", author: "Wave", color: "#fff", badges: [], text: "back " + recoverMark, at: Date.now() }]);
  const recoverMs = await waitForText(primary.evaluate, recoverMark, 8000);

  const second = await openPage(OVERLAY);
  pages.push(second);
  await second.evaluate(`(async () => {
    const deadline = performance.now() + 15000;
    while (performance.now() < deadline) {
      const rows = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state") && row.done);
      if (rows.length > 0 && document.body) return true;
      await new Promise((r) => setTimeout(r, 50));
    }
    return false;
  })()`);
  const sharedMark = "both" + Math.random().toString(36).slice(2, 8);
  await putMessages([{ id: sharedMark, platform: "KICK", author: "Wave", color: "#fff", badges: [], text: "both " + sharedMark, at: Date.now() }]);
  const both = await Promise.all([
    waitForText(primary.evaluate, sharedMark, 8000),
    waitForText(second.evaluate, sharedMark, 8000),
  ]);

  const idleStart = await primary.evaluate(`window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state")).length`);
  const secondIdleStart = await second.evaluate(`window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state")).length`);
  await sleep(20000);
  const idle = await primary.evaluate(`(() => {
    const rows = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state") && performance.now() - row.started < 21000);
    return { count: rows.length, waits: rows.filter((row) => row.url.includes("wait=1")).length, gets: rows.filter((row) => row.method === "GET").length };
  })()`);
  const secondIdle = await second.evaluate(`(() => {
    const rows = window.__waveC.requests.filter((row) => row.url.includes("/api/demo/state") && performance.now() - row.started < 21000);
    return { count: rows.length, waits: rows.filter((row) => row.url.includes("wait=1")).length };
  })()`);

  const heapBefore = await primary.send("Performance.getMetrics");
  for (let i = 0; i < 8; i += 1) await primary.send("Page.reload", { ignoreCache: true });
  await sleep(1500);
  const heapAfter = await primary.send("Performance.getMetrics");
  const reopenMs = await waitForText(primary.evaluate, sharedMark, 15000);
  const nodes = await primary.evaluate(`document.querySelectorAll("[data-chat-id]").length`);

  const heap = (metrics, name) => metrics.metrics.find((item) => item.name === name)?.value ?? null;
  const report = {
    browser: "Chrome headless, not OBS",
    overlay: OVERLAY,
    booted,
    one,
    ten: { ...ten, afterPutMs: tenSeen, put: "node" },
    burst: { ...burstView, afterPutMs: burstSeen, putMs: burstPut.putMs },
    duplicateNodes: duplicates,
    offline: { beforeCount: beforeOffline, duringOffline, recoverMs },
    twoOverlaysMs: both,
    idle20s: { primary: idle, second: secondIdle, primaryStart: idleStart, secondStart: secondIdleStart },
    reopenMs,
    nodesAfterReopen: nodes,
    heap: {
      before: heap(heapBefore, "JSHeapUsedSize"),
      afterReloads: heap(heapAfter, "JSHeapUsedSize"),
    },
    thirtyMinuteIdle: "Not Measured",
  };
  fs.writeFileSync(path.join(OUT, "overlay-validate.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.writeFileSync(STATE, backup);
  for (const page of pages) {
    try { page.ws.close(); } catch { /* already closed */ }
  }
  chrome.kill();
}
