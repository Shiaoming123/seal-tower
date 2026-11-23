// Plays every sound effect and music mood in Chrome, measures loudness/peaks, and records demo clips.
// Usage: node tests/audio-check.mjs [url]   (dev server)  → docs/audio-demo/*.webm
import { chromium } from "playwright-core";
import { writeFile } from "node:fs/promises";

const url = process.argv[2] ?? "http://localhost:5173";
const browser = await chromium.launch({ channel: "chrome", args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.addInitScript(() => {
  // Tap everything that reaches the speakers: an analyser for levels and a recorder for demo clips.
  const orig = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (dest, ...rest) {
    if (dest instanceof AudioDestinationNode && !window.__tap) {
      const a = this.context;
      const an = a.createAnalyser(); an.fftSize = 2048;
      const rec = a.createMediaStreamDestination();
      orig.call(this, an); orig.call(this, rec);
      window.__tap = { an, rec };
    }
    return orig.call(this, dest, ...rest);
  };
});
await page.goto(url);
await page.waitForTimeout(800);
const result = await page.evaluate(async () => {
  const { sfx, setSound, setVolumes } = await import("/src/audio/sfx.ts");
  const { setMusic } = await import("/src/audio/music.ts");
  setSound(true); setVolumes(0.7, 0.8);
  sfx.click();
  await new Promise((r) => setTimeout(r, 300));
  const { an } = window.__tap;
  const buf = new Float32Array(an.fftSize);
  const measure = async (ms) => {
    let peak = 0, sum = 0, n = 0;
    const end = performance.now() + ms;
    while (performance.now() < end) {
      an.getFloatTimeDomainData(buf);
      for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
      await new Promise((r) => setTimeout(r, 30));
    }
    return { peak: +peak.toFixed(3), rms: +Math.sqrt(sum / n).toFixed(4) };
  };
  const out = { sfx: {}, music: {} };
  for (const k of Object.keys(sfx)) { sfx[k](); out.sfx[k] = await measure(k === "bell" || k === "gong" || k === "lose" ? 1500 : 600); }
  for (const m of [["town", null], ["f1", null], ["f2", null], ["f3", null], ["f1", "fight"], ["f3", "boss"]]) {
    setMusic(m[0], m[1]);
    out.music[m.join(":")] = await measure(6000);
  }
  setMusic("");
  return out;
});
// Demo recordings: 20 s of each mood plus a sampler of effects.
const clips = [["town", null], ["f1", null], ["f2", null], ["f3", null], ["f2", "fight"], ["f3", "boss"], ["sfx", null]];
for (const [mood, fight] of clips) {
  const data = await page.evaluate(async ([mood, fight]) => {
    const { sfx } = await import("/src/audio/sfx.ts");
    const { setMusic } = await import("/src/audio/music.ts");
    const rec = new MediaRecorder(window.__tap.rec.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 });
    const parts = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    rec.start();
    if (mood === "sfx") {
      for (const k of ["click", "step", "step", "card", "hit", "heavy", "block", "hurt", "coin", "steal", "interrupt", "harvest", "drain", "burn", "turn", "bell", "gong", "win", "lose"]) {
        sfx[k](); await new Promise((r) => setTimeout(r, k === "bell" || k === "gong" || k === "lose" ? 1600 : 650));
      }
    } else { setMusic(mood, fight); await new Promise((r) => setTimeout(r, 20000)); setMusic(""); await new Promise((r) => setTimeout(r, 1500)); }
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    const blob = new Blob(parts, { type: "audio/webm" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, [mood, fight]);
  const name = fight ? `${mood}-${fight}` : mood;
  await writeFile(`docs/audio-demo/${name}.webm`, Buffer.from(data, "base64"));
}
console.log(JSON.stringify(result, null, 1));
console.log(errors.length ? errors : "no errors");
await browser.close();
