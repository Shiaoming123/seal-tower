// QA-001: does each item's picture match the cells it occupies in the bag?
// For every good in every rotation, puts it alone in a large bag, opens the real bag overlay, reads the <img>'s own
// layout box and computed CSS transform, redraws the picture onto a canvas exactly that way, and measures how much
// of each cell the opaque pixels cover. Reports:
//   empty  — a cell the item occupies that the picture barely touches (looks like a free cell, e.g. 竹柄钩's corner)
//   spill  — a cell inside the item's box it does NOT occupy that the picture covers a lot (looks occupied, isn't)
//   out    — a big share of the picture outside the item's box (paints over neighbours)
// Also checks that the gold reach cells an accessory shows are see-through on plain and sewn (irregular) bags, so
// they never hide the items under them (磨刀石 on a sewn bag).
// Usage: node tests/bag-art-check.mjs   (starts its own Vite dev server; needs system Chrome). Exit code 1 on issues.
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

// Thin pictures (照影剑, 墨壳) legitimately cover only a sliver of their end cells, hence the low EMPTY bar.
const EMPTY = 0.03, SPILL = 0.22, OUT = 0.2;
const server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)), server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
// Measure the settled layout: entrance animations and transitions (UI-011) would catch elements mid-slide.
await page.addInitScript(() => {
  const css = "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; }";
  const add = () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); };
  if (document.head) add(); else document.addEventListener("DOMContentLoaded", add);
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "?seed=bagart");
await page.waitForFunction(() => !!window.__seal);

