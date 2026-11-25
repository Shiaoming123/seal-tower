// Live check after a studio redeploy, logged out, via the direct link with ?playtest=1.
// Checks the title, entering a fight, card play (phones: two taps, picked card on top of tips) and the playtest record on the result screen.
// Usage: node tests/live-check.mjs <out-prefix> [desktop]   (default device: iPhone 13; screenshots <out-prefix>-01..03.jpg)
import { chromium, devices } from "playwright-core";
const out = process.argv[2] ?? ".cache/live";
const url = "https://shiaoming-zhanyaota.ms.show/?seed=livecheck&playtest=1";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const desktop = process.argv[3] === "desktop";
const ctx = await browser.newContext(desktop ? { viewport: { width: 1280, height: 720 } } : { ...devices["iPhone 13"] });
const press = (loc, o) => (desktop ? loc.click(o) : loc.tap(o));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const res = {};
await page.goto(url, { waitUntil: "domcontentloaded" });
let frame;
for (let i = 0; i < 60 && !frame; i++) {
  for (const f of page.frames()) if (await f.locator(".title-screen").count().catch(() => 0)) frame = f;
  if (!frame) await page.waitForTimeout(500);
}
if (!frame) { console.log(JSON.stringify({ error: "no game frame", top: page.url(), frames: page.frames().map((f) => f.url()) })); process.exit(1); }
frame.on?.("console", () => {});
res.topUrl = page.url();
res.frameUrl = frame.url();
const shot = (n) => page.screenshot({ path: `${out}-${n}.jpg`, type: "jpeg", quality: 70 });
const tap = async (loc) => { await press(loc); await page.waitForTimeout(300); };
const btn = (t) => tap(frame.getByRole("button", { name: t, exact: typeof t === "string" }).first());
const state = () => frame.evaluate(() => { const s = window.__seal?.runSig.value; return s && { screen: s.screen, outcome: s.outcome, hp: s.hp }; });
await frame.evaluate(() => document.fonts.ready);
res.title = await frame.evaluate(() => {
  const h = document.querySelector(".title-box h1, .title-box .title, .title-screen h1");
  if (!h) return null;
  const lh = parseFloat(getComputedStyle(h).lineHeight) || parseFloat(getComputedStyle(h).fontSize) * 1.2;
  return { text: h.textContent, lines: Math.round(h.getBoundingClientRect().height / lh), portrait: !!document.querySelector(".stage.portrait") };
});
await shot("01-title");
await btn(/去镇灯铺接单|重新接单/);
await btn("进塔");
await frame.waitForSelector(".explore");
for (let k = 0; k < 3; k++) { const b = frame.getByRole("button", { name: "知道了" }); if (await b.count()) await press(b.first(), { timeout: 2000 }).catch(() => {}); }
{ const o = frame.locator(".omen-card .btn"); if (await o.count()) await tap(o.first()); }
// Test aid: put the player next to the nearest ordinary fight, facing it, then step in with the pad like a player.
await frame.evaluate(() => {
  const S = window.__seal, r = S.runSig.value, d = r.dungeon;
  const e = d.entities.find((e) => !e.done && e.kind === "fight");
  const dirs = [[0, 1, 0], [-1, 0, 1], [0, -1, 2], [1, 0, 3]]; // stand south/west/north/east of it, facing N/E/S/W
  for (const [dx, dy, dir] of dirs) { const x = e.x + dx, y = e.y + dy; if (x >= 0 && y >= 0 && x < d.w && y < d.h && !d.tiles[y * d.w + x] && !d.entities.some((o) => !o.done && o.x === x && o.y === y)) { r.pos = { x, y, dir }; break; } }
  S.commit();
});
await btn("前进");
await page.waitForTimeout(1500);
res.enteredCombat = (await state())?.screen === "combat";
if (res.enteredCombat) {
  const tipVisible = await frame.getByRole("button", { name: "知道了" }).count();
  // Close the first-fight tip and any concept tips that follow it (each must be tappable on top).
  for (let k = 0; k < 4; k++) { const t = frame.getByRole("button", { name: "知道了" }); if (!(await t.count()) || !(await press(t.first(), { timeout: 2000 }).then(() => true, () => false))) break; await page.waitForTimeout(300); }
  const n0 = await frame.locator(".hand .hand-slot").count();
  await tap(frame.locator(".hand .card:not(.disabled)").last()); // the fanned hand's last card is fully on top
  const n1 = await frame.locator(".hand .hand-slot").count();
  res.twoStep = { tipShownAtStart: tipVisible > 0, handBefore: n0, afterFirstTap: n1, picked: await frame.locator(".hand-slot.picked").count() };
  // Is the picked card the topmost element at its centre (not covered by the tip)?
  res.twoStep.pickedOnTop = await frame.evaluate(() => {
    const p = document.querySelector(".hand-slot.picked"); if (!p) return null;
    const b = p.getBoundingClientRect(); const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
    return p.contains(el);
  });
  await shot("02-picked");
  if (await frame.locator(".hand-slot.picked .card").count()) await tap(frame.locator(".hand-slot.picked .card").first()); // phones: second tap plays
  await page.waitForTimeout(600);
  res.twoStep.afterSecondTap = await frame.locator(".hand .hand-slot").count();
  // End turns without playing until the run ends (a real way to lose), to reach the result screen.
  for (let i = 0; i < 60; i++) {
    const s = await state(); if (!s || s.screen !== "combat") break;
    const t = frame.getByRole("button", { name: "知道了" }); if (await t.count()) await press(t.first(), { timeout: 2000 }).catch(() => {});
    // The enemy's turn can end the run while the button is being pressed (it leaves with the combat screen): the loop re-checks.
    const end = frame.getByRole("button", { name: /结束回合/ }); if (await end.count()) await press(end.first(), { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
  }
  const s = await state();
  res.end = s;
  await page.waitForTimeout(800);
  res.playtestButton = await frame.getByRole("button", { name: /复制本局试玩记录/ }).count();
  res.playtestBlock = await frame.locator(".playtest-record").count();
  await shot("03-result");
}
res.errors = errors;
console.log(JSON.stringify(res, null, 1));
await browser.close();
