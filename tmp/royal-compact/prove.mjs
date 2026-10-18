import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve("tmp/royal-compact");
const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 980 });
await page.evaluateOnNewDocument(() => localStorage.setItem("creovix.lang", "en"));
await page.goto("http://localhost:3001/widgets/04785800-c320-4540-86b2-b3f04ffa8808", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(() => document.body.innerText.includes("Demo chat tester"), { timeout: 20000 });

async function clickText(text) {
  await page.evaluate((text) => {
    const node = [...document.querySelectorAll("button")].find((item) => item.textContent?.includes(text));
    node?.click();
  }, text);
}

await clickText("Layout");
await page.waitForSelector("[data-theme-id='royal-compact']");
await page.evaluate(() => document.querySelector("[data-theme-id='royal-compact']")?.click());
await new Promise((resolve) => setTimeout(resolve, 300));

async function toggle(label) {
  return page.evaluate((label) => {
    const row = [...document.querySelectorAll("div")].find(
      (node) => node.querySelector("span")?.textContent?.trim() === label && node.querySelector("[role='switch']"),
    );
    const button = row?.querySelector("[role='switch']");
    const before = button?.getAttribute("aria-checked");
    button?.click();
    return before;
  }, label);
}

async function preview() {
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll("[data-chat-theme]")];
    return {
      themes: [...new Set(rows.map((row) => row.getAttribute("data-chat-theme")))],
      royal: document.querySelectorAll("[data-chat-theme='royal-compact']").length,
      arcs: document.querySelectorAll("[data-royal-arc]").length,
      fills: document.querySelectorAll("[data-royal-fill]").length,
      bubbleArcs: document.querySelectorAll("[data-chat-arc]").length,
      bubbleFills: document.querySelectorAll("[data-chat-fill]").length,
      avatars: document.querySelectorAll("[data-royal-avatar]").length,
      badges: document.querySelectorAll("[data-chat-theme='royal-compact'] img").length,
      selected: document.querySelector("[data-theme-id='royal-compact']")?.getAttribute("aria-pressed"),
    };
  });
}

const shown = await preview();
const avatarBefore = await toggle("Show account photo");
await new Promise((resolve) => setTimeout(resolve, 250));
const avatarOff = await preview();
await toggle("Show account photo");
const badgeBefore = await toggle("Show account badges");
await new Promise((resolve) => setTimeout(resolve, 250));
const badgesOff = await preview();
await toggle("Show account badges");
await new Promise((resolve) => setTimeout(resolve, 200));

await clickText("Save");
await page.waitForFunction(() => ![...document.querySelectorAll("button")].some((node) => node.textContent?.includes("Saving")), {
  timeout: 15000,
});
await new Promise((resolve) => setTimeout(resolve, 500));

const saved = await page.evaluate(async () => {
  const response = await fetch("/api/demo/state");
  const body = await response.json();
  const widget = (body.widgets ?? body.state?.widgets ?? []).find((item) => item.type === "CHAT_BOX" || item.public_token);
  const list = body.widgets ?? body.file?.widgets ?? body.state?.widgets ?? [];
  const chat = list.find((item) => String(item.public_token || "").startsWith("demo-") && (item.type === "CHAT_BOX" || item.config?.themeId));
  return { keys: Object.keys(body), chat: chat ? { type: chat.type, token: chat.public_token, config: chat.config } : list[0] ?? null };
});

await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.body.innerText.includes("Demo chat tester"), { timeout: 20000 });
await clickText("Layout");
await new Promise((resolve) => setTimeout(resolve, 400));
const afterRefresh = await preview();

await clickText("Speech Bubbles");
await new Promise((resolve) => setTimeout(resolve, 400));
const bubble = await page.evaluate(() => {
  const row = document.querySelector("[data-chat-theme='bubble']");
  const arc = row?.querySelector("[data-chat-arc]");
  const fill = row?.querySelector("[data-chat-fill]");
  return {
    theme: row?.getAttribute("data-chat-theme") ?? null,
    arc: Boolean(arc),
    fill: Boolean(fill),
    royalArc: document.querySelectorAll("[data-royal-arc]").length,
    path: arc?.getAttribute("d") ?? arc?.querySelector("path")?.getAttribute("d") ?? null,
  };
});
const bubbleRow = await page.$("[data-chat-theme='bubble']");
if (bubbleRow) await bubbleRow.screenshot({ path: path.join(outDir, "bubble-check.png") });

await page.evaluate(() => document.querySelector("[data-theme-id='royal-compact']")?.click());
await new Promise((resolve) => setTimeout(resolve, 300));
const back = await preview();

const token = saved.chat?.token ?? saved.chat?.config?.public_token;
const overlayUrl = token ? `http://localhost:3001/overlay/${token}` : null;
let overlay = null;
if (overlayUrl) {
  const overlayPage = await browser.newPage();
  await overlayPage.setViewport({ width: 1280, height: 720 });
  await overlayPage.goto(overlayUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise((resolve) => setTimeout(resolve, 1200));
  overlay = await overlayPage.evaluate(() => ({
    themes: [...document.querySelectorAll("[data-chat-theme]")].map((row) => row.getAttribute("data-chat-theme")),
    arcs: document.querySelectorAll("[data-royal-arc]").length,
    fills: document.querySelectorAll("[data-royal-fill]").length,
    bubble: document.querySelectorAll("[data-chat-theme='bubble']").length,
  }));
  await overlayPage.screenshot({ path: path.join(outDir, "overlay.png") });
  await overlayPage.close();
}

const report = { shown, avatarBefore, avatarOff, badgeBefore, badgesOff, saved, afterRefresh, bubble, back, overlayUrl, overlay };
fs.writeFileSync(path.join(outDir, "proof.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
