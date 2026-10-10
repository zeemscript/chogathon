// Screenshot pages at several viewport sizes with Playwright + system Chrome.
// Usage: node scripts/shot.mjs <path> [widths=390,768,1024,1440] [--full] [--out=dir]
// Prints any page errors and whether the page scrolls sideways.
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const path = args.find((a) => !a.startsWith("--") && !/^\d/.test(a)) ?? "/";
const widths = (args.find((a) => /^\d/.test(a)) ?? "390,768,1024,1440").split(",").map(Number);
const full = args.includes("--full");
const out = args.find((a) => a.startsWith("--out="))?.slice(6) ?? ".shots";
const base = process.env.BASE_URL ?? "http://localhost:3005";

await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
for (const width of widths) {
  const mobile = width < 640;
  const context = await browser.newContext({
    viewport: { width, height: mobile ? 844 : width < 1100 ? 1024 : 900 },
    deviceScaleFactor: 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + path, { waitUntil: "networkidle", timeout: 60_000 }).catch((e) => errors.push(e.message));
  await page.waitForTimeout(1200);
  const overflow = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > vw + 1 && getComputedStyle(el).position !== "fixed")
      .slice(0, 5)
      .map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")}`);
    return { scrollWidth: document.documentElement.scrollWidth, vw, wide };
  });
  const file = `${out}/${path.replace(/\W+/g, "_") || "home"}-${width}.png`;
  await page.screenshot({ path: file, fullPage: full });
  console.log(JSON.stringify({ file, ...overflow, errors: errors.slice(0, 3) }));
  await context.close();
}
await browser.close();
