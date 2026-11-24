// Record the contest demo video (about 100 s, with the game's own sound) by capturing the tab.
// Opens on the fox merchant 绯绡 as the hook, then exploring, a fight, the bag, and the fake-fox reveal.
// Uses the dev entry (__seal.fight / __seal.event) to open the shop, a rat fight and the white-fox stall
// on cue, so this is a staged tour of real game screens, not a random run.
// Usage: node tests/record-demo.mjs [out.mp4]   (starts its own Vite dev server; needs system Chrome and macOS swift)
import { chromium } from "playwright-core";
import { createServer } from "vite";
import { open, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const outPath = process.argv[2] ?? "../docs/contest/media/demo.mp4";
const server = await createServer({ root: new URL("..", import.meta.url).pathname, server: { port: 0, host: "127.0.0.1" }, logLevel: "error" });
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--auto-accept-this-tab-capture", "--autoplay-policy=no-user-gesture-required", ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(" ") : [])] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
// Headless Chrome captures tab audio as silence, so tap the game's Web Audio output directly
// (every connection to the speakers is mirrored into a MediaStream) and record it alongside the picture.
await page.context().addInitScript(() => {
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode) {
      const a = this.context;
      if (!a.__tap) { a.__tap = a.createMediaStreamDestination(); window.__tapStream = a.__tap.stream; }
      orig.call(this, a.__tap);
    }
    return orig.call(this, dest, ...rest);
  };
});

// The host page holds the game in a same-origin iframe plus a caption layer, and records itself.
await page.route(`${base}__demo`, (route) => route.fulfill({ contentType: "text/html; charset=utf-8", body: `<!doctype html><meta charset=utf-8>
<style>
@font-face{font-family:Kai;src:url(/src/fonts/kai.woff2)}@font-face{font-family:Brush;src:url(/src/fonts/brush.woff2)}
html,body{margin:0;height:100%;background:#000;overflow:hidden}
iframe{border:0;width:100%;height:100%;display:block}
#cap{position:fixed;left:0;right:0;margin:0 auto;width:fit-content;bottom:22px;max-width:1160px;padding:8px 26px;border-radius:10px;
 background:rgba(14,8,5,.82);border:1px solid rgba(233,207,154,.5);color:#f6e7c8;font:27px/1.45 Kai,serif;text-align:center;
 opacity:0;transition:opacity .35s;pointer-events:none;text-shadow:0 2px 6px #000}
#cap.on{opacity:1}
#card{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:radial-gradient(#2a140c,#070302);
 color:#f3d48a;font-family:Brush,serif;opacity:0;transition:opacity .6s;pointer-events:none}
#card.on{opacity:1}#card h1{font-size:120px;margin:0;letter-spacing:10px;font-weight:normal}#card h2{font-size:56px;margin:6px 0 40px;color:#f6e7c8;letter-spacing:6px;font-weight:normal}
#card p{font:30px/1.7 Kai,serif;color:#e9cf9a;margin:0;text-align:center}
#card.poster{background:#000}#card .blur{position:absolute;inset:-40px;background:url(/__cover.jpg) center/cover;filter:blur(30px) brightness(.45)}
#card .poster-img{position:relative;height:100%;box-shadow:0 0 60px #000}
#card .banner-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
</style>
<iframe id=game src="${base}?seed=demo-fox"></iframe><div id=cap></div><div id=card></div>
<script>
window.cap=(t)=>{const c=document.getElementById('cap');if(!t){c.classList.remove('on');return}c.innerHTML=t;c.classList.add('on')};
window.card=(h)=>{const c=document.getElementById('card');if(!h){c.classList.remove('on');return}c.innerHTML=h;c.classList.add('on')};
</script>` }));

await page.route(`${base}__cover.jpg`, (route) => route.fulfill({ path: new URL("../../docs/contest/media/cover-1080x1440.jpg", import.meta.url).pathname, contentType: "image/jpeg" }));
await page.route(`${base}__banner.jpg`, (route) => route.fulfill({ path: new URL("../../docs/contest/media/cover-review/banner.jpg", import.meta.url).pathname, contentType: "image/jpeg" }));
const videoPath = outPath.replace(/\.mp4$/, "") + ".video.mp4", audioPath = outPath.replace(/\.mp4$/, "") + ".audio.m4a";
const file = await open(videoPath, "w"), afile = await open(audioPath, "w");
let bytes = 0;
await page.exposeFunction("__chunk", async (b64) => { const buf = Buffer.from(b64, "base64"); bytes += buf.length; await file.write(buf); });
await page.exposeFunction("__chunkA", async (b64) => { await afile.write(Buffer.from(b64, "base64")); });
await page.goto(`${base}__demo`);
const frame = await (await page.waitForSelector("#game")).contentFrame();
await frame.waitForSelector(".title-screen");
await frame.evaluate(() => localStorage.clear());
await frame.goto(`${base}?seed=demo-fox`);
await frame.waitForSelector(".title-screen");

