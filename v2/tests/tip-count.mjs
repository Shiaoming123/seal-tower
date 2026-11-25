// Count the 知道了 taps a brand-new player meets: first screen, walking 4 steps, two fights (UI-016).
// Usage: node tests/tip-count.mjs [v2 root]   (prints the count and the order; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const root = process.argv[2] ?? new URL("..", import.meta.url).pathname;
const server = await createServer({ root, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(server.resolvedUrls.local[0]); await page.waitForFunction(() => window.__seal);
await page.evaluate(() => localStorage.clear()); await page.reload(); await page.waitForFunction(() => window.__seal);
const log = [];
const drain = async (where) => {
  for (let i = 0; i < 12; i++) {
    const b = await page.$(".tip .btn, .concept-tip .btn, .omen-card .btn");
    if (!b) break;
    const label = await page.evaluate(() => (document.querySelector(".concept-tip b")?.textContent) || (document.querySelector(".omen-card") ? "签文卡" : document.querySelector(".tip p")?.textContent.slice(0, 8)));
    log.push(`${where}:${label}`); await b.click(); await page.waitForTimeout(250);
  }
};
await page.evaluate(async () => { const R = await import("/src/game/run.ts"); __seal.runSig.value = R.createRun(7, "sword", "lamp"); __seal.page.value = "game"; });
await page.waitForTimeout(800); await drain("开局");
for (let i = 0; i < 4; i++) { await page.evaluate(() => { const r = __seal.runSig.value; r.stats.steps++; __seal.commit(); }); }
await page.waitForTimeout(300); await drain("走4步");
for (const n of [1, 2]) {
  await page.evaluate(() => __seal.fight("moth")); await page.waitForTimeout(800); await drain(`第${n}场`);
  await page.evaluate(() => { const run = __seal.runSig.value; run.combat = null; run.at = null; run.screen = "explore"; __seal.commit(); });
  await page.waitForTimeout(500); await drain(`第${n}场后`);
}
console.log(log.length, "taps:", log.join(" | "));
await browser.close(); await server.close();
