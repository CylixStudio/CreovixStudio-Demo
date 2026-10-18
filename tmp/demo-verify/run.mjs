import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve("tmp/demo-verify");
fs.mkdirSync(outDir, { recursive: true });

const blocked = [];
const hosts = new Set();
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
await page.evaluateOnNewDocument(() => {
  window.localStorage.setItem("creovix.lang", "en");
});
page.on("requestfailed", (request) => {
  console.log("FAILED", request.url(), request.failure()?.errorText);
});
page.on("pageerror", (error) => console.log("PAGEERROR", error.message));
page.on("request", (request) => {
  try {
    const url = new URL(request.url());
    hosts.add(url.host);
    if (url.host.includes("ymvgxarznjqotnaaiida") || url.host.endsWith("supabase.co")) {
      blocked.push(request.url());
    }
  } catch {
    /* ignore */
  }
});

const notes = [];
await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForFunction(() => location.pathname.startsWith("/dashboard"), { timeout: 20000 });
await page.waitForFunction(() => document.body.innerText.includes("DemoUser"), { timeout: 20000 });
const dashText = await page.evaluate(() => document.body.innerText);
if (/sign in with twitch|checking your session/i.test(dashText)) notes.push("dashboard still looks like login");
if (!dashText.includes("DemoUser")) notes.push("DemoUser missing");
if (!/Pro\s*·\s*Demo/.test(dashText)) notes.push("Pro · Demo missing");
await page.screenshot({ path: path.join(outDir, "dashboard.png") });

const opened = await page.evaluate(() => {
  const name = [...document.querySelectorAll("p")].find((node) => node.textContent?.trim() === "Chat");
  let scope = name?.parentElement ?? null;
  let button = null;
  while (scope) {
    const names = [...scope.querySelectorAll("p")].filter((node) => node.textContent?.trim() === "Chat");
    const opens = [...scope.querySelectorAll("button")].filter((node) => /Open|Customize/.test(node.textContent ?? ""));
    if (names.length === 1 && opens.length === 1) {
      button = opens[0];
      break;
    }
    scope = scope.parentElement;
  }
  if (!button) return false;
  button.click();
  return true;
});
if (!opened) {
  const sample = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  await page.screenshot({ path: path.join(outDir, "dashboard-click-failed.png") });
  notes.push(`could not click Chat: ${sample}`);
  throw new Error(notes.join("\n"));
}
await page.waitForFunction(() => location.pathname.includes("/widgets/"), { timeout: 20000 });
await page.waitForFunction(() => document.body.innerText.includes("Demo chat tester"), { timeout: 20000 });
if (/upgrade required|unlock pro/i.test(await page.evaluate(() => document.body.innerText))) {
  notes.push("pro lock visible");
}

await page.evaluate(() => {
  const tab = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Layout");
  tab?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Speech Bubbles"));
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Speech Bubbles"));
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 400));
const bubbleImmediate = await page.evaluate(() => document.querySelector("[data-chat-theme='bubble']") != null);
if (!bubbleImmediate) notes.push("speech bubbles did not switch the preview immediately");
await page.screenshot({ path: path.join(outDir, "chat-speech-bubbles.png") });

await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.getAttribute("data-theme-id") === "royal-compact");
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 400));
const royal = await page.evaluate(() => ({
  royal: document.querySelector("[data-chat-theme='royal-compact']") != null,
  bubble: document.querySelector("[data-chat-theme='bubble']") != null,
}));
if (!royal.royal || royal.bubble) notes.push(`royal compact preview unexpected ${JSON.stringify(royal)}`);

await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Speech Bubbles"));
  button?.click();
});
await page.evaluate(() => {
  const label = [...document.querySelectorAll("label")].find((node) => node.textContent?.includes("Name"));
  const input = label?.querySelector("input");
  if (!input) return;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, "Demo Chat Box");
  input.dispatchEvent(new Event("input", { bubbles: true }));
});
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "English message");
  button?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Hello chat, this is a local demo message."), { timeout: 10000 });
const rendered = await page.evaluate(() => document.querySelector("[data-chat-theme='bubble']")?.textContent ?? "");
if (!rendered.includes("Hello chat")) notes.push("english message missing from bubble renderer");

await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Save");
  button?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Widget saved"), { timeout: 10000 });
const editorUrl = page.url();
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Demo chat tester"), { timeout: 20000 });
const restoredName = await page.evaluate(() => {
  const title = document.querySelector("h1, h2");
  return document.body.innerText.includes("Demo Chat Box");
});
if (!restoredName) notes.push("saved name did not restore");
await page.evaluate(() => {
  const tab = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Layout");
  tab?.click();
});
await new Promise((resolve) => setTimeout(resolve, 300));
const bubblePressed = await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.includes("Speech Bubbles"));
  return button?.getAttribute("aria-pressed") === "true";
});
if (!bubblePressed) notes.push("speech bubbles not restored as selected");

const overlayPath = await page.evaluate(async () => {
  const state = await fetch("/api/demo/state").then((response) => response.json());
  const chat = (state.widgets ?? []).find((widget) => widget.type === "CHAT_BOX");
  return chat ? `/overlay/${chat.public_token}` : "";
});
if (!overlayPath.includes("/overlay/demo-")) notes.push(`overlay path missing: ${overlayPath}`);
const overlayUrl = new URL(overlayPath.trim(), "http://localhost:3001").href;
await page.goto(overlayUrl, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Hello chat, this is a local demo message."), { timeout: 15000 });
const overlayBubble = await page.evaluate(() => document.querySelector("[data-chat-theme='bubble']") != null);
if (!overlayBubble) notes.push("overlay did not render the bubble branch");
await page.screenshot({ path: path.join(outDir, "overlay.png") });

const report = {
  editorUrl,
  overlayUrl,
  blocked,
  hosts: [...hosts].sort(),
  notes,
};
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (notes.length || blocked.length) process.exit(1);