const wait = (ms) => page.waitForTimeout(ms);
const cap = (t) => page.evaluate((t) => window.cap(t), t);
const card = (h) => page.evaluate((h) => window.card(h), h);
const btn = async (name) => { await frame.getByRole("button", { name }).first().click(); await wait(300); };
const S = (fn, arg) => frame.evaluate(fn, arg);
const screen = () => S(() => window.__seal.runSig.value?.screen);

// Set up a run off camera: order + weapon, into floor 1, close the tips and omen card.
await btn(/去镇灯铺接单/);
await btn("进塔");
await frame.waitForSelector(".explore");
for (const sel of ["text=知道了", ".omen-card .btn"]) { const l = frame.locator(sel); if (await l.count()) { await l.first().click(); await wait(300); } }
// Give the bag a full fox clasp and some ash so there is something to sell (staging).
await S(async () => {
  const inv = await import("/src/game/inventory.ts");
  const r = window.__seal.runSig.value;
  for (const id of ["clasp", "ash", "ash"]) inv.addGood(r, id);
  r.gold = Math.max(r.gold, 30);
  window.__seal.commit();
});
await S(() => window.__seal.fight("", "shop"));
await frame.waitForSelector(".shop");
await page.evaluate(() => { const c = document.getElementById("card"); c.className = "poster on"; c.style.transition = "none"; c.innerHTML = '<div class="blur"></div><img class="poster-img" src="/__cover.jpg">'; });
await page.waitForFunction(() => document.querySelector(".poster-img")?.complete);
await wait(800);

// Start recording the tab (picture + tab audio).
await page.evaluate(async (opt) => {
  const s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 }, resizeMode: "crop-and-scale" }, audio: false, preferCurrentTab: true });
  // The first captured frames can arrive at CSS size (1280×720) before switching to 1920×1080. MP4 stores the codec
  // settings from the first frame only, so a mid-stream size change makes the file undecodable: wait for the final size.
  const probe = document.createElement("video");
  probe.muted = true; probe.srcObject = s; probe.style.cssText = "position:fixed;width:2px;height:2px;opacity:0;pointer-events:none"; document.body.append(probe);
  await probe.play();
  for (let i = 0; i < 60 && !(probe.videoWidth === 1920 && probe.videoHeight === 1080); i++) await new Promise((r) => setTimeout(r, 100));
  window.__size = [probe.videoWidth, probe.videoHeight];
  await new Promise((r) => setTimeout(r, 300));
  // High profile, level 4.0: the default avc1 profile cannot hold 1080p and the file will not decode.
  const mime = [opt.mime, "video/mp4;codecs=avc1.640028", "video/mp4"].find((t) => t && MediaRecorder.isTypeSupported(t));
  const tap = document.getElementById("game").contentWindow.__tapStream;
  if (!tap) throw new Error("no game audio tap: the game has not started its AudioContext");
  const arec = new MediaRecorder(tap, { mimeType: "audio/mp4;codecs=mp4a.40.2", audioBitsPerSecond: 192_000 });
  window.__arec = arec; window.__apending = Promise.resolve();
  arec.ondataavailable = (e) => {
    window.__apending = window.__apending.then(async () => {
      const b = new Uint8Array(await e.data.arrayBuffer());
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      await window.__chunkA(btoa(s));
    });
  };
  const rec = new MediaRecorder(s, { mimeType: mime, videoBitsPerSecond: 7_000_000 });
  window.__rec = rec; window.__mime = mime; window.__pending = Promise.resolve();
  rec.ondataavailable = (e) => {
    window.__pending = window.__pending.then(async () => {
      const b = new Uint8Array(await e.data.arrayBuffer());
      let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
      await window.__chunk(btoa(s));
    });
  };
  rec.start(1000); arec.start(1000);
}, { mime: process.env.MIME });
const t0 = Date.now();
const mark = [];
const scene = (n) => mark.push([((Date.now() - t0) / 1000).toFixed(1), n]);

