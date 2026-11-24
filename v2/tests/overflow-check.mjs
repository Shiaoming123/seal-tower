// Find text that spills out of its box, gets clipped, or lands on top of other text, on every screen, desktop and
// two portrait sizes.
// Opens title, help, achievements, codex (every entry), town (every order and weapon, build tab), and in a run:
// explore, bag, deck, every monster's fight, every event, shop, rest, reward and result.
// Usage: node tests/overflow-check.mjs [outDir]   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { mkdir, writeFile } from "node:fs/promises";

const out = process.argv[2] ?? ".cache/overflow";
await mkdir(out, { recursive: true });
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });

// Runs in the page: every visible text run is compared with its nearest visible box (background, border or inset frame).
const scan = () => {
  const vis = (el) => { const s = getComputedStyle(el); return s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.05; };
  const isBox = (el) => {
    const s = getComputedStyle(el);
    if (el === document.body || el.id === "app") return false;
    const bg = s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent";
    const img = s.backgroundImage !== "none";
    const border = ["Top", "Right", "Bottom", "Left"].some((k) => parseFloat(s[`border${k}Width`]) > 0 && s[`border${k}Style`] !== "none");
    const inset = s.boxShadow.includes("inset");
    const r = el.getBoundingClientRect();
    return (bg || img || border || inset) && r.width * r.height < innerWidth * innerHeight * 0.6;
  };
  const name = (el) => {
    const parts = [];
    for (let e = el; e && parts.length < 3 && e !== document.body; e = e.parentElement) {
      const c = [...e.classList].filter((x) => !/^(selected|on|active|kind-|disabled)/.test(x)).slice(0, 2).join(".");
      parts.unshift(e.tagName.toLowerCase() + (c ? "." + c : ""));
    }
    return parts.join(" > ");
  };
  const found = new Map();
  const add = (key, v) => { if (!found.has(key)) found.set(key, v); };
  const runs = []; // every visible text run, for the overlap check below
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.textContent.trim();
    if (!t || !n.parentElement || !vis(n.parentElement)) continue;
    // Nearest box; a scrolling panel on the way means the text can be scrolled into view, so stop there.
    let box = n.parentElement, scrolled = false;
    while (box && !isBox(box)) { const st = getComputedStyle(box); if (/auto|scroll/.test(st.overflow + st.overflowY + st.overflowX)) { scrolled = true; break; } box = box.parentElement; }
    if (box && !scrolled) { const st = getComputedStyle(box); if (/auto|scroll/.test(st.overflow + st.overflowY + st.overflowX)) scrolled = true; }
    if (scrolled) box = null;
    const range = document.createRange(); range.selectNodeContents(n);
    const b = (box ?? document.body).getBoundingClientRect();
    const rects = [...range.getClientRects()].filter((r) => r.width >= 1 && r.height >= 1);
    // For the overlap check: only the part of the text you can see (scrolling and clipping boxes cut it), and the
    // layer it is drawn in (nearest absolute, fixed or sticky ancestor) — overlays and sticky footers over scrolling content don't count.
    let layer = n.parentElement, seen = rects.map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }));
    for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) {
      const st = getComputedStyle(a);
      if (/hidden|clip|auto|scroll/.test(st.overflow + st.overflowX + st.overflowY)) {
        const c = a.getBoundingClientRect();
        seen = seen.map((r) => ({ left: Math.max(r.left, c.left), right: Math.min(r.right, c.right), top: Math.max(r.top, c.top), bottom: Math.min(r.bottom, c.bottom) }));
      }
    }
    for (layer = n.parentElement; layer && layer !== document.body; layer = layer.parentElement) if (/absolute|fixed|sticky/.test(getComputedStyle(layer).position)) break;
    seen = seen.filter((r) => r.right - r.left >= 1 && r.bottom - r.top >= 1).map((r) => ({ ...r, width: r.right - r.left, height: r.bottom - r.top }));
    runs.push({ el: n.parentElement, text: t, rects: seen, layer });
    for (const r of rects) {
      const over = Math.max(r.bottom - b.bottom, r.right - b.right, b.top - r.top, b.left - r.left);
      if (box && over > 2) { add("spill " + name(box), { kind: "spill", box: name(box), text: t.slice(0, 40), px: Math.round(over) }); break; }
    }
    // Clipped: the text itself lies outside an ancestor that hides overflow (scrolling panels are fine).
    for (let a = n.parentElement; a && a !== document.body; a = a.parentElement) {
      const st = getComputedStyle(a), ov = st.overflow + st.overflowX + st.overflowY;
      if (/auto|scroll/.test(ov)) break; // a scrolling panel owns its overflow: the text can be scrolled to
      if (!/hidden|clip/.test(ov) || st.textOverflow === "ellipsis") continue;
      const c = a.getBoundingClientRect();
      const out = rects.map((r) => Math.max(r.bottom - c.bottom, r.right - c.right, c.top - r.top, c.left - r.left)).reduce((m, v) => Math.max(m, v), 0);
      if (out > 2) { add("clip " + name(a), { kind: "clip", box: name(a), text: t.slice(0, 40), px: Math.round(out) }); break; }
    }
  }
  // Overlap: text from one element lying on text from another (a block pushed onto the next one, or text showing
  // through behind a card). Ignores an element and its own descendants.
  const hit = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  for (let i = 0; i < runs.length; i++) for (let j = i + 1; j < runs.length; j++) {
    const A = runs[i], B = runs[j];
    if (A.layer !== B.layer || A.el === B.el || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    // Hand cards fan over each other on purpose; the card on top hides the one below.
    const ha = A.el.closest(".hand-slot"), hb = B.el.closest(".hand-slot");
    if (ha && hb && ha !== hb) continue;
    for (const ra of A.rects) for (const rb of B.rects) {
      const area = hit(ra, rb);
      if (area > 0.3 * Math.min(ra.width * ra.height, rb.width * rb.height)) {
        add("overlap " + name(A.el) + " | " + name(B.el), { kind: "overlap", box: `${name(A.el)} ⟷ ${name(B.el)}`, text: `${A.text.slice(0, 18)} ⟷ ${B.text.slice(0, 18)}`, px: Math.round(Math.sqrt(area)) });
      }
    }
  }
  // Too small to tap (QA-001): on a phone-sized viewport, buttons below 24×24 CSS px (WCAG 2.2 target size minimum).
  if (innerWidth < 600) for (const el of document.querySelectorAll(".stage button, .stage [role=button]")) {
    if (!vis(el) || el.disabled) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (Math.min(r.width, r.height) < 24) add("tap " + name(el), { kind: "tap", box: name(el), text: el.textContent.trim().slice(0, 30), px: Math.round(Math.min(r.width, r.height)) });
  }
  // Unreachable: a visible button whose box lies outside the stage with no scrolling panel around it.
  const stage = document.querySelector(".stage")?.getBoundingClientRect();
  if (stage) for (const el of document.querySelectorAll(".stage button")) {
    if (!vis(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    // Hand cards deliberately poke out of the bottom edge: only a button whose centre is off the stage is unreachable.
    const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2;
    const out = Math.max(cy - stage.bottom, cx - stage.right, stage.top - cy, stage.left - cx);
    if (out <= 0) continue;
    let scroller = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const st = getComputedStyle(a); if (/auto|scroll/.test(st.overflow + st.overflowY + st.overflowX) && a.scrollHeight > a.clientHeight) { scroller = true; break; } }
    if (!scroller) add("unreachable " + name(el), { kind: "unreachable", box: name(el), text: el.textContent.trim().slice(0, 40), px: Math.round(out) });
  }
  return [...found.values()];
};

const report = {};
async function run(vpName, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  // Measure the settled layout: entrance animations and transitions (UI-011) would catch elements mid-slide.
  await page.addInitScript(() => {
    const css = "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
    const add = () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); };
    if (document.head) add(); else document.addEventListener("DOMContentLoaded", add);
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const issues = [];
  const check = async (where) => {
    await page.waitForTimeout(350);
    for (const i of await page.evaluate(scan)) {
      const key = i.kind + " " + i.box;
      const prev = issues.find((x) => x.key === key);
      if (prev) { if (!prev.where.includes(where)) prev.where.push(where); continue; }
      issues.push({ key, ...i, where: [where] });
      await page.screenshot({ path: `${out}/${vpName}-${issues.length}.jpg`, type: "jpeg", quality: 60 });
    }
  };
  const S = (fn, arg) => page.evaluate(fn, arg);
  const click = async (loc) => { if (await loc.count()) { await loc.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(250); } };
  const btn = (name) => click(page.getByRole("button", { name, exact: typeof name === "string" }));

  await page.goto(base + "?seed=overflow");
  await page.evaluate(() => localStorage.clear());
  // A veteran profile: abacus and difficulties unlocked, every codex entry seen, every client at high favour,
  // so the longest texts a returning player can see get checked too.
  await page.evaluate(async () => {
    const [E, G, R, C, A, O, T] = await Promise.all(["enemies", "goods", "relics", "codex", "achievements", "orders", "town"].map((m) => import(`/src/data/${m}.ts`)));
    const ens = E.ENEMIES, goods = G.GOODS, relics = R.RELICS, chars = C.CHARACTERS, achs = A.ACHIEVEMENTS, orders = O.ORDERS;
    const codex = [...Object.keys(ens).map((k) => "e:" + k), ...Object.keys(goods).map((k) => "g:" + k), ...Object.keys(relics ?? {}).map((k) => "r:" + k), ...chars.map((c) => "c:" + c.id)];
    const favor = {}; for (const id of Object.keys(orders)) favor[id] = T.MAX_FAVOR; for (const c of chars) favor[c.id] = T.MAX_FAVOR;
    localStorage.setItem("seal-tower.v2.profile", JSON.stringify({ renown: 20, runs: 12, wins: 4, bestFloor: 3, ordersDone: [], seenTips: [], achievements: achs.map((a) => a.id), treasury: 999, upgrades: {}, favor, codex, daily: null, sound: false }));
  });
  await page.reload();
  await page.waitForSelector(".title-screen");
  await check("title");
  await btn("怎么玩"); await check("help"); await S(() => { window.__seal.page.value = "title"; });
  await S(() => { window.__seal.page.value = "achievements"; }); await check("achievements");
  await S(() => { window.__seal.page.value = "codex"; }); await page.waitForTimeout(300);
  for (const tab of await page.locator(".codex-head .town-tabs button").all()) {
    await tab.click().catch(() => {}); await page.waitForTimeout(200);
    const entries = page.locator(".codex-cell");
    const n = await entries.count();
    for (let i = 0; i < n; i++) { await entries.nth(i).click().catch(() => {}); await check("codex"); }
  }
  await S(() => { window.__seal.page.value = "town"; }); await page.waitForTimeout(300);
  for (const card of await page.locator(".order-card").all()) { await card.click().catch(() => {}); await check("town orders"); }
  for (const card of await page.locator(".weapon-card").all()) { await card.click({ force: true }).catch(() => {}); await check("town weapons"); }
  await btn("营建铺子"); await check("town build"); await btn("接单出发");
  await btn("进塔");
  await page.waitForSelector(".explore");
  await check("explore tip");
  await click(page.getByRole("button", { name: "知道了" }));
  await click(page.locator(".omen-card .btn"));
  await check("explore");
  await S(() => { window.__seal.overlay.value = "bag"; }); await check("bag"); await S(() => { window.__seal.overlay.value = "deck"; }); await check("deck");
  await S(() => { window.__seal.overlay.value = null; });

  const { enemies, events } = await S(async () => {
    const [E, V] = await Promise.all([import("/src/data/enemies.ts"), import("/src/data/events.ts")]);
    const evs = V.EVENTS ?? Object.values(V).find((v) => v && typeof v === "object" && v.fakefox);
    return { enemies: Object.keys(E.ENEMIES), events: Object.keys(evs) };
  });
  const reset = () => S(() => { const r = window.__seal.runSig.value; r.screen = "explore"; r.combat = null; r.at = null; r.hp = r.maxHp; r.dungeon.entities = r.dungeon.entities.filter((e) => e.id < 9000); window.__seal.commit(); });
  for (const id of enemies) {
    await S((id) => window.__seal.fight(id), id);
    await page.waitForTimeout(300);
    await click(page.getByRole("button", { name: "知道了" }));
    await check(`fight ${id}`);
    await reset();
  }
  for (const id of events) {
    // A crammed bag, so results that hand out goods show the "didn't fit" bag panel too.
    await S(async () => {
      const inv = await import("/src/game/inventory.ts");
      const r = window.__seal.runSig.value; r.floor = 3; r.gold = 99;
      for (let i = 0; i < 24; i++) inv.addGood(r, ["ash", "fang", "silk", "clasp", "copper"][i % 5]);
      window.__seal.commit();
    });
    await S((id) => window.__seal.event(id), id);
    await check(`event ${id}`);
    await click(page.locator(".option:not(.locked)"));
    await check(`event ${id} result`);
    await reset();
  }
  for (const kind of ["shop", "rest", "chest"]) { await S((k) => window.__seal.fight("", k), kind); await check(kind); await reset(); }
  // Reward: win a fight quickly.
  await S(() => window.__seal.fight("moth"));
  for (let t = 0; t < 8 && (await S(() => window.__seal.runSig.value.screen)) === "combat"; t++) {
    await S(() => { const c = window.__seal.runSig.value.combat; if (c) { c.enemy.hp = 1; window.__seal.commit(); } });
    for (let i = 0; i < 5; i++) await click(page.locator(".hand .card:not(.disabled)"));
    if ((await S(() => window.__seal.runSig.value.screen)) === "combat") await btn(/结束回合/);
  }
  await check("reward");
  await S(() => { window.__seal.overlay.value = "bag"; }); await check("reward bag"); await S(() => { window.__seal.overlay.value = null; });
  await S(async () => { const R = await import("/src/game/run.ts"); const r = window.__seal.runSig.value; r.screen = "explore"; r.combat = null; R.goHome(r); window.__seal.commit(); });
  await check("result");
  // A winning run lists every new achievement; pad the list so the buttons must survive a very long settlement.
  await S(() => { const ul = document.querySelector(".result-box ul.renown"); for (let i = 0; i < 15 && ul; i++) { const li = document.createElement("li"); li.className = "ach"; li.textContent = "新成就「测试」：一段足够长的成就说明文字，用来把结算列表撑高。 +1"; ul.appendChild(li); } });
  await check("result (long)");
  report[vpName] = { issues: issues.map(({ key, ...i }) => i), errors };
  console.log(vpName, issues.length, "issues", errors.length, "errors");
  for (const i of issues) console.log(`  [${i.kind} ${i.px}px] ${i.box} «${i.text}» @ ${i.where.slice(0, 4).join(", ")}${i.where.length > 4 ? ` (+${i.where.length - 4})` : ""}`);
  await page.close();
}

// ONLY=phone-short (comma-separated) runs just those viewports.
const only = process.env.ONLY?.split(",");
const VIEWPORTS = [["desktop", { width: 1280, height: 720 }], ["portrait", { width: 390, height: 844 }],
  ["phone-short", { width: 390, height: 664 }]]; // phone-short: iPhone Safari/Chrome visible area inside the ModelScope mobile page
for (const [n, vp] of VIEWPORTS) if (!only || only.includes(n)) await run(n, vp);
await writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
await browser.close();
await server.close();
process.exit(Object.values(report).every((r) => !r.issues.length && !r.errors.length) ? 0 : 1);
