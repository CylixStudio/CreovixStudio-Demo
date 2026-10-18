import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const outDir = path.resolve("tmp/royal-compact");
fs.mkdirSync(outDir, { recursive: true });
const shot = process.argv[2] || "before";

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 980 });
await page.evaluateOnNewDocument(() => {
  window.localStorage.setItem("creovix.lang", "en");
});
await page.goto("http://localhost:3001/widgets/04785800-c320-4540-86b2-b3f04ffa8808", {
  waitUntil: "domcontentloaded",
  timeout: 60000,
});
await page.waitForFunction(() => document.body.innerText.includes("Demo chat tester"), { timeout: 20000 });
await page.evaluate(() => {
  const tab = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Layout");
  tab?.click();
});
await page.waitForFunction(() => document.body.innerText.includes("Royal Compact") || document.body.innerText.includes("royal"));
await page.evaluate(() => {
  const button = [...document.querySelectorAll("button")].find((node) => node.getAttribute("data-theme-id") === "royal-compact");
  button?.click();
});
await new Promise((resolve) => setTimeout(resolve, 300));
await page.evaluate(() => {
  const clear = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Clear demo messages");
  clear?.click();
});
await new Promise((resolve) => setTimeout(resolve, 400));

async function setField(labelText, value) {
  await page.evaluate(
    (labelText, value) => {
      const label = [...document.querySelectorAll("label")].find((node) => node.textContent?.toLowerCase().includes(labelText));
      const input = label?.querySelector("input");
      if (!input) return;
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
      setter?.call(input, value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    },
    labelText,
    value,
  );
}

async function setBadges(wanted) {
  await page.evaluate((wanted) => {
    const buttons = [...document.querySelectorAll("button")].filter((node) =>
      ["Broadcaster", "Moderator", "VIP", "Subscriber", "Sub gifter", "Verified", "Founder", "OG", "Staff"].includes(
        node.textContent?.trim() ?? "",
      ),
    );
    for (const button of buttons) {
      const on = button.getAttribute("aria-pressed") === "true";
      const need = wanted.includes(button.textContent?.trim());
      if (on !== need) button.click();
    }
  }, wanted);
}

async function send(author, color, text, avatarIndex, badges) {
  await setBadges(badges);
  await setField("username", author);
  await setField("user color", color);
  await setField("message", text);
  await page.evaluate((avatarIndex) => {
    const images = [...document.querySelectorAll("button img")].filter((img) =>
      ["Cyan", "Amber", "Violet"].includes(img.getAttribute("alt") || ""),
    );
    images[avatarIndex]?.parentElement?.click();
  }, avatarIndex);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Send line");
    button?.click();
  });
  await page.waitForFunction((text) => document.body.innerText.includes(text), { timeout: 8000 }, text.slice(0, 12));
}

await send("Al_Mubajjal", "#ffffff", "احح تصويت", 0, ["Subscriber", "Moderator"]);
await send("M1a_12", "#f5c16c", "اي", 1, ["VIP", "Subscriber"]);
await send("M1a_12", "#f5c16c", "شوف التصويت 🔥", 1, ["VIP", "Subscriber"]);
await send("Al_Mubajjal", "#ffffff", "التصويت فاتح", 0, ["Subscriber", "Moderator"]);

await new Promise((resolve) => setTimeout(resolve, 600));
const count = await page.evaluate(() => document.querySelectorAll("[data-chat-theme='royal-compact']").length);
if (!count) throw new Error("royal-compact preview missing");
const shots = [];
for (let index = 0; index < count; index += 1) {
  const file = path.join(outDir, `${shot}-row-${index}.png`);
  const row = (await page.$$("[data-chat-theme='royal-compact']"))[index];
  await row.screenshot({ path: file });
  shots.push(file);
}
const box = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("[data-chat-theme='royal-compact']")];
  return {
    count: rows.length,
    selected: document.querySelector("[data-theme-id='royal-compact']")?.getAttribute("aria-pressed"),
    theme: rows[0]?.getAttribute("data-chat-theme"),
    arc: document.querySelectorAll("[data-royal-arc]").length,
    fill: document.querySelectorAll("[data-royal-fill]").length,
    bubble: document.querySelectorAll("[data-chat-theme='bubble']").length,
    avatars: rows.filter((row) => row.querySelector("[data-royal-avatar] img")).length,
    letters: rows.filter((row) => row.querySelector("[data-royal-avatar]") && !row.querySelector("[data-royal-avatar] img")).length,
  };
});
console.log(JSON.stringify({ shot, box, shots }, null, 2));
await browser.close();
