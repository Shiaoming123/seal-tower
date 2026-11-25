// Regression for scaled inventory drag, input cancellation, and matching preview/drop.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const out = process.argv[2] ?? ".cache/bag-drag";
await mkdir(out, { recursive: true });
const server = await createServer({
  root: fileURLToPath(new URL("../", import.meta.url)),
  server: { host: "127.0.0.1", port: 0 }, logLevel: "error",
});
await server.listen();
const browser = await chromium.launch({ channel: "chrome", headless: true });
const report = {};
const ash = { id: "ash", uid: 1001, x: 0, y: 0, rot: 0, n: 2 };
const shield = { id: "shield", uid: 1002, x: 0, y: 0, rot: 0 };

async function setUp(page, screen, items, pending = [], pouch = []) {
  await page.evaluate(async ({ screen, items, pending, pouch }) => {
    const R = await import("/src/game/run.ts");
    const run = R.createRun(47, "shield", ["lamp"]);
    run.omenSeen = true;
    run.bag.items = items;
    run.pending = pending;
    run.pouch = pouch;
    if (screen === "shop") R.openEntity(run, run.dungeon.entities.find(e => e.kind === "shop"));
    if (screen === "reward") {
      const enemy = run.dungeon.entities.find(e => e.kind === "fight");
      R.openEntity(run, enemy);
      R.winCombat(run);
    }
    const state = window.__seal;
    state.runSig.value = run;
    state.page.value = "game";
    state.overlay.value = screen === "bag" ? "bag" : null;
    state.commit();
  }, { screen, items, pending, pouch });
  const panel = page.locator({ bag: ".bag-box", shop: ".shop-sell", reward: ".reward-bag" }[screen]);
  await panel.waitFor();
  return { panel, grid: panel.locator(".bag-grid") };
}

function point(grid, x, y) {
  return grid.evaluate((el, { x, y }) => {
    const r = el.getBoundingClientRect();
    const size = parseFloat(el.style.getPropertyValue("--cell"));
    return {
      x: Math.round(r.left + (el.clientLeft + (x + 0.5) * size) * r.width / el.offsetWidth),
      y: Math.round(r.top + (el.clientTop + (y + 0.5) * size) * r.height / el.offsetHeight),
    };
  }, { x, y });
}

async function preview(grid, kind = "ok") {
  const marked = grid.locator(".preview." + kind);
  await marked.first().waitFor();
  return marked.evaluateAll(cells => cells.map(el => [parseFloat(el.style.left), parseFloat(el.style.top)]));
}

const inventory = page => page.evaluate(() => {
  const run = window.__seal.runSig.value;
  return { items: run.bag.items, pending: run.pending, pouch: run.pouch };
});

async function mouseDrag(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 3 });
  await page.locator(".drag-ghost").waitFor({ timeout: 3000 });
}

