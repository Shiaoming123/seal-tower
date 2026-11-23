// Screenshots every monster in combat and every event screen (dev server only).
// Usage: node tests/gallery.mjs [url] [outDir]   — handy for reviewing new art.
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? ".cache/gallery";
const only = process.env.ONLY?.split(",");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(url + "?seed=gallery");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.getByRole("button", { name: "去镇灯铺接单" }).click();
await page.getByRole("button", { name: "进塔" }).click();
await page.waitForSelector(".explore");
await page.evaluate(() => { const p = JSON.parse(localStorage.getItem("seal-tower.v2.profile")); p.seenTips = ["move", "combat", "steal", "charge", "part"]; localStorage.setItem("seal-tower.v2.profile", JSON.stringify(p)); });
await page.reload();
await page.waitForSelector(".explore");
const { enemies, events } = await page.evaluate(async () => {
  const E = await import("/src/data/enemies.ts");
  const V = await import("/src/data/events.ts");
  return { enemies: Object.keys(E.ENEMIES), events: Object.keys(V.EVENTS) };
});
for (const id of enemies) {
  if (only && !only.includes(id)) continue;
  await page.evaluate((id) => { const s = window.__seal; s.runSig.value.combat = null; s.runSig.value.screen = "explore"; s.commit(); s.fight(id, "elite"); }, id);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/enemy-${id}.png` });
}
for (const id of events) {
  if (only && !only.includes(id)) continue;
  await page.evaluate((id) => { const s = window.__seal; s.runSig.value.combat = null; s.runSig.value.screen = "explore"; s.commit(); s.event(id); }, id);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${out}/event-${id}.png` });
}
console.log(`${enemies.length} enemies, ${events.length} events → ${out}`, errors.length ? errors : "no errors");
await browser.close();
process.exit(errors.length ? 1 : 0);
