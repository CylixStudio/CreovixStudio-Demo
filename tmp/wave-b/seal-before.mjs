import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9336;
const profile = `${process.env.TEMP}\\cylix-wave-b-seal-after`;
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

const child = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions", "--no-proxy-server", "--remote-allow-origins=*", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
let version;
for (let i = 0; i < 40; i += 1) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`);
    if (response.ok) {
      version = await response.json();
      break;
    }
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
let seal = 0;
browser.subscribe((message) => {
  if (message.sessionId !== sessionId || message.method !== "Network.responseReceived") return;
  const url = String(message.params.response.url);
  if (!url.includes("/_serverFn/")) return;
  try {
    const id = url.split("/_serverFn/")[1] ?? "";
    const json = JSON.parse(Buffer.from(id, "base64url").toString("utf8"));
    if (String(json.file).includes("sbcSeal")) seal += 1;
  } catch {
    /* ignore */
  }
});
async function goto(path) {
  const before = seal;
  const started = Date.now();
  await browser.send("Page.navigate", { url: `${origin}${path}` }, sessionId);
  let linkVisible = false;
  while (Date.now() - started < 5000) {
    const probe = await browser.send(
      "Runtime.evaluate",
      {
        expression: `(() => { const link = document.querySelector("#sbc-custom-button"); return Boolean(link && !link.hidden && link.getAttribute("href")); })()`,
        returnByValue: true,
      },
      sessionId,
    );
    linkVisible = Boolean(probe.result?.value);
    if (linkVisible) break;
    await delay(40);
  }
  return { added: seal - before, waitedMs: Date.now() - started, linkVisible };
}
const first = await goto("/dashboard");
const away = await goto("/settings");
const second = await goto("/dashboard");
const report = { first, settings: away, second, total: seal };
writeFileSync(new URL("./seal-after.json", import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
browser.ws.close();
child.kill();
