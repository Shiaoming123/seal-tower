// The reward screen's leave button must be reachable however much a final guardian reward lists: loot row, long
// notes, a relic pick of three, a card offer and a full pile. Desktop must show it without scrolling; portrait scrolls.
// Found by the contest session's studio check (the button sat at y=938 on a 720-high desktop).
// Usage: node tests/reward-fit-check.mjs   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const [name, vp] of [["desktop", { width: 1280, height: 720 }], ["portrait", { width: 390, height: 844 }], ["short", { width: 360, height: 640 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(server.resolvedUrls.local[0]); await page.waitForFunction(() => window.__seal);
  await page.evaluate(async () => {
    const S = await import("/src/ui/store.ts"); ["move", "combat", "steal", "charge", "part"].forEach((t) => S.markTip(t));
    const { TERMS } = await import("/src/data/glossary.ts"); Object.keys(TERMS).forEach((t) => S.markTip(`term:${t}`));
    const R = await import("/src/game/run.ts"); const run = R.createRun(9, "sword", "lamp");
    run.floor = 3; __seal.runSig.value = run; __seal.page.value = "game";
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => __seal.fight("bell", "guardian")); await page.waitForSelector(".combat");
  await page.evaluate(async () => {
    const R = await import("/src/game/run.ts"); const run = __seal.runSig.value;
    // Stuff the bag so the loot spills into the pile, as in a real final climb.
    for (let i = 0; i < 9; i++) run.pending.push(["ash", "silk", "fur", "fang"][i % 4]);
    run.combat.over = "win"; R.winCombat(run);
    const { RELICS } = await import("/src/data/relics.ts");
    if (run.reward) { run.reward.relicChoices = Object.keys(RELICS).slice(3, 6); run.reward.goods.push("ash", "silk", "fur", "fang", "clasp", "fur"); }
    if (run.reward) run.reward.note = (run.reward.note || "") + " 取材失败：钟铜碎了。没取到的材料：钟铜。货堆里还有 9 件。".repeat(2);
    __seal.commit();
  });
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const b = document.querySelector(".reward .continue"); if (!b) return { err: "no continue", screen: __seal.runSig.value.screen };
    if (innerWidth < 1000) b.scrollIntoView({ block: "nearest" }); // portrait: the whole screen scrolls by design
    const rc = b.getBoundingClientRect(); const hit = document.elementFromPoint(rc.x + rc.width / 2, rc.y + rc.height / 2);
    return { top: Math.round(rc.top), bottom: Math.round(rc.bottom), vh: innerHeight, ok: rc.bottom <= innerHeight + 1 && b.contains(hit), text: b.textContent };
  });
  console.log(name, JSON.stringify(r)); if (!r.ok) bad++;
  await page.screenshot({ path: `.cache/rw-${name}.png` });
  await page.close();
}
await browser.close(); await server.close();
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
