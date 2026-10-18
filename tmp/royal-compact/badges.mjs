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
await page.waitForFunction(() => document.body.innerText.includes("Layout"), { timeout: 20000 });
await page.evaluate(() => {
  [...document.querySelectorAll("button")].find((node) => node.textContent?.trim() === "Layout")?.click();
});
await new Promise((resolve) => setTimeout(resolve, 300));

await new Promise((resolve) => setTimeout(resolve, 400));
const result = await page.evaluate(async () => {
  const click = (label) => {
    const span = [...document.querySelectorAll("span")].find(
      (node) => node.children.length === 0 && node.textContent?.trim() === label,
    );
    const button = span?.parentElement?.parentElement?.querySelector("[role='switch']");
    const before = button?.getAttribute("aria-checked") ?? null;
    button?.click();
    return { before, found: Boolean(button) };
  };
  const count = () =>
    [...document.querySelectorAll("[data-chat-theme='royal-compact']")].slice(0, 4).map((row) => ({
      showAvatar: row.getAttribute("data-show-avatar"),
      showBadges: row.getAttribute("data-show-badges"),
      avatars: row.querySelectorAll("[data-royal-avatar]").length,
      badgeImgs: [...row.querySelectorAll("img")].filter((img) => !img.closest("[data-royal-avatar]")).length,
    }));
  const avatar = click("Show account photo");
  await new Promise((resolve) => setTimeout(resolve, 300));
  const avatarHidden = count();
  click("Show account photo");
  await new Promise((resolve) => setTimeout(resolve, 200));
  const badges = click("Show account badges");
  await new Promise((resolve) => setTimeout(resolve, 300));
  const badgesHidden = count();
  click("Show account badges");
  await new Promise((resolve) => setTimeout(resolve, 200));
  return { avatar, avatarHidden, badges, badgesHidden, restored: count() };
});
console.log(JSON.stringify(result, null, 2));
await browser.close();
