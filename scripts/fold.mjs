// Does each page's main card fit on the first screen? Prints how far it overflows.
// Usage: node scripts/fold.mjs
import { chromium } from "playwright-core";
const base = process.env.BASE_URL ?? "http://localhost:3005";
const checks = [
  { path: "/chog/1", sel: "main section" }, // profile header incl. Aura card
  { path: "/", sel: "main section" }, // hero
];
const sizes = [[1440, 900], [1366, 768], [1280, 720], [390, 844]];
const b = await chromium.launch({ channel: "chrome" });
for (const { path, sel } of checks) {
  for (const [w, h] of sizes) {
    const p = await (await b.newContext({ viewport: { width: w, height: h }, isMobile: w < 640 })).newPage();
    await p.goto(base + path, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    const bottom = await p.locator(sel).first().evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    console.log(`${path.padEnd(8)} ${w}x${h}  card bottom ${bottom}px  ${bottom <= h ? "FITS" : `overflows by ${bottom - h}px`}`);
    await p.close();
  }
}
await b.close();
