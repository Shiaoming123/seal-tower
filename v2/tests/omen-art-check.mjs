// Render the real omen modal with reproducible floor-one seeds.
// node tests/omen-art-check.mjs [output-directory] [dev|offline] [omen IDs...]
// Offline mode requires npm run build:offline.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../", import.meta.url));
const [out = ".cache/omen-art", mode = "dev", ...selected] = process.argv.slice(2);
assert.ok(["dev", "offline"].includes(mode));
const seeds = {
  demand: ["omen-art-0", "货紧"], rain: ["omen-art-12", "雨夜"],
  incense: ["omen-art-10", "香火旺"], patrol: ["omen-art-1", "精英巡夜"],
  calm: ["omen-art-34", "太平"], market: ["omen-art-6", "集市日"],
  horde: ["omen-art-5", "妖潮"], moon: ["omen-art-9", "月明"],
  fog: ["omen-art-2", "迷雾"], festival: ["omen-art-20", "灯会"],
  bloodmoon: ["omen-art-4", "血月"],
};
const viewports = {
  desktop: { viewport: { width: 1280, height: 720 } },
  phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
  "phone-short": { viewport: { width: 390, height: 664 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
};
const manifest = JSON.parse(await readFile(new URL("../art/exports.json", import.meta.url), "utf8"));
await mkdir(out, { recursive: true });
const server = mode === "dev" ? await createServer({ root, logLevel: "error", server: { host: "127.0.0.1", port: 0 } }) : null;
const report = {};
let browser;
try {
  await server?.listen();
  const base = server?.resolvedUrls.local[0] ?? new URL("../dist-offline/index.html", import.meta.url).href;
  browser = await chromium.launch({ channel: "chrome", headless: true });
  for (const id of selected.length ? selected : Object.keys(seeds)) {
    const [seed, name] = seeds[id];
    report[id] = {};
    for (const [label, options] of Object.entries(viewports)) {
      const context = await browser.newContext({ ...options, reducedMotion: label === "phone-short" ? "reduce" : "no-preference", offline: mode === "offline" });
      try {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.goto(base + "?seed=" + seed);
        await page.getByRole("button", { name: "去镇灯铺接单" }).click();
        await page.getByRole("button", { name: "进塔" }).click();
        await page.locator(".tip").getByRole("button", { name: "知道了" }).click();
        const card = page.locator(".omen-card");
        const confirm = card.getByRole("button", { name: "知道了" });
        await card.waitFor({ state: "visible" });
        await page.locator(".floor-card").waitFor({ state: "hidden" });
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".omen-card")).opacity === "1");
        assert.equal(await card.locator("h3").innerText(), name);
        await card.locator("img").evaluate(async image => {
          await image.decode();
          await document.fonts.ready;
        });
        const state = await card.evaluate(modal => {
          const image = modal.querySelector("img");
          const rule = modal.querySelector("p:not(.verse):not(.omen-hint)");
          const button = modal.querySelector("button");
          const holder = modal.closest(".viewport");
          const range = document.createRange();
          range.selectNodeContents(rule);
          const rect = ({ x, y, width, height }) => ({ x, y, width, height });
          return { rule: rule.innerText, ruleLines: [...range.getClientRects()].map(rect),
            button: rect(button.getBoundingClientRect()), image: rect(image.getBoundingClientRect()),
            clip: rect(holder.getBoundingClientRect()), natural: [image.naturalWidth, image.naturalHeight],
            src: image.currentSrc, width: innerWidth, height: innerHeight };
        });
        assert.deepEqual(state.natural, [480, 270]);
        if (mode === "offline") {
          assert.ok(state.src.startsWith("data:image/webp;"));
          state.sha256 = createHash("sha256").update(Buffer.from(state.src.split(",")[1], "base64")).digest("hex");
          assert.equal(state.sha256, manifest["omen-" + id].webpSha256);
          state.src = "embedded";
        } else {
          assert.ok(state.src.endsWith("/omen-" + id + ".webp"), state.src);
        }
        const { clip, width, height, button, ruleLines } = state;
        const visible = r => r.width > 0 && r.height > 0
          && r.x >= Math.max(clip.x, 0) - 1 && r.y >= Math.max(clip.y, 0) - 1
          && r.x + r.width <= Math.min(clip.x + clip.width, width) + 1
          && r.y + r.height <= Math.min(clip.y + clip.height, height) + 1;
        assert.ok(ruleLines.length && ruleLines.every(visible), JSON.stringify({ id, label, state }));
        assert.ok(visible(button), JSON.stringify({ id, label, state }));
        assert.ok(Math.min(button.width, button.height) >= 24, JSON.stringify({ id, label, button }));
        await page.screenshot({ path: out + "/" + id + "-" + label + ".jpg", quality: 88 });
        if (options.hasTouch) await confirm.tap({ timeout: 3000 });
        else await confirm.click({ timeout: 3000 });
        await card.waitFor({ state: "hidden" });
        assert.deepEqual(errors, []);
        report[id][label] = { seed, ...state, confirmed: true, errors };
      } finally {
        await context.close();
      }
    }
    console.log(name + " · rule visible and dismissible in all three viewports");
  }
  await writeFile(out + "/runtime.json", JSON.stringify({ mode, report }, null, 2) + "\n");
} finally {
  await browser?.close();
  await server?.close();
}
