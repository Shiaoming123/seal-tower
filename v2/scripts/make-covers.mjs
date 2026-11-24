// Contest covers: titles and lines set in the game's OFL fonts over the ART-011 text-free key art.
// Fox merchant 绯绡 is the mascot; the fake fox merchant is the twist; the banner is for video and studio.
// Usage: npm run build && node scripts/make-covers.mjs [outDir]
//   → <outDir>/cover-feixiao.jpg, cover-fakefox.jpg (1080×1440), banner.jpg (1920×1080), plus 300×400 previews.
//   Default outDir: ../docs/contest/media/cover-review (for the user to approve before replacing the post covers).
import { chromium } from "playwright-core";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import sharp from "sharp";
import { join } from "node:path";

const v2 = new URL("..", import.meta.url).pathname;
const repo = join(v2, "..");
const out = process.argv[2] ? join(process.cwd(), process.argv[2]) : join(repo, "docs/contest/media/cover-review");
mkdirSync(out, { recursive: true });
const font = (prefix) => {
  const f = readdirSync(join(v2, "dist/assets")).find((n) => n.startsWith(prefix) && n.endsWith(".woff2"));
  return `data:font/woff2;base64,${readFileSync(join(v2, "dist/assets", f)).toString("base64")}`;
};
const img = (p) => `data:image/${p.endsWith(".png") ? "png" : "webp"};base64,${readFileSync(join(repo, p)).toString("base64")}`;

let css = `
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
.tag{position:absolute;left:0;right:0;bottom:34px;text-align:center;font-size:28px;letter-spacing:4px;color:#e9cf9a;opacity:.92;text-shadow:0 2px 8px #000}
.seal{display:inline-block;border:3px solid #c8432b;color:#e5583c;padding:2px 14px;border-radius:6px;font-size:28px;margin-left:12px;vertical-align:middle;text-shadow:none}
`;

const promo = (id) => img(`docs/contest/media/promo/${id}.png`);
const covers = {
  // 绯绡 behind her counter, winking with a coin; title in the dark curtain band, her line on the counter front.
  "cover-feixiao": [1080, 1440, `
<img class="full" src="${promo("promo-feixiao")}">
<div class="topshade"></div><div class="lowshade"></div>
<div class="title" style="top:46px;font-size:124px;color:#f3d48a">斩妖塔</div>
<div class="title" style="top:192px;font-size:56px;color:#f6e7c8;letter-spacing:6px">富婆狐商救救我！</div>
<div class="hook" style="bottom:128px;font-size:48px">“这枚狐扣，现在卖给我，<br>还是背上楼？”</div>
<div class="hook" style="bottom:86px;font-size:30px;color:#e9cf9a">—— 狐市老板娘 绯绡</div>
<div class="tag">第一人称爬塔 · 卡牌 · 背包 · 跑商<span class="seal">网页即玩</span></div>`],
  // The white fox stall: same framing, cold light, cloth lifted on nine tails.
  "cover-fakefox": [1080, 1440, `
<img class="full" src="${promo("promo-fakefox")}">
<div class="topshade"></div><div class="lowshade"></div>
<div class="title" style="top:46px;font-size:124px;color:#dfe9f5">斩妖塔</div>
<div class="title" style="top:192px;font-size:56px;color:#f6e7c8;letter-spacing:6px">富婆狐商救救我！</div>
<div class="hook" style="bottom:128px;font-size:48px">绯绡说过，<br>塔里只有她一家狐市。</div>
<div class="hook" style="bottom:86px;font-size:30px;color:#b9cde3">那这位白尾巴的，又是谁？</div>
<div class="tag">第一人称爬塔 · 卡牌 · 背包 · 跑商<span class="seal">网页即玩</span></div>`],
  // Landscape key art: title in the dark top-left wall, for the demo video and the studio card.
  "banner": [1920, 1080, `
<img class="full" src="${promo("promo-banner")}">
<div class="leftshade"></div>
<div class="title" style="top:70px;left:90px;right:auto;text-align:left;font-size:150px;color:#f3d48a">斩妖塔</div>
<div class="title" style="top:250px;left:96px;right:auto;text-align:left;font-size:64px;color:#f6e7c8;letter-spacing:6px">富婆狐商救救我！</div>
<div class="hook" style="top:350px;left:98px;right:auto;bottom:auto;text-align:left;font-size:34px;color:#e9cf9a">第一人称爬塔 · 卡牌 · 背包 · 跑商<br>魔搭创空间 网页即玩</div>`],
};
css += `
.full{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:auto}
.topshade{position:absolute;left:0;right:0;top:0;height:320px;background:linear-gradient(rgba(10,5,3,.78),rgba(10,5,3,.35) 65%,rgba(10,5,3,0))}
.lowshade{position:absolute;left:0;right:0;bottom:0;height:330px;background:linear-gradient(rgba(10,5,3,0),rgba(10,5,3,.82) 42%,rgba(10,5,3,.94))}
.leftshade{position:absolute;left:0;top:0;width:1000px;height:560px;background:radial-gradient(ellipse at 0% 0%,rgba(10,5,3,.82),rgba(10,5,3,.45) 55%,rgba(10,5,3,0) 80%)}
`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
for (const [name, [w, h, body]] of Object.entries(covers)) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><meta charset=utf-8><style>${css}body{width:${w}px;height:${h}px}</style>${body}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
  const file = join(out, `${name}.jpg`);
  await page.screenshot({ path: file, type: "jpeg", quality: 90 });
  const pw = w > h ? 640 : 300, ph = Math.round((pw * h) / w);
  await sharp(file).resize(pw, ph, { kernel: "lanczos3" }).jpeg({ quality: 88 }).toFile(join(out, `${name}-${pw}x${ph}.jpg`));
  console.log("wrote", name, `${w}×${h}`, `preview ${pw}×${ph}`);
}
await browser.close();
