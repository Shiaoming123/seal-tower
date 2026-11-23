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
await page.waitForTimeout(1200);
// Use the same module instances the app loaded (after edits Vite serves them as `engine.ts?t=…`); importing
// the bare path would start a second audio engine while the app's own town music keeps playing underneath.
await page.evaluate(async () => {
  const urls = performance.getEntriesByType("resource").map((e) => e.name);
  const load = (name) => import(urls.find((u) => u.includes(`/src/audio/${name}.ts`)) ?? `/src/audio/${name}.ts`);
  const [sfx, music, ambience, engine, voices] = await Promise.all(["sfx", "music", "ambience", "engine", "voices"].map(load));
  window.__A = { ...sfx, ...music, ...ambience, ...engine, ...voices };
  window.__A.setMusic(""); window.__A.setAmbience("");
  await new Promise((r) => setTimeout(r, 3000));
});
const result = await page.evaluate(async () => {
  const { sfx, setSound, setVolumes, setMusic } = window.__A;
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
  const out = { sfx: {}, music: {}, floor: { silence: await measure(1500) } };
  for (const k of Object.keys(sfx)) { sfx[k](); out.sfx[k] = await measure(k === "bell" || k === "gong" || k === "lose" ? 1500 : 600); }
  for (const m of [["town", null], ["f1", null], ["f2", null], ["f3", null], ["f1", "fight"], ["f3", "boss"]]) {
    setMusic(m[0], m[1]);
    out.music[m.join(":")] = await measure(6000);
  }
  setMusic("");
  // Ambience per place and omen, footsteps per surface, monster calls, battle intensity layers.
  const { setAmbience, setRoom, creatureCall, setIntensity } = window.__A;
  out.ambience = {};
  for (const [m, o] of [["town", "calm"], ["f1", "calm"], ["f2", "calm"], ["f3", "calm"], ["f1", "rain"], ["f2", "fog"], ["f3", "festival"], ["f3", "bloodmoon"]]) {
    setRoom(m); setAmbience(m, o); await new Promise((r) => setTimeout(r, 1600));
    out.ambience[`${m}:${o}`] = await measure(5000);
  }
  setAmbience("");
  await new Promise((r) => setTimeout(r, 2500));
  out.steps = {};
  for (const [surf, rain] of [["wood", false], ["stone", false], ["wet", false], ["stone", true]]) { sfx.step(surf, rain); out.steps[surf + (rain ? "+rain" : "")] = await measure(500); }
  out.voices = {};
  for (const id of ["moth", "rat", "louse", "warden", "mirror-fox", "bell", "lantern-spirit", "paper-doll", "water-ghost", "stele-spirit", "bronze-puppet", "night-owl", "fallen"]) { creatureCall(id, 0, 1.5); out.voices[id] = await measure(1300); }
  out.intensity = {};
  setMusic("f2", "fight");
  for (const lv of [0, 1, 2]) { setIntensity(lv); await new Promise((r) => setTimeout(r, 1500)); out.intensity[lv] = await measure(5000); }
  setIntensity(0); setMusic("");
  return out;
});
// Demo recordings: 20 s of each mood plus a sampler of effects.
const clips = (process.env.CLIPS ?? "town,f1,f2,f3,f2-fight,f3-boss,sfx,amb-f1,amb-f2,amb-f3,amb-f1-rain,amb-f3-festival,explore-f2,steps-voices,f2-fight-layers")
  .split(",").filter(Boolean).map((c) => { const [m, f] = c.split("-"); return [m, f === "fight" || f === "boss" ? f : null, c]; });
for (const [mood, fight, clip] of clips) {
  const data = await page.evaluate(async ([mood, fight, clip]) => {
    const { sfx, setMusic, setIntensity, setAmbience, setRoom, creatureCall } = window.__A;
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rec = new MediaRecorder(window.__tap.rec.stream, { mimeType: "audio/webm;codecs=opus", audioBitsPerSecond: 64000 });
    const parts = [];
    rec.ondataavailable = (e) => parts.push(e.data);
    rec.start();
    if (clip?.startsWith("amb-")) {
      // Ambience alone: 20 s of a place (and its omen).
      const [, m, o] = clip.split("-");
      setRoom(m); setAmbience(m, o ?? "calm"); await wait(20000); setAmbience(""); await wait(2000);
    } else if (clip === "explore-f2") {
      // What exploring 桥驿 sounds like: music + ambience + wet footsteps + a monster calling from the left.
      setRoom("f2"); setMusic("f2"); setAmbience("f2", "calm");
      for (let i = 0; i < 24; i++) { sfx.step("wet"); await wait(i % 6 === 5 ? 1400 : 520); if (i === 8) creatureCall("water-ghost", -0.8, 3); if (i === 16) creatureCall("rat", 0.7, 2); }
      setMusic(""); setAmbience(""); await wait(2000);
    } else if (clip === "steps-voices") {
      for (const [surf, rain] of [["wood", false], ["stone", false], ["wet", false], ["stone", true]]) { for (let i = 0; i < 4; i++) { sfx.step(surf, rain); await wait(480); } await wait(500); }
      for (const [id, pan] of [["moth", -0.8], ["rat", 0.8], ["louse", 0], ["warden", -0.5], ["mirror-fox", 0.6], ["bell", 0], ["lantern-spirit", -0.6], ["paper-doll", 0.6], ["water-ghost", -0.3], ["stele-spirit", 0.3], ["bronze-puppet", -0.7], ["night-owl", 0.7], ["fallen", 0]]) { creatureCall(id, pan, 1.5); await wait(1500); }
    } else if (clip === "f2-fight-layers") {
      // The same fight getting tenser: 8 s at each intensity.
      setMusic("f2", "fight"); for (const lv of [0, 1, 2]) { setIntensity(lv); await wait(8000); } setIntensity(0); setMusic(""); await wait(1500);
    } else if (mood === "sfx") {
      for (const k of ["click", "step", "step", "card", "hit", "heavy", "block", "hurt", "coin", "steal", "interrupt", "harvest", "drain", "burn", "draw", "turn", "bell", "gong", "win", "lose"]) {
        sfx[k](); await new Promise((r) => setTimeout(r, k === "bell" || k === "gong" || k === "lose" ? 1600 : 650));
      }
    } else { setMusic(mood, fight); await new Promise((r) => setTimeout(r, 20000)); setMusic(""); await new Promise((r) => setTimeout(r, 1500)); }
    await new Promise((r) => { rec.onstop = r; rec.stop(); });
    const blob = new Blob(parts, { type: "audio/webm" });
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = ""; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  }, [mood, fight, clip]);
  const name = clip;
  await writeFile(`docs/audio-demo/${name}.webm`, Buffer.from(data, "base64"));
}
console.log(JSON.stringify(result, null, 1));
console.log(errors.length ? errors : "no errors");
await browser.close();
