import puppeteer from "puppeteer-core";

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
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Layout")?.click();
});
await page.waitForSelector("[data-theme-id='royal-compact']");
await page.evaluate(() => document.querySelector("[data-theme-id='royal-compact']")?.click());
await new Promise((resolve) => setTimeout(resolve, 500));
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("[data-chat-theme]")];
  return rows.map((row) => {
    const box = row.getBoundingClientRect();
    return {
      theme: row.getAttribute("data-chat-theme"),
      text: row.innerText.slice(0, 90),
      box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
    };
  });
});
console.log(JSON.stringify(info, null, 2));
const row = await page.$("[data-chat-theme='royal-compact']");
if (row) await row.screenshot({ path: "tmp/royal-compact/row.png" });
await page.screenshot({ path: "tmp/royal-compact/viewport.png", clip: { x: 720, y: 180, width: 700, height: 760 } });
await browser.close();
