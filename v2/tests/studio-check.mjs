// Check the ModelScope studio package the way a visitor meets it: inside a cross-origin iframe,
// fresh browser profile, desktop and 390×844 touch. Plays a whole run to its end (win or death),
// toggles sound, restarts, reloads mid-run, and fails on page errors, 4xx/5xx or outside requests.
// Usage: npm run pack:studio && node tests/studio-check.mjs [outDir]
import { chromium } from "playwright-core";
import { createServer } from "node:http";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.env.STUDIO_DIR ? new URL(`../${process.env.STUDIO_DIR}/`, import.meta.url).pathname : new URL("../dist-studio/", import.meta.url).pathname;
const out = process.argv[2] ?? ".cache/studio-check";
await mkdir(out, { recursive: true });
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".webp": "image/webp", ".woff2": "font/woff2", ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8", ".png": "image/png", ".ico": "image/x-icon" };

// App server: the package served under a sub-path, like a studio URL.
const app = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (!path.startsWith("/studio/")) { res.writeHead(404).end(); return; }
  let rel = path.slice("/studio/".length);
  if (!rel || rel.endsWith("/")) rel += "index.html";
  rel = normalize(rel);
  if (rel.startsWith("..")) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(join(root, rel));
    res.writeHead(200, { "content-type": types[extname(rel)] ?? "application/octet-stream" }).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(0, "127.0.0.1");
