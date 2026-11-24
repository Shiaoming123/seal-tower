// Monster calls: every kind of 妖 has a short voice, played from where it stands (left/right, near/far),
// so you hear what is around the corner before you see it.
import { ac, metal, noiseHit, osc, spatial, templeBell } from "./engine";

const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
type Call = (d: AudioNode, t: number) => void;

const flutter: Call = (d, t) => {
  // Wings: quick bursts of soft noise at wing-beat rate.
  for (let i = 0; i < 9; i++) noiseHit(d, t + i * 0.045, { dur: 0.04, vol: 0.27 * (1 - i / 12), type: "lowpass", f0: 700, q: 1 });
};
const squeak: Call = (d, t) => {
  osc(d, t, { freq: rand(2600, 3200), slideTo: 4200, dur: 0.07, vol: 0.06 });
  osc(d, t + 0.1, { freq: rand(3000, 3600), slideTo: 2400, dur: 0.09, vol: 0.05 });
  noiseHit(d, t, { dur: 0.2, vol: 0.05, f0: 3000, q: 1 });
};
const clicks: Call = (d, t) => { for (let i = 0; i < 7; i++) noiseHit(d, t + i * rand(0.03, 0.06), { dur: 0.015, vol: 0.25, f0: rand(3500, 6000), q: 4 }); };
const growl: Call = (d, t) => {
  // A throat growl: a low buzzy tone shaken by a fast tremolo (60–100% of the envelope).
  const a = ac()!;
  const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(rand(70, 90), t); o.frequency.linearRampToValueAtTime(rand(55, 70), t + 0.9);
  const trem = a.createOscillator(); trem.frequency.value = rand(22, 30);
  const tg = a.createGain(); tg.gain.value = 0.2;
  const shake = a.createGain(); shake.gain.value = 0.8;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600; lp.Q.value = 3;
  trem.connect(tg).connect(shake.gain);
  o.connect(lp).connect(shake).connect(g).connect(d);
  o.start(t); trem.start(t); o.stop(t + 1.05); trem.stop(t + 1.05);
};
const yip: Call = (d, t) => {
  // A fox's cry: a hoarse, falling yelp, twice.
  for (const k of [0, 0.32]) {
    osc(d, t + k, { freq: rand(900, 1100), slideTo: rand(550, 650), dur: 0.22, vol: 0.05, type: "sawtooth", attack: 0.02 });
    noiseHit(d, t + k, { dur: 0.2, vol: 0.04, f0: 1400, q: 3 });
  }
};
const hum: Call = (d, t) => templeBell(d, t, rand(55, 62), 0.06);
const crackle: Call = (d, t) => {
  for (let i = 0; i < 10; i++) noiseHit(d, t + i * rand(0.02, 0.07), { dur: 0.03, vol: rand(0.04, 0.1), f0: rand(1500, 5000), q: 3 });
  noiseHit(d, t, { dur: 0.6, vol: 0.04, type: "lowpass", f0: 500, attack: 0.15 });
};
const paper: Call = (d, t) => {
  for (let i = 0; i < 4; i++) noiseHit(d, t + i * rand(0.06, 0.12), { dur: rand(0.08, 0.16), vol: 0.07, type: "highpass", f0: rand(2500, 4000), attack: 0.02 });
};
const giggle: Call = (d, t) => { paper(d, t); for (let i = 0; i < 4; i++) osc(d, t + 0.25 + i * 0.11, { freq: 700 - i * 40, slideTo: 640 - i * 40, dur: 0.08, vol: 0.025, type: "triangle" }); };
const moan: Call = (d, t) => {
  osc(d, t, { freq: 230, slideTo: 170, dur: 1.4, vol: 0.036, type: "triangle", attack: 0.35 });
  osc(d, t, { freq: 233, slideTo: 168, dur: 1.4, vol: 0.024, type: "sine", attack: 0.4 });
  for (let i = 0; i < 4; i++) osc(d, t + 0.4 + i * 0.15, { freq: rand(300, 600), slideTo: rand(800, 1100), dur: 0.04, vol: 0.02 });
};
const grind: Call = (d, t) => {
  noiseHit(d, t, { dur: 0.9, vol: 0.12, type: "lowpass", f0: 260, f1: 180, q: 2, attack: 0.2 });
  osc(d, t, { freq: 48, slideTo: 42, dur: 0.9, vol: 0.06, type: "triangle", attack: 0.2 });
};
const clank: Call = (d, t) => {
  metal(d, t, rand(380, 430), [[1, 0.06, 0.5], [2.3, 0.04, 0.35], [3.9, 0.02, 0.2]]);
  metal(d, t + 0.28, rand(330, 360), [[1, 0.05, 0.4], [2.6, 0.03, 0.3]]);
};
const hoot: Call = (d, t) => {
  osc(d, t, { freq: 400, slideTo: 380, dur: 0.3, vol: 0.06, attack: 0.06 });
  osc(d, t + 0.4, { freq: 420, slideTo: 360, dur: 0.55, vol: 0.06, attack: 0.08 });
};
const chant: Call = (d, t) => {
  // A muttered low chant: two detuned buzzes through a vowel-like formant.
  const a = ac()!;
  const g = a.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  const f = a.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(650, t); f.frequency.linearRampToValueAtTime(400, t + 1.2); f.Q.value = 4;
  for (const fr of [110, 110.8]) { const o = a.createOscillator(); o.type = "sawtooth"; o.frequency.value = fr; o.connect(f); o.start(t); o.stop(t + 1.35); }
  f.connect(g).connect(d);
};

const VOICE_GAIN = 3;

const CALLS: Record<string, Call> = {
  moth: flutter, "ink-moth": flutter, "moth-queen": (d, t) => { flutter(d, t); flutter(d, t + 0.5); },
  rat: squeak, "fire-rat": (d, t) => { squeak(d, t); crackle(d, t + 0.15); },
  louse: clicks,
  "mirror-fox": yip, "night-fox": yip, "fake-fox": yip, warden: growl,
  bell: hum,
  "lantern-spirit": crackle,
  "paper-doll": giggle, "paper-matron": (d, t) => { paper(d, t); moan(d, t + 0.2); },
  "water-ghost": moan,
  "stele-spirit": grind, "thorn-stele": grind,
  "bronze-puppet": clank,
  "night-owl": hoot,
  fallen: chant, "fallen-elder": chant,
};

/**
 * Play a monster's call. `pan` -1 (left) … 1 (right); `dist` in tiles; `behind` muffles it as if
 * through a wall or from behind you.
 */
/** `muffle` 0–1: 0 in plain view, about 0.5 around a corner, about 0.85 through a wall. */
export function creatureCall(enemyId: string, pan = 0, dist = 1, muffle = 0) {
  const a = ac(); if (!a) return;
  const call = CALLS[enemyId] ?? growl;
  const d = spatial(pan, dist, muffle); if (!d) return;
  // Calls are written quiet; this lifts them to sit just above the footsteps at 1–2 tiles.
  const lift = a.createGain(); lift.gain.value = VOICE_GAIN; lift.connect(d);
  call(lift, a.currentTime + 0.02);
}
