// Ambience: each place has a quiet looping bed (wind, water, street murmur) and scattered one-shots
// (creaks, drips, chimes, a far bell), placed left or right in the stereo field. The floor's 签文 changes it:
// rain falls on 雨夜, 迷雾 muffles everything, 灯会 has firecrackers in the distance, 血月 hums low.
// Ambience sits on the effects bus, ducks under combat and crossfades when you change floors.
import { ac, metal, noise, noiseHit, osc, out, running, templeBell, woodblock } from "./engine";

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** A one-shot sound: plays into `dest` at time `t`. */
type Shot = (a: AudioContext, dest: AudioNode, t: number) => void;
interface ShotDef { every: [number, number]; far?: boolean; play: Shot }
interface Bed { f: number; q: number; vol: number; type?: BiquadFilterType; gust?: [rate: number, depth: number]; sweep?: [lo: number, hi: number, rate: number] }
interface Scene { beds: Bed[]; shots: ShotDef[] }

// ---------------------------------------------------------------- one-shots

const creak: Shot = (_a, d, t) => {
  // Old timber: a slow resonant squeal under a woody grind.
  const f = rand(180, 320);
  osc(d, t, { freq: f, slideTo: f * rand(0.75, 1.3), dur: rand(0.35, 0.7), vol: 0.035, type: "sawtooth", attack: 0.08 });
  noiseHit(d, t, { dur: 0.5, vol: 0.05, f0: f * 3, f1: f * 2, q: 8, attack: 0.1 });
};
const chime: Shot = (_a, d, t) => {
  // A small wind chime: three or four glassy notes.
  const base = pick([1568, 1760, 2093, 2349]);
  for (let i = 0, n = 3 + Math.floor(Math.random() * 2); i < n; i++) metal(d, t + i * rand(0.12, 0.3), base * pick([1, 1.122, 1.335, 1.5]), [[1, 0.025, 1.4], [2.76, 0.008, 0.7]]);
};
const rustle: Shot = (_a, d, t) => {
  // Paper lanterns or banners stirring.
  for (let i = 0; i < 3; i++) noiseHit(d, t + i * rand(0.05, 0.12), { dur: rand(0.12, 0.25), vol: 0.035, f0: rand(2500, 4500), q: 1.2, attack: 0.03 });
};
const drip: Shot = (_a, d, t) => {
  const f = rand(900, 1700);
  osc(d, t, { freq: f, slideTo: f * 1.9, dur: 0.06, vol: 0.06 });
  osc(d, t + 0.05, { freq: f * 1.4, slideTo: f * 1.1, dur: 0.12, vol: 0.02 });
};
const boatCreak: Shot = (a, d, t) => { creak(a, d, t); creak(a, d, t + rand(0.5, 0.9)); };
const farBell: Shot = (_a, d, t) => templeBell(d, t, pick([82.4, 98, 110]), 0.22);
const chains: Shot = (_a, d, t) => {
  for (let i = 0; i < 4; i++) metal(d, t + i * rand(0.06, 0.11), rand(900, 1300), [[1, 0.02, 0.18], [1.73, 0.012, 0.12]]);
};
const owl: Shot = (_a, d, t) => {
  osc(d, t, { freq: 420, slideTo: 390, dur: 0.35, vol: 0.03, type: "sine", attack: 0.08 });
  osc(d, t + 0.5, { freq: 410, slideTo: 360, dur: 0.6, vol: 0.03, type: "sine", attack: 0.1 });
};
const watchman: Shot = (_a, d, t) => {
  // 更夫: two knocks on the bamboo clapper, far down the street.
  woodblock(d, t, 0.05); woodblock(d, t + 0.32, 0.05);
};
const vendorBell: Shot = (_a, d, t) => {
  for (let i = 0; i < 2; i++) metal(d, t + i * 0.18, 2400, [[1, 0.02, 0.4], [2.4, 0.01, 0.25]]);
};
const firecrackers: Shot = (_a, d, t) => {
  // A string of firecrackers, far away and slightly irregular.
  let tt = t;
  for (let i = 0, n = 8 + Math.floor(Math.random() * 14); i < n; i++) { noiseHit(d, tt, { dur: 0.03, vol: rand(0.05, 0.11), type: "lowpass", f0: rand(1500, 3200) }); tt += rand(0.03, 0.09); }
};
const festivalDrum: Shot = (_a, d, t) => { for (let i = 0; i < 3; i++) osc(d, t + i * 0.36, { freq: 110, slideTo: 60, dur: 0.3, vol: 0.06 }); };
const heartbeat: Shot = (_a, d, t) => {
  osc(d, t, { freq: 55, slideTo: 40, dur: 0.18, vol: 0.12 });
  osc(d, t + 0.26, { freq: 50, slideTo: 38, dur: 0.22, vol: 0.09 });
};
const raindrop: Shot = (_a, d, t) => { osc(d, t, { freq: rand(1800, 3800), slideTo: rand(900, 1500), dur: 0.03, vol: rand(0.01, 0.03) }); };
const bubble: Shot = (_a, d, t) => { const f = rand(350, 900); osc(d, t, { freq: f, slideTo: f * rand(1.6, 2.4), dur: rand(0.02, 0.05), vol: rand(0.006, 0.018) }); };

