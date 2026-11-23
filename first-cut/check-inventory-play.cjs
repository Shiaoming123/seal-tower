/* Run from any directory. This test only uses normal game controls and the rendered DOM. */
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { parseArgs } = require("node:util");

const root = path.resolve(__dirname, "..");
const { values } = parseArgs({ options: {
  bundle: { type: "string" },
  out: { type: "string" },
  device: { type: "string", default: "all" },
  flow: { type: "string", default: "all" },
  help: { type: "boolean" }
} });
const bundle = path.resolve(values.bundle || path.join(root, "evidence/一印两价/一印两价.html"));
const out = path.resolve(values.out || path.join(root, "evidence/展柜与行囊/实操"));
const fileURL = pathToFileURL(bundle).href;
const digest = bytes => crypto.createHash("sha256").update(bytes).digest("hex");

async function launchBrowser() {
  const { chromium } = require("playwright");
  if (process.env.BROWSER_EXECUTABLE) return chromium.launch({ executablePath: process.env.BROWSER_EXECUTABLE });
  const failures = [];
  for (const channel of [undefined, "chrome", "msedge"]) {
    try { return await chromium.launch({ channel }); }
    catch (err) { failures.push(err); }
  }
  throw new AggregateError(failures, "Chromium unavailable. Set BROWSER_EXECUTABLE to an installed Chromium, Chrome or Edge.");
}

async function startServer(bytes) {
  const route = "/" + encodeURIComponent(path.basename(bundle));
  const server = http.createServer((req, res) => {
    if (req.url === "/favicon.ico") { res.writeHead(204).end(); return; }
    if (req.url !== route) { res.writeHead(404).end(); return; }
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }).end(bytes);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { url: "http://127.0.0.1:" + server.address().port + route, close: () => new Promise(resolve => server.close(resolve)) };
}

