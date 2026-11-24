// AUDIO-002: the same monster call heard in plain view, around a corner and through a wall: loudness (RMS) and
// brightness (spectral centroid) at the speakers. Usage: node tests/hearing-check.mjs [url]  (dev server running)
import { chromium } from "playwright-core";
const url = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
await page.addInitScript(() => {
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !window.__tap) { const an = this.context.createAnalyser(); an.fftSize = 2048; orig.call(this, an); window.__tap = { an }; }
    return orig.call(this, dest, ...rest);
  };
});
await page.goto(url); await page.waitForTimeout(1200);
const out = await page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const load = (n) => import(urls.find((u) => u.includes(`/src/audio/${n}.ts`)) ?? `/src/audio/${n}.ts`);
  const [sfx, music, ambience, engine, voices] = await Promise.all(["sfx", "music", "ambience", "engine", "voices"].map(load));
  const A = { ...sfx, ...music, ...ambience, ...engine, ...voices }; A.setMusic(""); A.setAmbience(""); A.setSound(true); A.setVolumes(0.7, 0.8); A.sfx.click();
  await new Promise((r) => setTimeout(r, 3000));
  const { an } = window.__tap, t = new Float32Array(an.fftSize), f = new Float32Array(an.frequencyBinCount);
  const measure = async (ms) => {
    let sum = 0, n = 0, num = 0, den = 0; const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getFloatTimeDomainData(t); for (const v of t) { sum += v * v; n++; }
      an.getFloatFrequencyData(f); f.forEach((db, i) => { const m = 10 ** (db / 20); num += m * i; den += m; });
      await new Promise((r) => setTimeout(r, 30));
    }
    return { rms: +Math.sqrt(sum / n).toFixed(4), centroidHz: Math.round((num / den) * an.context.sampleRate / an.fftSize) };
  };
  const res = {};
  for (const id of ["louse", "rat", "warden"]) for (const [k, dist, muffle] of [["看得见 3 格", 3, 0], ["拐角 5 步", 5, 0.5], ["隔墙", 5, 0.85]]) {
    await new Promise((r) => setTimeout(r, 400)); voices.creatureCall(id, 0, dist, muffle); res[`${id} ${k}`] = await measure(1300);
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