// ---------------------------------------------------------------- scenes

const SCENES: Record<string, Scene> = {
  // 镇灯铺 at dusk: low street murmur, a watchman, a vendor's bell, chimes from the eaves.
  town: {
    beds: [{ f: 420, q: 0.7, vol: 0.05, gust: [0.09, 0.4] }, { f: 160, q: 0.5, vol: 0.05, type: "lowpass" }],
    shots: [
      { every: [14, 26], far: true, play: watchman },
      { every: [9, 18], play: chime },
      { every: [16, 30], far: true, play: vendorBell },
    ],
  },
  // 照影廊: draughts through a long wooden gallery, timber creaks, paper lanterns, a chime somewhere.
  f1: {
    beds: [{ f: 280, q: 0.8, vol: 0.09, type: "lowpass", gust: [0.07, 0.7] }, { f: 900, q: 2, vol: 0.02, gust: [0.11, 0.9] }],
    shots: [
      { every: [5, 11], play: creak },
      { every: [8, 15], play: rustle },
      { every: [12, 22], far: true, play: chime },
    ],
  },
  // 桥驿: water running under the bridge, drips, a moored boat creaking.
  f2: {
    beds: [{ f: 700, q: 0.9, vol: 0.09, gust: [0.23, 0.25] }, { f: 1600, q: 1.5, vol: 0.035, gust: [0.37, 0.4] }, { f: 200, q: 0.5, vol: 0.05, type: "lowpass" }],
    shots: [
      { every: [0.05, 0.16], play: bubble },
      { every: [1.5, 4], play: drip },
      { every: [10, 20], far: true, play: boatCreak },
    ],
  },
  // 钟楼: wind whistling through the louvres, a great bell far above, chains, an owl.
  f3: {
    beds: [{ f: 420, q: 7, vol: 0.05, sweep: [280, 720, 0.05], gust: [0.06, 0.8] }, { f: 160, q: 0.6, vol: 0.09, type: "lowpass", gust: [0.04, 0.6] }],
    shots: [
      { every: [18, 30], far: true, play: farBell },
      { every: [9, 17], play: chains },
      { every: [20, 35], far: true, play: owl },
    ],
  },
};

const OMENS: Record<string, Scene> = {
  rain: { beds: [{ f: 5000, q: 0.4, vol: 0.035, type: "highpass" }, { f: 1200, q: 0.6, vol: 0.03 }], shots: [{ every: [0.04, 0.14], play: raindrop }, { every: [0.6, 1.8], play: drip }] },
  festival: { beds: [], shots: [{ every: [7, 15], far: true, play: firecrackers }, { every: [12, 24], far: true, play: festivalDrum }] },
  bloodmoon: { beds: [{ f: 70, q: 3, vol: 0.12, type: "lowpass", gust: [0.13, 0.5] }], shots: [{ every: [6, 12], play: heartbeat }] },
  moon: { beds: [], shots: [{ every: [14, 26], far: true, play: owl }] },
};

// ---------------------------------------------------------------- player

interface Live { key: string; fade: GainNode[]; filters: BiquadFilterNode[]; sources: AudioScheduledSourceNode[]; shots: { def: ShotDef; next: number }[]; near: AudioNode; far: AudioNode }
let live: Live | null = null;
let timer = 0;
let combat = false;

const LEVEL = 0.9;
const duck = () => (combat ? 0.35 : 1) * LEVEL;

