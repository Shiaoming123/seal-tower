// Contest covers (3:4, 1080×1440) composed from existing game art — no new illustrations.
// Fox merchant 绯绡 is the mascot; the fake fox merchant is the twist. Uses the game's OFL fonts.
// Usage: npm run build && node scripts/make-covers.mjs   →  ../docs/contest/media/cover-*.jpg
import { chromium } from "playwright-core";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const v2 = new URL("..", import.meta.url).pathname;
const repo = join(v2, "..");
const out = join(repo, "docs/contest/media");
const font = (prefix) => {
  const f = readdirSync(join(v2, "dist/assets")).find((n) => n.startsWith(prefix) && n.endsWith(".woff2"));
  return `data:font/woff2;base64,${readFileSync(join(v2, "dist/assets", f)).toString("base64")}`;
};
const img = (p) => `data:image/${p.endsWith(".png") ? "png" : "webp"};base64,${readFileSync(join(repo, p)).toString("base64")}`;

const css = `
@font-face{font-family:Brush;src:url(${font("brush")})}
@font-face{font-family:Kai;src:url(${font("kai")})}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1440px;overflow:hidden;background:#120c0a;font-family:Kai,serif;color:#f6e7c8}
.bg{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(6px) brightness(.55) saturate(1.15)}
.vignette{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 42%,transparent 35%,rgba(10,5,3,.85) 100%)}
.char{position:absolute;filter:drop-shadow(0 18px 40px rgba(0,0,0,.6))}
.title{position:absolute;left:0;right:0;text-align:center;font-family:Brush,serif;letter-spacing:6px;text-shadow:0 4px 0 #3a1408,0 0 30px rgba(0,0,0,.8)}
.hook{position:absolute;left:70px;right:70px;text-align:center;line-height:1.5;text-shadow:0 2px 10px rgba(0,0,0,.9)}
.shade{position:absolute;left:0;right:0;bottom:0;height:560px;background:linear-gradient(rgba(12,6,4,0),rgba(12,6,4,.88) 45%,rgba(12,6,4,.96))}
.tag{position:absolute;left:0;right:0;bottom:46px;text-align:center;font-size:30px;letter-spacing:4px;color:#e9cf9a;opacity:.92;text-shadow:0 2px 8px #000}
.seal{display:inline-block;border:3px solid #c8432b;color:#e5583c;padding:2px 14px;border-radius:6px;font-size:28px;margin-left:12px;vertical-align:middle;text-shadow:none}
`;

const covers = {
  // 绯绡 winking with a coin, warm lantern market behind.
  "cover-1080x1440": `
<div class="bg" style="background-image:url(${img("assets/market.webp")})"></div><div class="vignette"></div>
<img class="char" src="${img("first-cut/sprites/fox-settle-hands.webp")}" style="width:1500px;left:-250px;top:250px">
<div class="title" style="top:70px;font-size:132px;color:#f3d48a">斩妖塔</div>
<div class="title" style="top:228px;font-size:60px;color:#f6e7c8;letter-spacing:6px">富婆狐商救救我！</div>
<div class="shade"></div>
<div class="hook" style="bottom:200px;font-size:54px">这枚狐扣，<br>现在卖给我，还是背上楼？</div>
<div class="hook" style="bottom:130px;font-size:34px;color:#e9cf9a">—— 狐市老板娘 绯绡</div>
<div class="tag">第一人称爬塔 · 卡牌 · 背包 · 跑商<span class="seal">网页即玩</span></div>`,
  // The fake fox merchant: same smile, white tails, moonlit hall.
  "cover-fakefox": `
<div class="bg" style="background-image:url(${img("first-cut/sprites/hall.webp")})"></div><div class="vignette"></div>
<img class="char" src="${img("v2/art/event-fake-fox.png")}" style="width:1150px;left:-35px;top:250px">
<div class="title" style="top:70px;font-size:132px;color:#dfe9f5">斩妖塔</div>
<div class="title" style="top:228px;font-size:60px;color:#f6e7c8;letter-spacing:6px">富婆狐商救救我！</div>
<div class="shade"></div>
<div class="hook" style="bottom:210px;font-size:52px">绯绡说过，<br>塔里只有她一家狐市。</div>
<div class="hook" style="bottom:140px;font-size:34px;color:#b9cde3">那这位白尾巴的，又是谁？</div>
<div class="tag">第一人称爬塔 · 卡牌 · 背包 · 跑商<span class="seal">网页即玩</span></div>`,
};

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 } });
for (const [name, body] of Object.entries(covers)) {
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${css}</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(out, `${name}.jpg`), type: "jpeg", quality: 88 });
  console.log("wrote", name);
}
await browser.close();
