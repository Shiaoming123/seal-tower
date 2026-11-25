// Concept tips (新概念) must be on top and tappable over the 3D views: explore and combat, desktop and portrait,
// and come one per fight (TIP-PACE).
// UI-013: in combat the tip was in normal flow under the absolutely positioned canvas, so nobody could see it.
// Usage: node tests/tip-reach-check.mjs   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const root = new URL("..", import.meta.url).pathname;
const server = await createServer({ root, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const [name, vp] of [["desktop", { width: 1280, height: 720 }], ["portrait", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp });
  const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(base); await page.waitForFunction(() => window.__seal);
  const probe = async (where) => {
    await page.waitForSelector(".concept-tip", { timeout: 5000 });
    const r = await page.evaluate(() => {
      const b = document.querySelector(".concept-tip .btn"); const rc = b.getBoundingClientRect();
      const x = rc.x + rc.width / 2, y = rc.y + rc.height / 2;
      const hit = document.elementFromPoint(x, y);
      return { x: Math.round(x), y: Math.round(y), inView: x > 0 && y > 0 && x < innerWidth && y < innerHeight, ok: !!hit && b.contains(hit), hit: hit?.className, name: document.querySelector(".concept-tip b").textContent };
    });
    console.log(name, where, JSON.stringify(r)); if (!r.ok || !r.inView) bad++;
    await page.screenshot({ path: `.cache/${name}-${where}.png` });
  };
  await page.evaluate(async () => {
    const S = await import("/src/ui/store.ts"); ["move", "combat", "steal", "charge", "part"].forEach((t) => S.markTip(t));
    const R = await import("/src/game/run.ts"); const run = R.createRun(7, "sword", "lamp"); run.stats.steps = 5; __seal.runSig.value = run; __seal.page.value = "game"; // explore concepts wait for a few steps (TIP-PACE)
  });
  await page.waitForTimeout(800);
  for (let i = 0; i < 3 && !(await page.$(".concept-tip")); i++) { await page.keyboard.press("Enter"); await page.waitForTimeout(500); }
  await probe("explore");
  await page.evaluate(() => __seal.fight("fallen"));
  await page.waitForSelector(".combat", { timeout: 5000 }); await page.waitForTimeout(800);
  await probe("combat");
  await page.click(".concept-tip .btn"); await page.waitForTimeout(300);
  // One new concept per fight (TIP-PACE): the next one waits for the next fight.
  if (await page.$(".concept-tip")) { console.log(name, "a second concept tip showed in the same fight"); bad++; }
  await page.evaluate(() => { const run = __seal.runSig.value; run.combat = null; run.at = null; run.screen = "explore"; __seal.commit(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => __seal.fight("fallen"));
  await page.waitForSelector(".combat", { timeout: 5000 }); await page.waitForTimeout(800);
  await probe("combat-next");
  if (errs.length) { console.log("errors", errs); bad++; }
  await page.close();
}
await browser.close(); await server.close();
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
