// Portrait (390 and 360 wide): no visible element outside a clipping or scrolling box may end past the stage edge, on the
// main screens. overflow-check files every stage-edge clip under one entry, so this lists them one by one (UI-020).
// Usage: node tests/edge-sweep-check.mjs   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
const sweep = () => {
  const st = document.querySelector(".stage").getBoundingClientRect(); const out = new Map();
  for (const el of document.querySelectorAll(".stage *")) {
    const cs = getComputedStyle(el); if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
    let a = el.parentElement, scrollClip = false;
    for (; a && !a.classList.contains("stage"); a = a.parentElement) { const s2 = getComputedStyle(a); if (/auto|scroll|hidden|clip/.test(s2.overflowX + s2.overflow)) { scrollClip = true; break; } }
    if (scrollClip) continue; // inside a box that clips or scrolls on its own
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
    const over = Math.max(r.right - st.right, st.left - r.left);
    if (over > 2) { const k = el.tagName + "." + [...el.classList].slice(0, 2).join("."); if (!out.has(k)) out.set(k, Math.round(over)); }
  }
  return [...out].slice(0, 8).map(([k, v]) => `${k}+${v}`).join(" ");
};
const screens = {
  title: () => { __seal.page.value = "title"; },
  town: () => { __seal.page.value = "town"; },
  codex: () => { __seal.page.value = "codex"; },
  help: () => { __seal.page.value = "help"; },
  explore: async () => { const R = await import("/src/game/run.ts"); __seal.runSig.value = R.createRun(9, "sword", "lamp"); __seal.page.value = "game"; },
  bag: () => { __seal.overlay.value = "bag"; },
  deck: () => { __seal.overlay.value = "deck"; },
  combat: () => { __seal.overlay.value = null; __seal.fight("rat"); },
  shop: () => { const r = __seal.runSig.value; r.combat = null; r.at = null; r.screen = "explore"; __seal.commit(); setTimeout(() => __seal.fight("", "shop"), 100); },
  rest: () => { const r = __seal.runSig.value; r.at = null; r.screen = "explore"; __seal.commit(); setTimeout(() => __seal.fight("", "rest"), 100); },
  event: () => { const r = __seal.runSig.value; r.at = null; r.screen = "explore"; __seal.commit(); setTimeout(() => __seal.event("guide"), 100); },
};
for (const [name, vp] of [["portrait", { width: 390, height: 844 }], ["short", { width: 360, height: 640 }]]) {
  const page = await browser.newPage({ viewport: vp });
  await page.goto(server.resolvedUrls.local[0]); await page.waitForFunction(() => window.__seal);
  for (const [s, fn] of Object.entries(screens)) {
    await page.evaluate(`(${fn.toString()})()`); await page.waitForTimeout(700);
    const res = await page.evaluate(sweep);
    if (res) { bad++; console.log(name, s, "OUT:", res); await page.screenshot({ path: `.cache/edge-${name}-${s}.png` }); }
  }
  await page.close();
}
await browser.close(); await server.close();
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