function chain(a: AudioContext, wet: number, fog: boolean, fades: GainNode[], filters: BiquadFilterNode[]) {
  const dest = out("sfx", wet)!;
  const fade = a.createGain();
  fade.gain.setValueAtTime(0.0001, a.currentTime);
  fade.gain.exponentialRampToValueAtTime(duck(), a.currentTime + 1.5);
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = fog ? 800 : 16000; lp.Q.value = 0.4;
  lp.connect(fade).connect(dest);
  fades.push(fade); filters.push(lp);
  return lp;
}

function build(a: AudioContext, mood: string, omen: string): Live {
  const fades: GainNode[] = [], filters: BiquadFilterNode[] = [], sources: AudioScheduledSourceNode[] = [];
  const fog = omen === "fog";
  const near = chain(a, 0.15, fog, fades, filters);
  const far = chain(a, 0.75, fog, fades, filters);
  const scenes = [SCENES[mood], OMENS[omen]].filter(Boolean) as Scene[];
  const t0 = a.currentTime;
  for (const sc of scenes) for (const b of sc.beds) {
    const src = a.createBufferSource(); src.buffer = noise(a); src.loop = true;
    src.playbackRate.value = rand(0.9, 1.1);
    const f = a.createBiquadFilter(); f.type = b.type ?? "bandpass"; f.frequency.value = b.f; f.Q.value = b.q;
    const g = a.createGain(); g.gain.value = b.vol;
    src.connect(f).connect(g).connect(near);
    // Gusts: two slow LFOs at unrelated rates, so the swell never sounds like a loop.
    if (b.gust) for (const [k, r] of [[1, b.gust[0]], [0.5, b.gust[0] * 2.7]] as const) {
      const l = a.createOscillator(); l.frequency.value = r;
      const lg = a.createGain(); lg.gain.value = b.vol * b.gust[1] * k * 0.6;
      l.connect(lg).connect(g.gain); l.start(t0); sources.push(l);
    }
    if (b.sweep) {
      const l = a.createOscillator(); l.frequency.value = b.sweep[2];
      const lg = a.createGain(); lg.gain.value = (b.sweep[1] - b.sweep[0]) / 2;
      f.frequency.value = (b.sweep[0] + b.sweep[1]) / 2;
      l.connect(lg).connect(f.frequency); l.start(t0); sources.push(l);
    }
    src.start(t0, Math.random()); sources.push(src);
  }
  const shots = scenes.flatMap((sc) => sc.shots).map((def) => ({ def, next: t0 + rand(def.every[0] * 0.3, def.every[1] * 0.6) }));
  return { key: `${mood}:${omen}`, fade: fades, filters, sources, shots, near, far };
}

function pump() {
  const a = ac();
  if (!a || !live || !running()) return;
  const horizon = a.currentTime + 0.4;
  for (const s of live.shots) {
    if (s.next < a.currentTime - 1) s.next = a.currentTime + rand(...s.def.every) * 0.5;
    while (s.next < horizon) {
      // Spread one-shots around the listener; far ones are mostly behind the reverb.
      const p = a.createStereoPanner(); p.pan.value = rand(-0.85, 0.85);
      p.connect(s.def.far ? live.far : live.near);
      s.def.play(a, p, s.next);
      setTimeout(() => p.disconnect(), (s.next - a.currentTime + 6) * 1000);
      s.next += rand(...s.def.every);
    }
  }
}

function stop(l: Live) {
  const a = ac(); if (!a) return;
  for (const f of l.fade) { f.gain.cancelScheduledValues(a.currentTime); f.gain.setTargetAtTime(0.0001, a.currentTime, 0.5); }
  setTimeout(() => { for (const s of l.sources) { try { s.stop(); } catch { /* already stopped */ } } for (const f of l.fade) f.disconnect(); }, 3000);
}

/** Set the ambience for a place ("town" | "f1" | "f2" | "f3" | "" for silence), the floor's omen, and whether a fight is on. */
export function setAmbience(mood: string, omen = "calm", inCombat = false) {
  const a = ac();
  const key = mood ? `${mood}:${omen}` : "";
  const duckChanged = inCombat !== combat;
  combat = inCombat;
  if (live && live.key === key) {
    if (duckChanged && a) for (const f of live.fade) { f.gain.cancelScheduledValues(a.currentTime); f.gain.setTargetAtTime(duck(), a.currentTime, 0.4); }
    return;
  }
  if (live) { stop(live); live = null; }
  clearInterval(timer);
  if (!key || !a || !SCENES[mood]) return;
  live = build(a, mood, omen);
  timer = window.setInterval(pump, 200);
}
