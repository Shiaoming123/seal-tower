// Tapping a pile item offers 装进行囊 and, for consumables, using it on the spot (REVIEW-003).
// Usage: node tests/pile-act-check.mjs   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const [name, vp] of [["desktop", { width: 1280, height: 720 }], ["portrait", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(server.resolvedUrls.local[0]); await page.waitForFunction(() => window.__seal);
  await page.evaluate(async () => {
    const S = await import("/src/ui/store.ts"); const { TERMS } = await import("/src/data/glossary.ts"); Object.keys(TERMS).forEach((t) => S.markTip(`term:${t}`)); S.markTip("move");
    const R = await import("/src/game/run.ts"); const run = R.createRun(9, "sword", "lamp");
    run.pending.push("silk", "pill"); __seal.runSig.value = run; __seal.page.value = "game";
    await new Promise((r) => setTimeout(r, 300)); __seal.overlay.value = "bag";
  });
  await page.waitForTimeout(700);
  const items = page.locator(".pending-item");
  await items.nth(0).scrollIntoViewIfNeeded(); await items.nth(0).click(); await page.waitForTimeout(200);
  const bar1 = await page.locator(".pile-act").count();
  await page.locator(".pile-act .btn.primary").click(); await page.waitForTimeout(300);
  const left1 = await page.evaluate(() => __seal.runSig.value.pending.join(","));
  await page.locator(".pending-item").nth(0).click(); await page.waitForTimeout(200);
  const hp0 = await page.evaluate(() => __seal.runSig.value.maxHp);
  const useBtn = page.locator(".pile-act .btn:not(.primary)");
  const hasUse = await useBtn.count();
  if (hasUse) { await useBtn.click(); await page.waitForTimeout(300); }
  const after = await page.evaluate(() => ({ pending: __seal.runSig.value.pending.length, maxHp: __seal.runSig.value.maxHp }));
  const ok = bar1 === 1 && left1 === "pill" && hasUse === 1 && after.pending === 0 && after.maxHp === hp0 + 5;
  console.log(name, ok ? "ok" : "BAD", JSON.stringify({ bar1, left1, hasUse, hp0, after })); if (!ok) bad++;
  await page.screenshot({ path: `.cache/pile-${name}.png` });
  await page.close();
}
await browser.close(); await server.close();
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