async function run(browser, url, hash, device, kind) {
  const phone = device === "mobile";
  const mode = phone ? "offline" : "bundle";
  const prefix = [kind, device, mode].join("-");
  const context = await browser.newContext({
    viewport: phone ? {width: 390, height: 844} : {width: 1366, height: 768},
    deviceScaleFactor: phone ? 2 : 1, isMobile: phone, hasTouch: phone,
    offline: phone, reducedMotion: "reduce"
  });
  const page = await context.newPage();
  page.setDefaultTimeout(12000);
  const events = [], errors = [];
  page.on("pageerror", err => errors.push(err.message));
  page.on("requestfailed", req => errors.push(req.url() + " " + req.failure()?.errorText));
  page.on("response", resp => { if (resp.status() >= 400) errors.push(resp.status() + " " + resp.url()); });
  const locator = selector => page.locator(selector);
  const control = id => locator("#" + id);
  const state = () => control("game").evaluate(n => ({...n.dataset}));
  const wait = stage => page.waitForFunction(v => document.querySelector("#game").dataset.phase === v, stage);
  const cell = (x, y) => locator('button.bag-cell[data-x="' + x + '"][data-y="' + y + '"]');
  const tool = id => locator('button[data-bag-action="' + id + '"]');
  const piece = id => locator('button.bag-cell[data-owner="' + id + '"]').first();
  const activate = target => phone ? target.tap() : target.click();

  async function shot(name) {
    await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    await page.screenshot({ path: path.join(out, prefix + "-" + name + ".jpg"), quality: 92 });
  }
  async function click(id, next) {
    await activate(control(id));
    if (next) await wait(next);
    events.push([id, (await state()).phase]);
  }
  async function selectLot(id) {
    const tag = locator('button.hitbox[data-lot="' + id + '"]');
    await tag.waitFor();
    await page.waitForFunction(id => !document.querySelector('.hitbox[data-lot="' + id + '"]').disabled, id);
    // The painted price plaque occupies the lower edge of each rectangular DOM target.
    const box = await tag.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height - 8;
    if (phone) await page.touchscreen.tap(x, y);
    else await page.mouse.click(x, y);
    await page.waitForFunction(id => document.querySelector("#game").dataset.lot === id, id);
    events.push(["验货", id]);
  }
  async function hit() {
    const before = await state();
    await click("strike");
    await page.waitForFunction(prev => {
      const d = document.querySelector("#game").dataset;
      return d.phase !== "swing" && (d.phase !== "idle" || d.foe !== prev);
    }, before.foe);
    return state();
  }
  async function win(next) {
    for (let i = 0; i < 8 && (await state()).phase === "idle"; i++) await hit();
    await wait(next);
  }
  async function use(id) {
    await activate(tool(id));
    events.push(["囊", id]);
  }
  const cells = () => locator("button.bag-cell").evaluateAll(bs =>
    bs.map(b => [Number(b.dataset.x), Number(b.dataset.y), b.dataset.owner, b.dataset.ghost]));
  const owned = (matrix, id) => matrix.filter(c => c[2] === id).map(c => c.slice(0, 2));
  async function place(id, x, y) {
    await activate(piece(id));
    await use("move");
    await activate(cell(x, y));
    assert(await tool("place").isEnabled());
    await use("place");
  }
  async function drag(from, to) {
    const a = await cell(...from).boundingBox(), b = await cell(...to).boundingBox();
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps: 12});
    await page.mouse.up();
  }
  async function selectionStyles() {
    // Compare the very same occupied cells before and after selection. Browser focus
    // alone must not create the distinction between chosen and ordinary items.
    const paintedStyle = target => target.evaluate(el => {
      const s = getComputedStyle(el);
      return { fill: s.backgroundColor, border: s.borderTopColor, shadow: s.boxShadow };
    });
    await activate(cell(1, 1));
    const bellOn = await paintedStyle(cell(1, 1)), shellOff = await paintedStyle(cell(2, 1));
    await activate(cell(2, 1));
    const bellOff = await paintedStyle(cell(1, 1)), shellOn = await paintedStyle(cell(2, 1));
    assert.notEqual(bellOn.fill, bellOff.fill, "选中铃与普通铃使用了同一底色");
    assert.notEqual(shellOn.fill, shellOff.fill, "选中壳与普通壳使用了同一底色");
    assert.notEqual(shellOn.border, shellOff.border, "选中壳的边界消失");
    assert.deepEqual(shellOn, bellOn);
    assert.deepEqual(shellOff, bellOff);
    for (const [x, y] of [[1, 2], [2, 2]]) assert.deepEqual(await paintedStyle(cell(x, y)), shellOn);
    events.push(["行囊选中态 computed style", { bellOn, bellOff, shellOn, shellOff }]);
  }

  async function inventory() {
    await selectLot("hook");
    await click("primary");
    assert.equal((await state()).gold, "2");
    await click("market-third", "crossroads");
    await click("secondary", "idle");
    assert.equal((await state()).combatKind, "ink-mite");
    await shot("侧廊墨蠹");
    await win("blood");
    await click("market-third", "bloodReceipt");
    await click("primary", "counter");
    await click("profile-open");
    await click("folio-bag-tab");
    const initial = await cells();
    assert.equal(owned(initial, "sword").length, 3);
    assert.equal(owned(initial, "ink-shell").length, 3);
    const currentName = await locator(".bag-detail h3").innerText();
    await activate(locator('button.bag-cell[data-owner=""]').last());
    assert.deepEqual(await cells(), initial);
    assert.equal(await locator(".bag-detail h3").innerText(), currentName);

    await activate(locator('button.bag-pick[data-piece="bell"]'));
    await use("stow");
    const shell = owned(await cells(), "ink-shell");
    if (Math.min(...shell.map(p => p[0])) !== 1 || Math.min(...shell.map(p => p[1])) !== 1) {
      await place("ink-shell", 1, 1);
    }
    const [bell] = owned(await cells(), "bell");
    if (bell[0] !== 1 || bell[1] !== 1) {
      if (phone) await place("bell", 1, 1);
      else await drag(bell, [1, 1]);
    }
    const packed = await cells();
    assert.deepEqual(owned(packed, "bell"), [[1, 1]]);
    assert.deepEqual(owned(packed, "ink-shell"), [[2, 1], [1, 2], [2, 2]]);
    assert.deepEqual(owned(packed, "sword"), [[0, 0], [1, 0], [2, 0]]);
    await selectionStyles();
    await shot("实物嵌套");

    await use("move");
    await activate(cell(0, 0));
    assert.equal(await tool("place").isEnabled(), false);
    await shot("碰撞拒绝");
    await use("cancel");
    assert.deepEqual(await cells(), packed);

    const rotations = [];
    for (let q = 1; q <= 4; q++) {
      await use("rotate");
      const orientation = await locator("canvas.bag-draft").getAttribute("data-rotation");
      assert.equal(Number(orientation), q % 4);
      rotations.push(Number(orientation));
    }
    await use("cancel");
    assert.deepEqual(await cells(), packed);
    events.push(["四次转向后原占位", rotations, packed]);
    if (!phone) {
      await drag([1, 1], [1, 0]);
      assert.deepEqual(await cells(), packed);
      events.push(["非法拖放回原位"]);
    }
    const before = await state();
    await page.keyboard.press("j");
    await page.keyboard.press("r");
    assert.deepEqual(await state(), before);
    await click("folio-close");
    await selectLot("ink-shell");
    await click("primary");
    assert.equal((await state()).gold, "7");
  }

  async function inspectOrder(id, label, price) {
    await selectLot(id);
    const inspected = await state();
    assert.equal(inspected.phase, "counter");
    assert.equal(inspected.gold, "7", "验货时扣了钱");
    const tag = locator('button.hitbox[data-lot="' + id + '"]');
    assert((await tag.getAttribute("aria-label")).includes(label));
    const pay = await control("primary").getAttribute("aria-label");
    assert(pay.includes("付 " + price + " 石"), "报价与付款按钮不符：" + pay);
    assert(await control("primary").isEnabled());
    events.push(["未付款的寄单", label, price, inspected.gold, pay]);
    await shot("未付-" + label);
  }

  async function trade() {
    await selectLot("knot");
    await click("primary");
    assert.equal((await state()).gold, "0");
    await click("market-third", "crossroads");
    await click("primary", "wound");
    await click("primary", "blood");
    await click("primary", "bloodReceipt");
    await click("primary", "counter");
    await selectLot("hook");
    await click("primary");
    assert.equal((await state()).gold, "0");
    await click("profile-open");
    const journal = await control("folio-body").innerText();
    for (const text of ["饮棘钩", "血珀佩", "2 / 2"]) assert(journal.includes(text), text);
    await shot("双珀待发");
    await click("folio-close");
    await click("market-fourth", "idle");
    const start = await state();
    assert.equal(start.hp, "16");
    assert.equal(start.foe, "19");
    const first = await hit();
    assert.equal(first.foe, "8");
    await hit();
    await wait("finalStall");
    events.push(["常规两击", start, first, await state()]);
    await click("primary", "finalQuote");
    await click("primary", "finalSale");
    assert.equal((await state()).gold, "7");
    await click("primary", "counter");
    await inspectOrder("order-hook", "寄锋契", 7);
    await inspectOrder("order-purse", "开市本钱", 4);
    await click("primary");
    assert.equal((await state()).gold, "3");
    await click("market-third", "receipt");
    await shot("寄单结账");
    if (!phone) {
      const separate = await context.newPage();
      try {
        await separate.goto(fileURL);
        await separate.waitForFunction(() => document.querySelector("#game").dataset.phase === "idle");
        const gold = await separate.locator("#game").getAttribute("data-gold");
        assert.equal(gold, "3");
        events.push(["同一浏览器中离线文件未领取 HTTP 寄单", gold]);
      } finally { await separate.close(); }
    }
    for (const gold of ["6", "3"]) {
      await page.reload();
      await wait("idle");
      assert.equal((await state()).gold, gold);
      events.push(["重新打开灵石", gold]);
    }
  }
  try {
    const actualURL = phone ? fileURL : url;
    const response = await page.goto(actualURL);
    if (!phone) assert.equal(digest(await response.body()), hash, "HTTP 与所选文件不是同一个构建");
    await wait("idle");
    assert.equal((await state()).gold, "3");
    await win("drop");
    for (const next of ["guide", "rumor", "stall", "quote", "result", "counter"]) {
      await click(kind === "combo" && next === "result" ? "secondary" : "primary", next);
    }
    if (kind === "bag") await inventory();
    else await trade();
    assert.deepEqual(errors, []);
    const report = { url: actualURL, mode, kind, device, bundleSHA256: hash, viewport: page.viewportSize(),
      browser: browser.version(), final: await state(), events, errors };
    await fs.writeFile(path.join(out, prefix + ".json"), JSON.stringify(report, null, 2) + "\n");
    console.log("PASS", prefix, hash);
  } catch (err) {
    const stem = path.join(out, prefix + "-failed");
    const info = { state: await state().catch(() => null), events, errors, error: String(err.stack || err) };
    await fs.writeFile(stem + ".json", JSON.stringify(info, null, 2) + "\n");
    await page.screenshot({ path: stem + ".jpg", quality: 85 }).catch(() => {});
    throw err;
  } finally { await context.close(); }
}

