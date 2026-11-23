// Decode each demo clip in Chrome and report duration, peak, RMS and L/R difference (proves clips are not silent).
// Usage: node tests/audio-demo-check.mjs docs/audio-demo
import { chromium } from "playwright-core";
import { readFile, readdir } from "node:fs/promises";
const dir = process.argv[2];
const browser = await chromium.launch({ channel: "chrome" });
const page = await browser.newPage();
await page.goto("about:blank");
for (const f of (await readdir(dir)).filter((f) => f.endsWith(".webm")).sort()) {
  const b64 = (await readFile(`${dir}/${f}`)).toString("base64");
  const r = await page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const a = new OfflineAudioContext(2, 48000, 48000);
    const buf = await a.decodeAudioData(bin.buffer);
    let peak = 0, sum = 0; const L = buf.getChannelData(0), R = buf.getChannelData(1);
    let diff = 0;
    for (let i = 0; i < L.length; i++) { peak = Math.max(peak, Math.abs(L[i])); sum += L[i] * L[i]; diff += (L[i] - R[i]) ** 2; }
    return { dur: +buf.duration.toFixed(1), peak: +peak.toFixed(3), rms: +Math.sqrt(sum / L.length).toFixed(4), stereo: +Math.sqrt(diff / L.length).toFixed(4) };
  }, b64);
  console.log(f.padEnd(24), JSON.stringify(r));
}
await browser.close();