await new Promise((r) => app.once("listening", r));
const appPort = app.address().port;
// Host page on another origin (localhost vs 127.0.0.1 are different sites), embedding the studio.
const host = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>html,body{margin:0;height:100%;background:#222}iframe{border:0;width:100%;height:100%;display:block}</style>
<iframe src="http://127.0.0.1:${appPort}/studio/" allow="autoplay; fullscreen" sandbox="allow-scripts allow-same-origin allow-popups allow-forms"></iframe>`);
}).listen(0, "localhost");
await new Promise((r) => host.once("listening", r));
const hostUrl = `http://localhost:${host.address().port}/`;

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--autoplay-policy=user-gesture-required"] });
const report = { package: root, hostUrl, runs: [] };

async function check(name, ctxOpts, climb = false) {
  const ctx = await browser.newContext(ctxOpts); // fresh profile every time
  await ctx.addInitScript(() => {
    const A = window.AudioContext;
    if (!A) return;
    window.__ctxs = [];
    window.AudioContext = class extends A { constructor(...a) { super(...a); window.__ctxs.push(this); } };
  });
  const page = await ctx.newPage();
  const touch = !!ctxOpts.hasTouch;
  const r = { name, viewport: ctxOpts.viewport, touch, errors: [], badResponses: [], outsideRequests: [], checks: {} };
  page.on("pageerror", (e) => r.errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") r.errors.push(m.text()); });
  page.on("response", (res) => { if (res.status() >= 400) r.badResponses.push(`${res.status()} ${res.url()}`); });
  page.on("request", (q) => { const u = new URL(q.url()); if (!["localhost", "127.0.0.1"].includes(u.hostname) && u.protocol.startsWith("http")) r.outsideRequests.push(q.url()); });
  const t0 = Date.now();
  await page.goto(hostUrl);
  const frame = await (await page.waitForSelector("iframe")).contentFrame();
  const press = async (loc) => { if (touch) await loc.tap(); else await loc.click(); await page.waitForTimeout(250); };
  // Plain strings match the whole button name: after a win the abacus card reads "带 32 石进塔" and would match "进塔".
  const btn = (text) => press(frame.getByRole("button", { name: text, exact: typeof text === "string" }).first());
  const state = () => frame.evaluate(() => { const s = window.__seal?.runSig.value; return s ? JSON.parse(JSON.stringify({ screen: s.screen, floor: s.floor, outcome: s.outcome, hp: s.hp, pos: s.pos, omen: s.omen, oil: s.oil })) : null; });
  const shot = (n) => page.screenshot({ path: `${out}/${name}-${n}.jpg`, type: "jpeg", quality: 70 });

  await frame.waitForSelector(".title-screen", { timeout: 20000 });
  r.checks.titleLoadMs = Date.now() - t0;
  r.checks.fontsLoaded = await frame.evaluate(async () => { await document.fonts.ready; return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family); });
  await shot("01-title");

  // Sound: the menu toggles mute and the setting sticks in this (partitioned) iframe storage.
  await btn(/^(声音|音量|静音)$/);
  const box = frame.locator(".sound-panel input[type=checkbox]");
  const before = await box.isChecked();
  await press(box);
  const afterOff = await frame.evaluate(() => Object.entries(localStorage).map(([k, v]) => v).join("").includes('"sound":false'));
  await press(box);
  r.checks.sound = { startedOn: before, mutePersisted: afterOff, backOn: await box.isChecked(), audioContexts: await frame.evaluate(() => (window.__ctxs ?? []).map((c) => c.state)) };
  await btn(/^(声音|音量|静音)$/);

  await btn(/去镇灯铺接单|重新接单/);
  await btn("进塔");
  await frame.waitForSelector(".explore");
  await shot("02-explore");
  const tip = frame.getByRole("button", { name: "知道了" });
  if (await tip.count()) await press(tip.first());

  // Touch: the on-screen pad moves/turns the player.
  {
    const omen = frame.locator(".omen-card .btn");
    if (await omen.count()) await press(omen.first());
    const p0 = (await state()).pos;
    await btn("左转");
    await btn("前进");
    await page.waitForTimeout(500);
    const p1 = (await state()).pos;
    r.checks.padMoves = JSON.stringify(p0) !== JSON.stringify(p1);
  }

  const visited = []; // "floor:x,y" of shops and rests already used: they stay on the map but are not worth walking back to
  const ALL = ["guardian", "stairs", "shop", "event", "rest", "chest", "fight", "elite"];
  async function walkTo(kinds) {
    const s = await state();
    const pick = await frame.evaluate(([groups, visited]) => {
      const S = window.__seal, run = S.runSig.value, d = run.dungeon;
      // Try each group of kinds in order (active entities block paths, so fall back to clearing whatever is nearest).
      // Last resort: a used rest (left with 「先不用」) or an event-shop stays a blocking tile; walk back through it as a player would.
      for (const [kinds, skipVisited] of [...groups.map((k) => [k, true]), [groups.at(-1), false]]) {
        const ents = d.entities.filter((e) => !e.done && kinds.includes(e.kind) && d.seen[e.y * d.w + e.x] && !(skipVisited && visited.includes(run.floor + ":" + e.x + "," + e.y)))
          .map((e) => ({ x: e.x, y: e.y, p: S.findPath(d, run.pos, e) })).filter((e) => e.p).sort((a, b) => a.p.length - b.p.length);
        if (ents.length) return { x: ents[0].x, y: ents[0].y, w: d.w, h: d.h };
      }
      const cand = [];
      for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (d.seen[y * d.w + x] && !d.tiles[y * d.w + x]) cand.push({ x, y, s: Math.abs(x - run.pos.x) + Math.abs(y - run.pos.y) + Math.random() * 4 });
      cand.sort((a, b) => b.s - a.s);
      const c = cand.slice(0, 15).find((c) => { const p = S.findPath(d, run.pos, c); return p && p.length; });
      return c && { x: c.x, y: c.y, w: d.w, h: d.h };
    }, [kinds, visited]);
    if (process.env.DEBUG) console.log("walkTo", JSON.stringify(kinds), JSON.stringify(pick), JSON.stringify(s?.pos));
    if (!pick) return;
    // Clicking a tile right next to you on the minimap does nothing: turn to face it and step, as a player would.
    const adj = await frame.evaluate((t) => {
      const S = window.__seal, r = S.runSig.value, dx = t.x - r.pos.x, dy = t.y - r.pos.y;
      if (Math.abs(dx) + Math.abs(dy) !== 1) return null;
      return ((dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3) - r.pos.dir + 4) % 4;
    }, { x: pick.x, y: pick.y });
    if (adj !== null) {
      if (adj === 1 || adj === 2) await btn("右转");
      if (adj === 3) await btn("左转");
      if (adj === 2) await btn("右转");
      await btn("前进");
      await page.waitForTimeout(600);
      return;
    }
    const mb = await frame.locator(".minimap canvas").boundingBox();
    const x = mb.x + ((pick.x + 0.5) / pick.w) * mb.width, y = mb.y + ((pick.y + 0.5) / pick.h) * mb.height;
    const tapAt = () => (touch ? page.touchscreen.tap(x, y) : page.mouse.click(x, y));
    const posKey = async () => JSON.stringify((await state())?.pos);
    const before = await posKey();
    await tapAt();
    // REVIEW-002: a long walk that would leave the lamp at ≤15 oil only warns on the first tap; tap the same tile again.
    await page.waitForTimeout(400);
    if ((await state())?.screen === "explore" && !(await frame.locator(".stop-walk").count()) && (await posKey()) === before) await tapAt();
    for (let i = 0; i < 16; i++) { await page.waitForTimeout(250); if ((await state())?.screen !== "explore" || !(await frame.locator(".stop-walk").count())) break; }
    void s;
  }
  async function fight() {
    for (let turn = 0; turn < 30; turn++) {
      if ((await state())?.screen !== "combat") return;
      // Climb pass: one card ends each fight, so the run reaches every floor within the time box.
      if (climb) await frame.evaluate(() => { const S = window.__seal, c = S.runSig.value?.combat; if (c?.enemy && c.enemy.hp > 1) { c.enemy.hp = 1; S.commit(); } });
      // First-encounter tips sit over the hand; read and close them like a player would.
      const tip = frame.getByRole("button", { name: "知道了" });
      if (await tip.count()) await tip.first().click({ timeout: 1500 }).catch(() => {});
      for (let i = 0; i < 6; i++) {
        const cards = frame.locator(".hand .card:not(.disabled)");
        if (!(await cards.count())) break;
        // The fanned hand overlaps each card with the next one; the last card is the one fully on top.
        await press(cards.last());
        // Phones play in two steps (UI-005): the first tap only picks the card.
        const picked = frame.locator(".hand-slot.picked .card");
        if (await picked.count()) await press(picked.first());
        await page.waitForTimeout(350);
        if ((await state())?.screen !== "combat") return;
      }
      if ((await state())?.screen !== "combat") return;
      // The last card's hit can end the fight a moment after the check above (the button goes with it): only a
      // failed press while still in combat is an error.
      const end = frame.getByRole("button", { name: /结束回合/ }).first();
      if (!(await end.click({ timeout: 3000 }).then(() => true, () => false)) && (await state())?.screen === "combat") await btn(/结束回合/);
      await page.waitForTimeout(1300);
    }
  }
  const seen = new Set();
  const once = async (n) => { if (!seen.has(n)) { seen.add(n); await shot(n); } };
  let step = 0, last = null;
  const deadline = Date.now() + (climb ? 30 : 12) * 60_000;
  for (; step < 900 && Date.now() < deadline; step++) {
    const s = await state();
    last = s;
    if (!s || s.outcome) break;
    // Climb pass: keep the player alive and the lamp lit (an empty lamp stops minimap auto-walk), reveal the map
    // (fog omens hide the guardian) and head for the guardian and stairs only, so the run crosses all three floors and their guardians
    // (proves every floor's art and music load from the package; not a balance result).
    // Any pass: this simple bot cannot find oil in the dark (an empty lamp stops minimap auto-walk and exploring),
    // so relight it; the check is about the package running a whole run, not about difficulty.
    // It also only walks to tiles it has seen, so under the fog omen it walks into walls until the deadline: reveal the map.
    if (!climb && s.screen === "explore") await frame.evaluate(() => { const S = window.__seal, r = S.runSig.value; if (r && (r.oil <= 0 || !r.dungeon.seen.every(Boolean))) { if (r.oil <= 0) r.oil = r.maxOil; r.dungeon.seen.fill(true); S.commit(); } });
    if (climb && s.screen === "explore") await frame.evaluate(() => { const S = window.__seal, r = S.runSig.value; if (r) { r.maxHp = Math.max(r.maxHp, 400); r.hp = r.maxHp; r.oil = r.maxOil; r.dungeon.seen.fill(true); S.commit(); } });
    try {
      // GAME-007 goods reveal (翻货袋 etc.) covers the screen: tap to turn all cards over, then take them.
      if (await frame.locator(".reveal").count()) {
        await once("05b-reveal");
        await press(frame.locator(".reveal").first());
        const keep = frame.getByRole("button", { name: /^收下/ }); if (await keep.count()) await press(keep.first());
        continue;
      }
      // Card pick overlay (copy / upgrade / remove from an event): tap a card, then confirm (two steps since UI-011).
      if (await frame.locator(".overlay .deck-box").count()) {
        const pick = frame.locator(".deck-box .card-grid .card");
        if (await pick.count()) {
          await press(pick.first());
          const ok = frame.locator(".pick-confirm .btn"); if (await ok.count()) await press(ok.first());
        } else { for (let i = 0; i < 2; i++) { const skip = frame.locator(".deck-box header .btn"); if (await skip.count()) await press(skip.first()); } }
        continue;
      }
      // REVIEW-001 first-time concept tips can open on any screen: close them first.
      // Try briefly: a tip hidden behind another layer can't be tapped (a player never sees it either), so carry on.
      { const tip = frame.getByRole("button", { name: "知道了" }); if (await tip.count() && await tip.first().click({ timeout: 1500 }).then(() => true, () => false)) continue; }
      if (s.screen === "combat") { await once("03-combat"); await fight(); await page.waitForTimeout(1200); continue; }
      if (s.screen === "reward") {
        await once("04-reward");
        const card = frame.locator(".card-offer .card"); if (await card.count()) await press(card.first());
        const take = frame.getByRole("button", { name: "拿走" }); if (await take.count()) await press(take.first());
        const relic = frame.locator(".relic-choice"); if (await relic.count()) await press(relic.first());
        await btn(/继续|回镇/); continue;
      }
      if (s.screen === "event") {
        await once("05-event");
        // After a goods reveal the event comes back with only 「继续」 left: no option to pick.
        const opt = frame.locator(".option:not(.locked)");
        if (await opt.count()) await press(opt.first());
        if (await frame.locator(".overlay .deck-box, .reveal").count()) continue; // handled at the top of the loop
        await btn(/继续|迎战/); continue;
      }
      if (s.screen === "shop") { visited.push(s.floor + ":" + s.pos.x + "," + s.pos.y); await once("06-shop"); await btn("离开狐市"); continue; }
      if (s.screen === "rest") { visited.push(s.floor + ":" + s.pos.x + "," + s.pos.y); await press(frame.locator(".option:not([disabled])").first()); continue; }
      if (s.screen === "explore") {
        if (await frame.locator(".omen-card").count()) { await press(frame.locator(".omen-card .btn").first()); continue; }
        if (await frame.locator(".stairs-prompt").count()) {
          await once(`07-stairs-f${s.floor}`);
          // Leaving a pile behind takes a second tap on the relabelled button (「留下 N 件，上楼／回镇」).
          const up = frame.getByRole("button", { name: /^(上楼|留下 \d+ 件，上楼)$/ });
          // Only the climb pass goes up; the other passes retreat at the first stairs so their run ends in minutes
          // and the town settlement and restart get checked (a surviving bot could otherwise run past the deadline).
          if (climb && await up.count()) await press(up.first()); else await btn(/^(回镇结算|留下 \d+ 件，回镇)$/);
          await page.waitForTimeout(900); continue;
        }
        await walkTo(climb ? [["stairs", "guardian"], ALL] : [ALL]);
        continue;
      }
      await page.waitForTimeout(600);
    } catch (e) { { const m = String(e).split("\n"); r.errors.push(`driver [${s.screen}]: ${m[0]} ${(m.find((l) => l.includes("waiting for")) ?? "").trim()}`); if (!seen.has("err")) { seen.add("err"); await shot("09-first-error").catch(() => {}); } } await page.waitForTimeout(600); }
  }
  await page.waitForTimeout(1500);
  // Beating the last guardian sets the outcome while the reward screen is still up: go through to the result screen.
  // Leaving with an untaken card is two taps: 「回镇结算」, then 「不要了，继续」.
  const home = frame.getByRole("button", { name: /回镇结算|不要了，继续/ });
  for (let i = 0; i < 3 && (await state())?.screen === "reward" && (await home.count()); i++) { await press(home.first()); await page.waitForTimeout(1500); }
  await shot("08-result");
  r.checks.run = { climb, steps: step, outcome: last?.outcome ?? null, floorReached: last?.floor, minutes: +((Date.now() - t0) / 60000).toFixed(1) };

  // Restart from the result screen, then reload mid-run: the save in iframe storage must come back.
  const again = frame.getByRole("button", { name: "再进一趟" });
  if (await again.count()) {
    await press(again.first());
    try { await btn("进塔"); await frame.waitForSelector(".explore", { timeout: 15000 }); }
    catch (e) { await shot("09-restart-stuck"); throw e; }
    const s1 = await state();
    await page.reload();
    const f2 = await (await page.waitForSelector("iframe")).contentFrame();
    await f2.waitForSelector(".title-screen");
    const resumeBtn = f2.getByRole("button", { name: /继续|接着/ });
    r.checks.restart = { newRunFloor: s1?.floor, resumeOfferedAfterReload: (await resumeBtn.count()) > 0 };
  } else r.checks.restart = { error: "no restart button on the result screen" };

  r.ok = !r.errors.length && !r.badResponses.length && !r.outsideRequests.length && !!r.checks.run.outcome && (!climb || r.checks.run.outcome === "win") && r.checks.padMoves && r.checks.sound.mutePersisted && r.checks.restart?.newRunFloor === 1;
  console.log(name, r.ok ? "OK" : "FAIL", JSON.stringify(r.checks));
  report.runs.push(r);
  await ctx.close();
}

const only = process.env.ONLY;
if (!only || only === "desktop") await check("desktop", { viewport: { width: 1280, height: 720 } });
if (!only || only === "phone-390") await check("phone-390", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
if (!only || only === "climb") await check("climb", { viewport: { width: 1280, height: 720 } }, true);
report.when = new Date().toISOString();
if (only) {
  // Re-running one check: keep the other entries of an existing report.
  try {
    const prev = JSON.parse(await readFile(`${out}/report.json`, "utf8"));
    report.runs = [...prev.runs.filter((r) => r.name !== only), ...report.runs];
    report.when = { [only]: report.when, earlier: prev.when };
  } catch { /* no earlier report */ }
}
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close(); app.close(); host.close();
process.exit(report.runs.every((r) => r.ok) ? 0 : 1);