async function main() {
  if (values.help) {
    console.log("node first-cut/check-inventory-play.cjs [--bundle FILE] [--out DIR] [--device all|desk|mobile] [--flow all|bag|combo]");
    console.log("The default runs 4 journeys: desktop over loopback HTTP and touch mobile from the offline HTML.");
    console.log("SERVER can specify the full HTTP(S) URL of the identical HTML. BROWSER_EXECUTABLE can select an installed Chromium.");
    return;
  }
  assert(["all", "desk", "mobile"].includes(values.device), "invalid --device");
  assert(["all", "bag", "combo"].includes(values.flow), "invalid --flow");
  const devices = values.device === "all" ? ["desk", "mobile"] : [values.device];
  const flows = values.flow === "all" ? ["bag", "combo"] : [values.flow];
  const bytes = await fs.readFile(bundle), hash = digest(bytes);
  await fs.mkdir(out, {recursive: true});
  const server = devices.includes("desk") && !process.env.SERVER ? await startServer(bytes) : null;
  try {
    const browser = await launchBrowser();
    try {
      for (const device of devices) {
        for (const flow of flows) await run(browser, process.env.SERVER || server?.url, hash, device, flow);
      }
    } finally { await browser.close(); }
  } finally { if (server) await server.close(); }
}

main().catch(err => { console.error(err); process.exitCode = 1; });
