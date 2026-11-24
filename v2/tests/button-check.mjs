// QA-001: dead buttons. On each main screen, every enabled button is clicked once from the same starting state; a
// button is "dead" if neither the page (DOM) nor the run state changes within half a second. Idea from PlayGoblin
// (click each enabled button once; nothing observable within a second means dead). The state is restored before
// every click, so one button can't hide another.
// Usage: node tests/button-check.mjs   (starts its own Vite dev server; needs system Chrome). Exit code 1 on issues.
import { chromium } from "playwright-core";
import { createServer } from "vite";

const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await page.addInitScript(() => {
  const css = "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; }";
  const add = () => { const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st); };
  if (document.head) add(); else document.addEventListener("DOMContentLoaded", add);
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(base + "?seed=buttons");
await page.waitForFunction(() => !!window.__seal);

// Screens to visit: how to get there from a fresh run (run in the page).
const SCREENS = {
  explore: "",
  combat: "S.fight('moth')",
  shop: "S.fight('', 'shop')",
  rest: "S.fight('', 'rest')",
  event: "S.event('purse')",
  reward: "S.fight('moth'); const c = S.runSig.value.combat; c.enemy.hp = 0; c.over = 'win'; R.winCombat(S.runSig.value); S.commit();",
};

const issues = [];
for (const [screen, setup] of Object.entries(SCREENS)) {
  // Build the screen once and keep a snapshot of the run to restore before every click.
  const count = await page.evaluate(async ({ setup }) => {
    const S = window.__seal;
    const R = await import("/src/game/run.ts");
    const inv = await import("/src/game/inventory.ts");
    const run = R.createRun(31, "sword", "lamp");
    run.omenSeen = true; run.gold = 150;
    for (const id of ["ash", "ash", "fang", "salve"]) inv.addGood(run, id);
    S.runSig.value = run; S.page.value = "game"; S.overlay.value = null; S.commit();
    await new Promise((r) => setTimeout(r, 200));
    // eslint-disable-next-line no-eval
    eval(setup);
    await new Promise((r) => setTimeout(r, 300));
    for (const b of document.querySelectorAll(".tip button, .omen-card .btn")) b.click(); // dismiss first-time tips
    await new Promise((r) => setTimeout(r, 150));
    window.__snap = JSON.stringify(S.runSig.value);
    window.__overlay = S.overlay.value;
    return document.querySelectorAll(".stage button:not([disabled])").length;
  }, { setup });
  for (let i = 0; i < count; i++) {
    const res = await page.evaluate(async (i) => {
      const S = window.__seal;
      S.runSig.value = JSON.parse(window.__snap); S.overlay.value = window.__overlay; S.commit();
      await new Promise((r) => setTimeout(r, 120));
      const btns = [...document.querySelectorAll(".stage button:not([disabled])")];
      const b = btns[i];
      if (!b) return null;
      const label = (b.textContent || b.getAttribute("aria-label") || b.className).trim().slice(0, 24);
      const dom0 = document.querySelector(".stage").innerHTML, run0 = JSON.stringify(S.runSig.value), ov0 = S.overlay.value, page0 = S.page.value;
      b.click();
      await new Promise((r) => setTimeout(r, 500));
      const changed = document.querySelector(".stage").innerHTML !== dom0 || JSON.stringify(S.runSig.value) !== run0 || S.overlay.value !== ov0 || S.page.value !== page0;
      return { label, changed };
    }, i);
    if (res && !res.changed) issues.push(`${screen}: 「${res.label}」 does nothing`);
  }
}

console.log(`buttons: ${issues.length} dead, ${errors.length} page errors`);
for (const i of issues) console.log("  " + i);
for (const e of errors.slice(0, 5)) console.log("  page error:", e);
await browser.close();
await server.close();
process.exit(issues.length || errors.length ? 1 : 0);