const result = await page.evaluate(async ({ EMPTY, SPILL, OUT }) => {
  const S = window.__seal;
  const [G, R, B] = await Promise.all(["/src/data/goods.ts", "/src/game/run.ts", "/src/game/bag.ts"].map((m) => import(m)));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const issues = [];
  const ids = Object.keys(G.GOODS);
  for (const id of ids) {
    const shape0 = G.GOODS[id].shape;
    // Rotations that give a different footprint (a 1×1 or a square only needs one).
    const rots = shape0.length === 1 || (shape0.length === 4 && B.sizeOf(id, 0).w === 2 && B.sizeOf(id, 0).h === 2) ? [0] : [0, 1, 2, 3];
    for (const rot of rots) {
      const run = R.createRun(1, "sword", "lamp");
      run.omenSeen = true;
      run.bag = { w: 8, h: 7, items: [{ uid: 1, id, x: 2, y: 2, rot }] };
      S.runSig.value = run; S.page.value = "game"; S.overlay.value = "bag"; S.commit();
      await wait(60);
      const itemEl = document.querySelector(".bag-box .bag-grid .item");
      const img = itemEl?.querySelector("img.item-img");
      if (!img) { issues.push({ id, rot, kind: "missing", note: "no item picture rendered" }); continue; }
      if (!img.complete || !img.naturalWidth) await new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 1500); });
      if (!img.naturalWidth) { issues.push({ id, rot, kind: "missing", note: "picture failed to load" }); continue; }
      const size = B.sizeOf(id, rot);
      const cell = itemEl.offsetWidth / size.w;
      const margin = Math.ceil(cell);
      const cv = document.createElement("canvas");
      cv.width = Math.round(size.w * cell + 2 * margin); cv.height = Math.round(size.h * cell + 2 * margin);
      const ctx = cv.getContext("2d");
      const cs = getComputedStyle(img);
      const m = new DOMMatrix(cs.transform === "none" ? undefined : cs.transform);
      const [ox, oy] = cs.transformOrigin.split(" ").map(parseFloat);
      const L = img.offsetLeft, T = img.offsetTop;
      const pl = parseFloat(cs.paddingLeft), pt = parseFloat(cs.paddingTop);
      const cw = img.clientWidth - pl - parseFloat(cs.paddingRight), ch = img.clientHeight - pt - parseFloat(cs.paddingBottom);
      const k = Math.min(cw / img.naturalWidth, ch / img.naturalHeight); // object-fit: contain
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      ctx.setTransform(1, 0, 0, 1, margin + L + ox, margin + T + oy);
      ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
      ctx.translate(-ox, -oy);
      const flip = cs.scale && cs.scale !== "none" ? cs.scale.split(" ").map(parseFloat) : [1, 1];
      ctx.translate(pl + cw / 2, pt + ch / 2); ctx.scale(flip[0], flip[1] ?? flip[0]); ctx.translate(-(pl + cw / 2), -(pt + ch / 2));
      ctx.drawImage(img, pl + (cw - dw) / 2, pt + (ch - dh) / 2, dw, dh);
      const data = ctx.getImageData(0, 0, cv.width, cv.height).data;
      const opaque = (x, y) => data[(y * cv.width + x) * 4 + 3] > 40;
      let total = 0, inside = 0;
      const per = Array.from({ length: size.h }, () => new Array(size.w).fill(0));
      for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
        if (!opaque(x, y)) continue;
        total++;
        const cx = Math.floor((x - margin) / cell), cy = Math.floor((y - margin) / cell);
        if (cx >= 0 && cy >= 0 && cx < size.w && cy < size.h) { inside++; per[cy][cx]++; }
      }
      const owned = new Set(B.shapeOf(id, rot).map(([x, y]) => `${x},${y}`));
      const area = cell * cell;
      for (let cy = 0; cy < size.h; cy++) for (let cx = 0; cx < size.w; cx++) {
        const cover = per[cy][cx] / area;
        if (owned.has(`${cx},${cy}`) && cover < EMPTY) issues.push({ id, rot, kind: "empty", note: `occupied cell ${cx},${cy} is ${Math.round(cover * 100)}% covered` });
        if (!owned.has(`${cx},${cy}`) && cover > SPILL) issues.push({ id, rot, kind: "spill", note: `free cell ${cx},${cy} is ${Math.round(cover * 100)}% covered` });
      }
      if (total && (total - inside) / total > OUT) issues.push({ id, rot, kind: "out", note: `${Math.round(((total - inside) / total) * 100)}% of the picture is outside the item's box` });
    }
  }

  // Reach cells of an accessory, on a plain and on a sewn bag: they sit above the items, so they must be see-through.
  for (const sewn of [false, true]) {
    const run = R.createRun(1, "sword", "lamp");
    run.omenSeen = true;
    run.bag = { w: 6, h: 5, holes: sewn ? [5] : undefined, items: [{ uid: 1, id: "whetstone", x: 2, y: 2, rot: 0 }, { uid: 2, id: "ash", x: 3, y: 2, rot: 0 }] };
    S.runSig.value = run; S.overlay.value = "bag"; S.commit();
    await wait(80);
    document.querySelector(".bag-box .bag-grid .item")?.click();
    await wait(80);
    const reach = [...document.querySelectorAll(".bag-box .bag-grid .cell.reach")];
    if (!reach.length) issues.push({ id: "whetstone", rot: 0, kind: "reach", note: `${sewn ? "sewn" : "plain"} bag: no reach cells shown when the accessory is selected` });
    for (const c of reach) {
      const bg = getComputedStyle(c).backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 1];
      const alpha = bg.length > 3 ? bg[3] : 1;
      if (alpha > 0.5) { issues.push({ id: "whetstone", rot: 0, kind: "reach", note: `${sewn ? "sewn" : "plain"} bag: reach cell background is ${Math.round(alpha * 100)}% opaque and hides the items under it` }); break; }
    }
  }
  S.overlay.value = null;
  return { issues, checked: ids.length };
}, { EMPTY, SPILL, OUT });

console.log(`bag art: ${result.checked} goods checked, ${result.issues.length} issues, ${errors.length} page errors`);
for (const i of result.issues) console.log(`  [${i.kind}] ${i.id} rot ${i.rot}: ${i.note}`);
for (const e of errors) console.log("  page error:", e);
await browser.close();
await server.close();
process.exit(result.issues.length || errors.length ? 1 : 0);