try {
  const page = await browser.newPage({ viewport: { width: 1024, height: 740 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => !!window.__seal);

  for (const screen of ["bag", "shop", "reward"]) {
    const { panel, grid } = await setUp(page, screen, [ash]);
    await panel.evaluate(el => {
      for (const animation of el.getAnimations()) {
        animation.pause();
        animation.currentTime = 175;
      }
    });
    await grid.scrollIntoViewIfNeeded();
    const target = await point(grid, 2, 1);
    const from = await point(grid, 0, 0);
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".item")?.className, from);
    assert.ok(hit, screen + " pointer should hit the first item at " + JSON.stringify(from));
    await mouseDrag(page, from, target);
    const ghost = await page.locator(".drag-ghost").boundingBox();
    const offset = [ghost.x + ghost.width / 2 - target.x, ghost.y + ghost.height / 2 - target.y];
    assert.ok(offset.every(px => Math.abs(px) < 2), screen + " offset " + JSON.stringify(offset));
    await preview(grid);
    await page.screenshot({ path: out + "/" + screen + "-drag.jpg", quality: 90 });
    await page.mouse.up();
    await page.locator(".drag-ghost").waitFor({ state: "hidden" });
    const result = (await inventory(page)).items.find(item => item.uid === ash.uid);
    assert.deepEqual([result.x, result.y], [2, 1]);
    await panel.evaluate(el => el.getAnimations().forEach(animation => animation.finish()));
    report[screen] = { offset, landed: [result.x, result.y] };
    if (screen === "shop") {
      const stack = grid.locator(".item").first();
      await stack.click();
      assert.equal((await inventory(page)).items[0].n, 2);
      await stack.click();
      assert.equal((await inventory(page)).items[0].n ?? 1, 1);
      report.shop.twoTapSale = true;
    }
  }

  let { panel, grid } = await setUp(page, "bag", [shield]);
  await mouseDrag(page, await point(grid, 1, 0), await point(grid, 4, 2));
  assert.deepEqual(await preview(grid), [[192, 128], [256, 128]]);
  await page.keyboard.press("r");
  assert.deepEqual(await preview(grid), [[256, 64], [256, 128]]);
  await page.mouse.up();
  let item = (await inventory(page)).items[0];
  assert.deepEqual([item.x, item.y, item.rot], [4, 1, 1]);

  const secondShield = { ...shield, uid: 1003, x: 2 };
  ({ panel, grid } = await setUp(page, "bag", [shield, secondShield]));
  await grid.locator(".item").first().click();
  await grid.locator(".item").nth(1).click({ button: "right" });
  assert.deepEqual((await inventory(page)).items.map(it => it.rot), [0, 1]);

  ({ panel, grid } = await setUp(page, "bag", [shield]));
  const start = await point(grid, 1, 0);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  const target = await point(grid, 4, 2);
  await page.mouse.move(target.x, target.y);
  await page.locator(".drag-ghost").waitFor();
  await page.mouse.up();
  item = (await inventory(page)).items[0];
  assert.deepEqual([item.x, item.y, item.rot], [4, 1, 1]);

  ({ panel, grid } = await setUp(page, "bag", [ash, { ...ash, uid: 1002, x: 2, y: 1 }]));
  await mouseDrag(page, await point(grid, 0, 0), await point(grid, 2, 1));
  await preview(grid);
  await page.mouse.up();
  assert.deepEqual((await inventory(page)).items.map(x => x.n), [4]);
  ({ panel, grid } = await setUp(page, "bag", [ash, { ...ash, uid: 1002, x: 2, y: 1, n: 4 }]));
  await mouseDrag(page, await point(grid, 0, 0), await point(grid, 2, 1));
  await preview(grid, "bad");
  await page.mouse.up();
  assert.equal((await inventory(page)).items.length, 2);

  ({ panel, grid } = await setUp(page, "bag", [ash], ["silk"], ["redpaper"]));
  await mouseDrag(page, await point(grid, 0, 0), { x: 5, y: 200 });
  await page.mouse.up();
  await panel.waitFor();
  assert.deepEqual((await inventory(page)).items, [ash]);
  await mouseDrag(page, await point(grid, 0, 0), await point(grid, 2, 1));
  await page.keyboard.press("Escape");
  await page.locator(".drag-ghost").waitFor({ state: "hidden" });
  await page.mouse.up();
  assert.deepEqual((await inventory(page)).items, [ash]);

  const sourcePoint = async selector => {
    const source = panel.locator(selector).first();
    await source.scrollIntoViewIfNeeded();
    const r = await source.boundingBox();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  };
  await mouseDrag(page, await sourcePoint(".pouch-slot:not(.empty)"), await point(grid, 2, 1));
  await page.mouse.up();
  assert.deepEqual((await inventory(page)).pouch, []);
  await mouseDrag(page, await sourcePoint(".pending-item"), await point(grid, 3, 1));
  await page.mouse.up();
  assert.deepEqual((await inventory(page)).pending, []);
  assert.ok((await inventory(page)).items.some(x => x.id === "silk" && x.x === 3 && x.y === 1));
  assert.deepEqual(errors, []);
  report.desktopInteractions = ["grab second cell", "rotate", "right-click item", "rotate before movement", "merge", "full stack", "outside", "escape", "pouch", "pending"];

  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await phone.goto(server.resolvedUrls.local[0]);
  await phone.waitForFunction(() => !!window.__seal);
  ({ grid } = await setUp(phone, "bag", [ash]));
  const input = await phone.context().newCDPSession(phone);
  const touch = async type => input.send("Input.dispatchTouchEvent", {
    type, touchPoints: type === "touchStart" ? [{ ...await point(grid, 0, 0), id: 1 }]
      : type === "touchMove" ? [{ ...await point(grid, 2, 1), id: 1 }] : [],
  });
  await touch("touchStart");
  await touch("touchMove");
  await phone.locator(".drag-ghost").waitFor();
  await touch("touchCancel");
  await phone.locator(".drag-ghost").waitFor({ state: "hidden" });
  assert.deepEqual((await inventory(phone)).items, [ash]);
  await touch("touchStart");
  await touch("touchMove");
  await phone.locator(".drag-ghost").waitFor();
  await touch("touchEnd");
  item = (await inventory(phone)).items[0];
  assert.deepEqual([item.x, item.y], [2, 1]);
  report.phone = { width: 390, cancelledWithoutMoving: true, landed: [item.x, item.y] };
  await writeFile(out + "/report.json", JSON.stringify(report, null, 2) + "\n");
  console.log("Bag drag verified: 3 surfaces, rotation and stack previews, cancellation, pouch, pile, and touch.");
} finally {
  await browser.close();
  await server.close();
}
