// node tests/goods-art-view-check.mjs [output-directory] [dev|offline] [goods IDs...]
// Use fixed inventory and shop stock to show the same objects in both scenes.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const [out = ".cache/goods-art-view", mode = "dev", ...selected] = process.argv.slice(2);
assert.ok(["dev", "offline"].includes(mode), "use dev or offline mode");
const changed = [
  "inkdust", "rubbing", "tail", "oilpot", "redpaper", "fur", "pearl",
  "token", "shard", "feather", "whetstone", "amulet", "luckybag", "wardcharm",
];
const ids = selected.length ? selected : changed;
assert.ok(ids.every(id => changed.includes(id)), "choose ART-014 goods IDs");
const root = fileURLToPath(new URL("../", import.meta.url));
const disk = JSON.parse(await readFile(new URL("../art/exports.json", import.meta.url), "utf8"));
await mkdir(out, { recursive: true });
const server = await createServer({ root, server: { port: 0, host: "127.0.0.1", watch: null }, logLevel: "error" });
const offline = mode === "offline";
let browser;
try {
  await server.listen();
  const base = offline ? new URL("../dist-offline/index.html", import.meta.url).href : server.resolvedUrls.local[0];
  const [{ createRun, openEntity }, { addGood }, { GOODS }] = await Promise.all(
    ["game/run", "game/inventory", "data/goods"].map(path => server.ssrLoadModule("/src/" + path + ".ts")),
  );
  const run = createRun(1414, "shield", ["lamp"], 0, { upgrades: { bagsmith: 1 } });
  run.bag.items = [];
  run.omenSeen = true;
  run.gold = 80;
  for (const id of ["ash", "purse", ...ids]) {
    assert.equal(addGood(run, id), true, "cannot place " + id);
  }

  const shopRun = structuredClone(run);
  const shopEntity = shopRun.dungeon.entities.find(entity => entity.kind === "shop");
  assert.ok(shopEntity);
  openEntity(shopRun, shopEntity);
  shopRun.shop.gear = ids.filter(id => GOODS[id].kind === "gear")
    .map(id => ({ id, price: GOODS[id].price, sold: false }));
  const goods = ids.filter(id => GOODS[id].kind === "goods");
  if (goods.length) shopRun.shop.wanted = goods[0];

  browser = await chromium.launch({ channel: "chrome", headless: true });
  const report = {};
  for (const [name, options] of Object.entries({
    desktop: { viewport: { width: 1280, height: 720 } },
    phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  })) {
    const context = await browser.newContext({ ...options, reducedMotion: "reduce", offline });
    try {
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.goto(base);
      await page.locator(".title-screen").waitFor();
      const show = (state, overlay) => page.evaluate(({ state, overlay }) => {
        const game = window.__seal;
        game.runSig.value = state;
        game.page.value = "game";
        game.overlay.value = overlay;
        game.commit();
      }, { state, overlay });

      async function readIcon(locator, id) {
        const icon = await locator.evaluate(async image => {
          await image.decode();
          const bounds = image.getBoundingClientRect();
          return { src: image.currentSrc, size: [image.naturalWidth, image.naturalHeight], box: [bounds.width, bounds.height] };
        });
        const asset = GOODS[id].icon;
        if (offline) {
          assert.ok(icon.src.startsWith("data:image/webp"));
          icon.sha256 = createHash("sha256").update(Buffer.from(icon.src.split(",")[1], "base64")).digest("hex");
          assert.equal(icon.sha256, disk[asset].webpSha256);
          icon.src = "embedded";
        } else {
          assert.ok(icon.src.endsWith("/" + asset + ".webp"), icon.src);
        }
        assert.ok(icon.box.every(value => value > 0));
        assert.equal(Math.max(...icon.size), 128, asset);
        return icon;
      }

      await show(run, "bag");
      const bag = {};
      const bagPanel = page.locator(".bag-box");
      for (const id of ids) {
        bag[id] = await readIcon(bagPanel.getByRole("img", { name: GOODS[id].name, exact: true }), id);
      }
      await page.screenshot({ path: out + "/" + name + "-bag.jpg", quality: 90 });

      await show(shopRun, null);
      const sellGrid = page.locator(".shop-sell .bag-grid");
      const marketBoard = page.locator(".market-board");
      const gearShelf = page.locator(".shop-row .wares.items").first();
      const sell = {};
      const market = {};
      const wares = {};
      for (const id of ids) {
        sell[id] = await readIcon(sellGrid.getByRole("img", { name: GOODS[id].name, exact: true }), id);
      }
      for (const id of goods) {
        const row = marketBoard.locator("li").filter({ has: page.getByText(GOODS[id].name, { exact: true }) });
        market[id] = await readIcon(row.locator("img"), id);
      }
      for (const { id } of shopRun.shop.gear) {
        const card = gearShelf.locator(".item-ware").filter({ has: page.getByText(GOODS[id].name, { exact: true }) });
        wares[id] = await readIcon(card.locator("img"), id);
      }
      await page.waitForFunction(() => !document.getAnimations().some(animation =>
        animation.playState === "running" && animation.effect?.getTiming().iterations !== Infinity));
      for (const [label, locator] of Object.entries({ sell: sellGrid, market: marketBoard, wares: gearShelf })) {
        await locator.screenshot({ path: out + "/" + name + "-" + label + ".jpg", quality: 90 });
      }
      assert.deepEqual(errors, []);
      report[name] = { ...options, bag, sell, market, wares, errors };
    } finally {
      await context.close();
    }
  }
  const result = { mode, seed: 1414, fixture: "inventory and shop seeded for art repeatability", report };
  await writeFile(out + "/runtime.json", JSON.stringify(result, null, 2) + "\n");
  console.log("goods art:", ids.length, "assets verified across bag and shop in desktop and touch viewports");
} finally {
  await browser?.close();
  await server.close();
}
