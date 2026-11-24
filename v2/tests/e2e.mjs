// End-to-end smoke test: plays the real game in Chrome and saves screenshots.
// Usage: node tests/e2e.mjs [url] [outDir]   (default http://localhost:5173, .cache/e2e)
import { chromium } from "playwright-core";
import { mkdir } from "node:fs/promises";

const url = process.argv[2] ?? "http://localhost:5173";
const out = process.argv[3] ?? ".cache/e2e";
const viewport = process.env.PORTRAIT ? { width: 390, height: 844 } : { width: 1280, height: 720 };
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
const shot = async (name) => { await page.waitForTimeout(450); await page.screenshot({ path: `${out}/${name}.png` }); console.log("shot", name); };
const click = async (text) => { await page.getByRole("button", { name: text }).first().click(); await page.waitForTimeout(250); };
const state = () => page.evaluate(() => { const r = window.__seal.runSig.value; return r && JSON.parse(JSON.stringify(r)); });

await page.goto(url + "?seed=e2e");
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForSelector(".title-screen");
await shot("01-title");
await click("去镇灯铺接单");
await shot("02-town");
await click("进塔");
await page.waitForSelector(".explore");
await shot("03-explore-tip");
const startPos = (await state()).pos;
// Close the tip and press forward straight away: the omen card that appears must still gate the key.
await page.getByRole("button", { name: "知道了" }).first().click();
await page.keyboard.press("w");

// UI-001 regression: the omen card gates movement, and auto-walk can be stopped.
{
  const assert = (ok, msg) => { if (!ok) { errors.push("UI-001: " + msg); console.log("FAIL", msg); } else console.log("ok", msg); };
  if (await page.locator(".omen-card").count()) {
    const before = startPos;
    await page.waitForTimeout(400);
    assert(JSON.stringify((await state()).pos) === JSON.stringify(before), "movement is blocked while the omen card is unread");
    assert(await page.locator(".omen-card .omen-hint").count() === 1, "blocked input explains how to continue");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    assert(await page.locator(".omen-card").count() === 0, "Enter closes the omen card");
  }
  // Walk to the farthest reachable seen tile, then stop with Esc after the first step.
  const target = await page.evaluate(() => {
    const s = window.__seal, r = s.runSig.value, d = r.dungeon;
    let best = null;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      if (!d.seen[y * d.w + x] || d.tiles[y * d.w + x]) continue;
      const p = s.findPath(d, r.pos, { x, y });
      if (p && (!best || p.length > best.len)) best = { x, y, len: p.length };
    }
    return best && { ...best, w: d.w, h: d.h };
  });
  if (target && target.len >= 3) {
    const box = await page.locator(".minimap canvas").boundingBox();
    await page.mouse.click(box.x + ((target.x + 0.5) / target.w) * box.width, box.y + ((target.y + 0.5) / target.h) * box.height);
    await page.waitForTimeout(250);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(900);
    const pos = (await state()).pos;
    assert(!(pos.x === target.x && pos.y === target.y), "Esc stops an auto-walk before it arrives");
    assert(await page.locator(".stop-walk").count() === 0, "the stop button goes away once stopped");
  }
}