try {
  // 0. Poster: 绯绡 winking with the coin, then fade into her shop.
  scene("封面");
  await wait(3200);
  await page.evaluate(() => { const c = document.getElementById("card"); c.style.transition = ""; c.classList.remove("on"); });
  await wait(700);
  await page.evaluate(() => { document.getElementById("card").className = ""; });
  // 1. Hook: 绯绡.
  scene("绯绡的狐市");
  await cap("她叫绯绡，塔里唯一肯收妖货的狐老板娘。");
  await wait(3500);
  await cap("“这枚狐扣，现在卖给我，还是背上楼？”");
  await wait(2500);
  const ash = frame.locator(".shop-sell .item.kind-goods").last();
  if (await ash.count()) { await ash.click(); await wait(1500); }
  await cap("同一种货卖得越多越便宜。每层收价不一样，自己算。");
  await wait(3500);
  await cap("");
  await btn("离开狐市");
  if (process.env.SHORT) throw new Error("SHORT: stopped after the first scene");
  // Clear the staged stall so the first step forward does not walk back into it.
  // Also clear anything within two tiles of the start so the walk shows the corridor, not a stall or a cart.
  await S(() => {
    const r = window.__seal.runSig.value;
    r.dungeon.entities = r.dungeon.entities.filter((e) => e.id < 9000 && (e.kind === "stairs" || Math.abs(e.x - r.pos.x) + Math.abs(e.y - r.pos.y) > 2));
    window.__seal.commit();
  });

  // 2. Explore.
  scene("第一人称迷宫");
  await cap("第一人称走三层随机迷宫。每走一步，烧一点灯油。");
  // Step forward when the tile ahead is open floor with nothing on it, otherwise turn toward an open side.
  const look = () => S(() => {
    const r = window.__seal.runSig.value, d = r.dungeon, D = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    const free = (k) => { const x = r.pos.x + D[k][0], y = r.pos.y + D[k][1]; return !d.tiles[y * d.w + x] && !d.entities.some((e) => !e.done && e.x === x && e.y === y); };
    return { ahead: free(r.pos.dir), right: free((r.pos.dir + 1) % 4), left: free((r.pos.dir + 3) % 4) };
  });
  for (let i = 0; i < 9; i++) {
    if ((await screen()) !== "explore") break;
    const f = await look();
    const name = f.ahead ? "前进" : f.right ? "右转" : "左转";
    await frame.getByRole("button", { name, exact: true }).first().click().catch(() => {});
    await wait(650);
  }
  // Auto-walk by clicking a far tile on the minimap.
  const far = await S(() => {
    const s = window.__seal, r = s.runSig.value, d = r.dungeon; let best = null;
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      if (!d.seen[y * d.w + x] || d.tiles[y * d.w + x]) continue;
      if (d.entities.some((e) => !e.done && e.x === x && e.y === y)) continue;
      const p = s.findPath(d, r.pos, { x, y }); if (p && p.length <= 9 && (!best || p.length > best.len)) best = { x, y, len: p.length };
    }
    return best && { ...best, w: d.w, h: d.h };
  });
  if (far && (await screen()) === "explore") {
    await cap("点小地图上的格子，会自己走过去；看到妖就停下。");
    const mb = await frame.locator(".minimap canvas").boundingBox();
    await page.mouse.click(mb.x + ((far.x + 0.5) / far.w) * mb.width, mb.y + ((far.y + 0.5) / far.h) * mb.height);
    await wait(4500);
  }

  // 3. Fight: a lamp rat, which steals your best goods if it breaks your block.
  scene("卡牌战斗");
  if ((await screen()) !== "combat") await S(() => window.__seal.fight("rat"));
  await frame.waitForSelector(".hand .card", { timeout: 8000 });
  await cap("妖头上明写着它下一手要干什么。");
  await wait(3000);
  const tip = frame.getByRole("button", { name: "知道了" }); if (await tip.count()) await tip.first().click().catch(() => {});
  await cap("灯鼠打穿你的格挡，就会叼走行囊里最值钱的货。");
  await wait(2500);
  for (let turn = 0; turn < 6 && (await screen()) === "combat"; turn++) {
    for (let i = 0; i < 5; i++) {
      const c = frame.locator(".hand .card:not(.disabled)");
      if (!(await c.count()) || (await screen()) !== "combat") break;
      await c.first().click(); await wait(700);
    }
    if ((await screen()) !== "combat") break;
    if (turn === 0) await cap("先架格挡护住货，再出刀。");
    await btn(/结束回合/); await wait(1800);
  }
  await cap("");
  await wait(1200);

  // 4. Reward and the bag.
  scene("行囊");
  if ((await screen()) === "reward") {
    const c = frame.locator(".card-offer .card"); if (await c.count()) { await c.first().click(); await wait(600); }
  }
  await frame.locator("body").press("b");
  await frame.waitForSelector(".bag-grid, .bag", { timeout: 5000 }).catch(() => {});
  await cap("行囊就是构筑：剑占 1×3，算盘占 2×2。兵器放进行囊，它的牌才进牌组。");
  await wait(3000);
  const item = frame.locator(".overlay .item.kind-gear").first();
  if (await item.count()) {
    const b = await item.boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 30, { steps: 12 }); await wait(500);
    await frame.locator("body").press("r"); await wait(700);
    await frame.locator("body").press("r"); await wait(500);
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 }); await page.mouse.up();
  }
  await cap("磨刀石夹在两把剑中间，两把都加攻。狐扣这种易碎货，挨打会掉价。");
  await wait(4000);
  await frame.locator("body").press("Escape"); await wait(400);
  if ((await screen()) === "reward") { await cap(""); await btn(/继续/); }

  // 5. The white-fox stall.
  scene("可疑的白狐摊");
  await S(() => { const r = window.__seal.runSig.value; r.floor = 2; window.__seal.commit(); });
  await S(() => window.__seal.event("fakefox"));
  await frame.waitForSelector(".option", { timeout: 5000 });
  await cap("到了桥驿，又撞见一个狐市。摊主也是狐女，货便宜得出奇。");
  await wait(4000);
  await cap("只是她的尾巴是白的。<br>绯绡说过，塔里只有她一家狐市。");
  await wait(4500);
  await cap("");
  await frame.locator(".option", { hasText: "揭穿它" }).first().click();
  await wait(2500);
  await cap("“底下是九条白尾巴。它不笑了。”");
  await wait(2000);
  await btn(/迎战|继续/);
  await frame.waitForSelector(".hand .card", { timeout: 8000 }).catch(() => {});
  await cap("假狐商的「收账」打穿格挡，会抢走你 12 石。");
  for (let i = 0; i < 3; i++) { const c = frame.locator(".hand .card:not(.disabled)"); if (await c.count()) { await c.first().click(); await wait(800); } }
  await wait(1500);
  await cap("");

  // 6. Back to town: what you carry home becomes treasury silver.
  scene("回镇结算");
  await S(async () => {
    const R = await import("/src/game/run.ts");
    const r = window.__seal.runSig.value;
    r.combat = null; r.screen = "explore"; R.goHome(r); window.__seal.commit();
  });
  await frame.waitForSelector(".result, .result-screen, text=再进一趟", { timeout: 6000 }).catch(() => {});
  await cap("活着回镇，身上的石和行囊里的货折成库银。倒在塔里，就全丢。");
  await wait(4500);
  await cap("");
  await btn("再进一趟");
  await frame.getByRole("button", { name: "营建铺子" }).first().click().catch(() => {});
  await cap("库银拿来营建镇灯铺：账房、灯油坊、药柜、行囊匠……下一趟开局更强。");
  await wait(4500);
  await cap("");

  // 7. End card.
  scene("片尾");
  // The lettered landscape key art (ART-011 + CONTEST-002) as the closing frame.
  await page.evaluate(() => { const c = document.getElementById("card"); c.className = "banner"; c.innerHTML = '<img class="banner-img" src="/__banner.jpg">'; });
  await page.waitForFunction(() => document.querySelector(".banner-img")?.complete);
  await page.evaluate(() => document.getElementById("card").classList.add("on"));
  await wait(4500);
} catch (e) {
  errors.push("driver: " + String(e).split("\n")[0]);
}

await page.evaluate(async () => {
  const rec = window.__rec, arec = window.__arec;
  const done = Promise.all([new Promise((r) => (rec.onstop = r)), new Promise((r) => (arec.onstop = r))]);
  rec.stop(); arec.stop(); rec.stream.getTracks().forEach((t) => t.stop());
  await done; await new Promise((r) => setTimeout(r, 300)); await window.__pending; await window.__apending;
});
await file.close(); await afile.close();
// Put picture and sound into one ordinary MP4 with AVFoundation (macOS), no re-encoding.
execFileSync("swift", [new URL("./mux-av.swift", import.meta.url).pathname, videoPath, audioPath, outPath], { stdio: "inherit" });
await rm(videoPath); await rm(audioPath);
const mime = await page.evaluate(() => window.__mime + " " + window.__size.join("×"));
console.log(JSON.stringify({ out: outPath, mime, seconds: +((Date.now() - t0) / 1000).toFixed(1), mb: +(bytes / 1048576).toFixed(1), scenes: mark, errors }, null, 1));
await browser.close();
await server.close();
process.exit(errors.length ? 1 : 0);
