// Regression: node tests/title-sound-save.mjs [url], or build:offline and omit the URL.
import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const url = new URL(process.argv[2] ?? "../dist-offline/index.html", import.meta.url);
url.searchParams.set("seed", "title-sound-save");
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  await page.goto(url.href);
  await page.getByRole("button", { name: "去镇灯铺接单" }).click();
  await page.getByRole("button", { name: "进塔", exact: true }).click();
  await page.locator(".explore").waitFor();
  const save = () => page.evaluate(() => localStorage.getItem("seal-tower.v2.run"));
  const before = await save();
  assert.ok(before);

  await page.reload();
  const resume = page.getByRole("button", { name: /继续上一趟/ });
  await resume.waitFor();
  await page.getByRole("button", { name: "音量", exact: true }).click();
  const sound = page.locator(".sound-panel");
  const music = sound.getByRole("slider", { name: "配乐" });
  const initialVolume = await music.inputValue();
  await music.press("ArrowRight");
  const volume = await music.inputValue();
  assert.ok(Number(volume) > Number(initialVolume));
  await sound.getByRole("checkbox", { name: "开启声音" }).uncheck();
  assert.equal(await save(), before);
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("seal-tower.v2.profile")));
  assert.equal(profile.sound, false);
  assert.equal(profile.musicVol, Number(volume));

  await page.reload();
  await page.getByRole("button", { name: "静音", exact: true }).waitFor();
  await resume.click();
  await page.locator(".explore").waitFor();
  assert.equal(await page.evaluate(() => window.__seal.runSig.value.seed), JSON.parse(before).seed);
  console.log("Title audio settings persist without changing the saved run");
} finally {
  await browser.close();
}
