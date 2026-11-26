// Hands of 5, 7 and 8 cards stay on screen, leave the 「结束回合会挨」 line visible (REVIEW-003), and the first card
// takes taps on its lower-left corner instead of the player panel (UI-020).
// Usage: node tests/hand-fit-check.mjs   (starts its own Vite dev server; needs system Chrome)
import { chromium } from "playwright-core";
import { createServer } from "vite";
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
let bad = 0;
for (const [name, vp] of [["portrait", { width: 390, height: 844 }], ["short", { width: 360, height: 640 }], ["desktop", { width: 1280, height: 720 }]]) {
  for (const n of [5, 7, 8]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(server.resolvedUrls.local[0]); await page.waitForFunction(() => window.__seal);
    await page.evaluate(async (n) => {
      const S = await import("/src/ui/store.ts"); ["move", "combat", "steal", "charge", "part"].forEach((t) => S.markTip(t));
      const { TERMS } = await import("/src/data/glossary.ts"); Object.keys(TERMS).forEach((t) => S.markTip(`term:${t}`));
      const R = await import("/src/game/run.ts"); __seal.runSig.value = R.createRun(9, "lamp", "lamp"); __seal.page.value = "game";
      await new Promise((r) => setTimeout(r, 300));
      __seal.fight("rat");
      await new Promise((r) => setTimeout(r, 300));
      const c = __seal.runSig.value.combat; const ids = ["strike", "defend", "flame", "dust", "strike", "defend", "flame", "dust"];
      c.hand = ids.slice(0, n).map((id, i) => ({ uid: 900 + i, id, up: false })); __seal.commit();
    }, n);
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => {
      const inc = document.querySelector(".incoming"); const rc = inc.getBoundingClientRect();
      // The player panel ignores pointer events (UI-019), so hit-testing can't see it. Check geometry instead: the line is
      // visible if no hand card overlaps it, or the panel is stacked above the hand.
      const z = (sel) => +getComputedStyle(document.querySelector(sel)).zIndex || 0;
      const above = z(".player-panel") > z(".hand");
      const overlaps = [...document.querySelectorAll(".hand-slot")].some((h) => { const r = h.getBoundingClientRect(); return r.left < rc.right && r.right > rc.left && r.top < rc.bottom && r.bottom > rc.top; });
      const hit = above || !overlaps ? inc : document.querySelector(".hand-slot");
      const cards = [...document.querySelectorAll(".hand-slot")].map((e) => e.getBoundingClientRect());
      const minX = Math.min(...cards.map((c) => c.left)), maxX = Math.max(...cards.map((c) => c.right));
      // The first card's lower-left part must take the tap, not the player panel (review of UI-019).
      const first = document.querySelector(".hand-slot").getBoundingClientRect();
      const corner = document.elementFromPoint(first.left + first.width * 0.3, first.top + first.height * 0.7); // inside the rotated card
      const firstTappable = !!corner?.closest(".hand");
      return { firstTappable, incomingVisible: inc.contains(hit), hitBy: hit?.className?.slice?.(0, 30), minX: Math.round(minX), maxX: Math.round(maxX), vw: innerWidth };
    });
    const ok = r.incomingVisible && r.firstTappable && r.minX >= -2 && r.maxX <= r.vw + 2;
    console.log(name, n, ok ? "ok" : "BAD", JSON.stringify(r)); if (!ok) bad++;
    await page.screenshot({ path: `.cache/hand-${name}-${n}.png` });
    await page.close();
  }
}
await browser.close(); await server.close();
console.log(bad ? `FAIL ${bad}` : "PASS"); process.exit(bad ? 1 : 0);
