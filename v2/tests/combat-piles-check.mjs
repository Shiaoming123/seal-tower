import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const out = process.argv[2] ?? ".cache/combat-piles";
await mkdir(out, { recursive: true });
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  server: { host: "127.0.0.1", port: 0 }, logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const snapshot = page => page.evaluate(() => {
  const { combat } = window.__seal.runSig.value;
  const { draw, discard, exhaust, hand, turn, energy } = combat;
  return { draw, discard, exhaust, hand, turn, energy };
});

try {
  for (const phone of [false, true]) {
    const page = await browser.newPage({
      viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 720 },
      isMobile: phone, hasTouch: phone, reducedMotion: "reduce",
    });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto(server.resolvedUrls.local[0]);
    await page.waitForFunction(() => !!window.__seal);
    await page.evaluate(async () => {
      const R = await import("/src/game/run.ts");
      const run = R.createRun(47, "shield", ["lamp"]);
      run.omenSeen = true;
      R.openEntity(run, run.dungeon.entities.find(e => e.kind === "fight"));
      // A controlled opening hand exercises both card destinations through real play.
      run.combat.hand = [{ uid: 910, id: "defend", up: false }, { uid: 911, id: "bandage", up: true }];
      run.combat.draw = Array.from({ length: 18 }, (_, i) => ({
        uid: 920 + i, id: i % 2 ? "strike" : "defend", up: i === 1, ...(i === 1 ? { bonus: { dmg: 2 } } : {}),
      }));
      const state = window.__seal;
      state.runSig.value = run;
      state.page.value = "game";
      state.commit();
    });
    const prompt = page.locator(".combat-tip button");
    if (await prompt.isVisible()) await prompt.click();
    await page.locator(".enemy-head").waitFor({ state: "visible" });
    const trigger = id => page.locator(`[data-combat-pile="${id}"]`);
    const dialog = page.getByRole("dialog");
    const initial = await snapshot(page);
    await page.screenshot({ path: out + (phone ? "/phone-combat.jpg" : "/desktop-combat.jpg"), quality: 91 });
    assert.match(await trigger("draw").innerText(), /18/);
    assert.match(await trigger("discard").innerText(), /0/);
    assert.match(await trigger("exhaust").innerText(), /0/);
    await trigger("draw").click();
    await dialog.waitFor();
    const names = await dialog.locator(".card .name").allTextContents();
    assert.deepEqual(names, [...Array(9).fill("架"), "斩+", ...Array(8).fill("斩")]);
    assert.equal(await dialog.locator(".card .bonus-tag").textContent(), "伤害 +2");
    assert.equal(await dialog.locator("button.card").count(), 0);
    await dialog.locator(".card").first().click();
    await page.keyboard.press("1");
    await page.keyboard.press("e");
    assert.deepEqual(await snapshot(page), initial);
    await dialog.locator(".pile-scroll").evaluate(el => { el.scrollTop = el.scrollHeight; });
    assert.ok(await dialog.locator(".pile-scroll").evaluate(el => el.scrollTop > 0));
    await page.screenshot({ path: out + (phone ? "/phone-draw.jpg" : "/desktop-draw.jpg"), quality: 91 });
    await dialog.getByRole("button", { name: /弃牌堆 0/ }).click();
    await dialog.getByText("这个牌堆现在是空的。").waitFor();
    await dialog.getByRole("button", { name: /消耗牌堆 0/ }).click();
    await dialog.getByText("这个牌堆现在是空的。").waitFor();
    if (phone) await dialog.getByRole("button", { name: /关闭/ }).tap();
    else {
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.activeElement?.getAttribute("data-combat-pile") === "draw");
    }
    await dialog.waitFor({ state: "hidden" });
    await page.keyboard.press("9");

    // Combat hotkeys resume after closing, even on a touch-sized viewport with a keyboard attached.
    await page.keyboard.press("1");
    await page.waitForFunction(() => window.__seal.runSig.value.combat.discard.length === 1);
    await page.waitForTimeout(650);
    await page.keyboard.press("1");
    await page.waitForFunction(() => window.__seal.runSig.value.combat.exhaust.length === 1);
    await trigger("discard").click();
    assert.deepEqual(await dialog.locator(".card .name").allTextContents(), ["架"]);
    await dialog.getByRole("button", { name: /消耗牌堆 1/ }).click();
    assert.deepEqual(await dialog.locator(".card .name").allTextContents(), ["包扎+"]);
    await page.screenshot({ path: out + (phone ? "/phone-exhaust.jpg" : "/desktop-exhaust.jpg"), quality: 91 });
    await dialog.getByRole("button", { name: /关闭/ }).click();
    // Empty the draw pile so the next real end-turn recycles the discard.
    await page.evaluate(() => {
      window.__seal.runSig.value.combat.draw = [];
      window.__seal.commit();
    });
    await trigger("draw").click();
    await dialog.getByText("这个牌堆现在是空的。").waitFor();
    await dialog.getByRole("button", { name: /关闭/ }).click();
    await page.locator(".end-turn").click();
    await page.waitForFunction(() => window.__seal.runSig.value.combat.turn === 2);
    await trigger("exhaust").click();
    assert.deepEqual(await dialog.locator(".card .name").allTextContents(), ["包扎+"]);
    assert.equal((await snapshot(page)).discard.length, 0);
    await page.evaluate(async () => {
      const R = await import("/src/game/run.ts");
      const state = window.__seal;
      const run = state.runSig.value;
      R.flee(run, R.fleeSpot(run));
      state.commit();
    });
    await page.locator(".combat").waitFor({ state: "hidden" });
    assert.equal(await dialog.count(), 0);
    await page.waitForFunction(() => !window.__seal.overlay.value && !document.querySelector(".main[inert]"));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log("Combat piles verified on desktop and 390px touch viewport.");
} finally {
  await browser.close();
  await server.close();
}