// Walk to the nearest visible fight by clicking it on the minimap.
async function walkToKind(kinds) {
  for (let tries = 0; tries < 4; tries++) {
    const r = await state();
    if (r.screen !== "explore") return r.screen;
    const d = r.dungeon;
    const reachable = await page.evaluate((list) => list.map((e) => !!window.__seal.findPath(window.__seal.runSig.value.dungeon, window.__seal.runSig.value.pos, e)),
      d.entities.map((e) => ({ x: e.x, y: e.y })));
    const target = d.entities.filter((e, i) => reachable[i] && !e.done && kinds.includes(e.kind) && d.seen[e.y * d.w + e.x])
      .sort((a, b) => Math.abs(a.x - r.pos.x) + Math.abs(a.y - r.pos.y) - Math.abs(b.x - r.pos.x) - Math.abs(b.y - r.pos.y))[0];
    const box = await page.locator(".minimap canvas").boundingBox();
    let tx, ty;
    if (target) { tx = target.x; ty = target.y; }
    else {
      // explore: walk to the farthest seen floor tile
      const cand = [];
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (d.seen[y * d.w + x] && !d.tiles[y * d.w + x]) cand.push({ x, y, s: Math.abs(x - r.pos.x) + Math.abs(y - r.pos.y) + Math.random() * 3 });
      cand.sort((a, b) => b.s - a.s);
      const ok = await page.evaluate((list) => list.findIndex((c) => { const p = window.__seal.findPath(window.__seal.runSig.value.dungeon, window.__seal.runSig.value.pos, c); return p && p.length; }), cand.slice(0, 12));
      const pickC = cand[Math.max(0, ok)]; tx = pickC.x; ty = pickC.y;
    }
    await page.mouse.click(box.x + ((tx + 0.5) / d.w) * box.width, box.y + ((ty + 0.5) / d.h) * box.height);
    await page.waitForTimeout(2500);
  }
  return (await state()).screen;
}

// Play on: handle whatever screen comes up, screenshot each kind the first time.
const seen = new Set();
const first = async (name) => { if (!seen.has(name)) { seen.add(name); await shot(name); } };
async function fight() {
  for (let turn = 0; turn < 20; turn++) {
    if ((await state()).screen !== "combat") return;
    await first("05-combat");
    for (let i = 0; i < 6; i++) {
      const cards = page.locator(".hand .card:not(.disabled)");
      if (!(await cards.count())) break;
      await cards.first().click();
      if (await page.locator(".hand-slot.picked .card").count()) await page.locator(".hand-slot.picked .card").first().click(); // portrait: two-step play
      await page.waitForTimeout(450);
      if ((await state()).screen !== "combat") return;
    }
    await first("06-combat-played");
    await page.keyboard.press("e");
    await page.waitForTimeout(1500);
  }
}
for (let step = 0; step < Number(process.env.STEPS ?? 60) && seen.size < 11; step++) {
  const r = await state();
  if (!r || r.outcome) { await page.waitForTimeout(1200); await shot("20-result"); break; }
  if (r.screen === "combat") { await fight(); await page.waitForTimeout(1300); continue; }
  if (r.screen === "reward") {
    await first("07-reward");
    const cards = page.locator(".card-offer .card");
    if (await cards.count()) await cards.first().click();
    const relic = page.getByRole("button", { name: "拿走" });
    if (await relic.count()) await relic.click();
    const choice = page.locator(".relic-choice");
    if (await choice.count()) await choice.first().click();
    if (!seen.has("09-bag")) { await page.keyboard.press("b"); await first("09-bag"); await page.keyboard.press("Escape"); }
    await page.getByRole("button", { name: /继续|回镇/ }).click();
    continue;
  }
  if (r.screen === "event") {
    await first("11-event");
    await page.locator(".option:not(.locked)").first().click();
    await page.waitForTimeout(300);
    if (await page.locator(".overlay .card").count()) await page.locator(".overlay .card").first().click();
    await first("12-event-result");
    await page.getByRole("button", { name: /继续|迎战/ }).click();
    continue;
  }
  if (r.screen === "shop") { await first("13-shop"); await page.getByRole("button", { name: "离开狐市" }).click(); continue; }
  if (r.screen === "rest") { await first("14-rest"); await page.locator(".option").first().click(); continue; }
  if (r.screen === "explore") {
    const stairs = await page.locator(".stairs-prompt").count();
    if (stairs) { await first("15-stairs"); await page.getByRole("button", { name: "上楼" }).click(); await page.waitForTimeout(800); await first("16-floor2"); continue; }
    await first("03-explore");
    if (await page.locator(".omen-card").count()) await page.locator(".omen-card .btn").click();
    await walkToKind(["shop", "event", "rest", "chest", "fight", "elite", "guardian"]);
  }
}
console.log("errors:", errors.length ? errors : "none");
await browser.close();
process.exit(errors.length ? 1 : 0);
