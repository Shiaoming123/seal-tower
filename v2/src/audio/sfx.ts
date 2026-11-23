// Sound effects, layered from the engine's building blocks: noise sweeps for swishes and impacts,
// inharmonic partials for metal, plucked strings for the musical cues.
import { ac, bigDrum, gong, metal, noiseHit, osc, out, pluck, setEnabled, setVolumes, templeBell, woodblock } from "./engine";

export { setVolumes };
export function setSound(on: boolean) { setEnabled(on); }

const fx = (wet = 0.15) => { const a = ac(); const d = out("sfx", wet); return a && d ? { a, d, t: a.currentTime + 0.005 } : null; };
const rand = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
let stepSide = false;
export type Surface = "wood" | "stone" | "wet";
/** What the floor of each level is made of. */
export const SURFACE: Record<number, Surface> = { 1: "wood", 2: "wet", 3: "stone" };

export const sfx = {
  /** UI tap: a small wooden tick. */
  click: () => { const s = fx(0.05); if (!s) return; woodblock(s.d, s.t, 0.05, true); },
  /**
   * Footstep, alternating feet, by surface: "wood" boards that give a little, "stone" with a gritty scuff,
   * "wet" stone with a splash. `rain` adds a splash on any floor.
   */
  step: (surface: Surface = "stone", rain = false) => {
    const s = fx(0.2); if (!s) return;
    stepSide = !stepSide;
    const side = stepSide ? 1 : 0.85;
    if (surface === "wood") {
      osc(s.d, s.t, { freq: rand(105, 125) * side, slideTo: 70, dur: 0.12, vol: 0.14, type: "triangle" });
      noiseHit(s.d, s.t, { dur: 0.08, vol: 0.12, type: "bandpass", f0: rand(380, 460), q: 2.5 });
      if (Math.random() < 0.18) osc(s.d, s.t + 0.05, { freq: rand(260, 340), slideTo: rand(220, 400), dur: 0.3, vol: 0.02, type: "sawtooth", attack: 0.06 });
    } else {
      noiseHit(s.d, s.t, { dur: 0.1, vol: 0.3, type: "lowpass", f0: 560 * side, q: 0.7 });
      osc(s.d, s.t, { freq: rand(70, 85), slideTo: 50, dur: 0.08, vol: 0.08 });
      noiseHit(s.d, s.t + 0.02, { dur: 0.07, vol: surface === "stone" ? 0.11 : 0.05, f0: rand(2200, 3000), q: 1.5 });
    }
    if (surface === "wet" || rain) {
      noiseHit(s.d, s.t + 0.015, { dur: 0.16, vol: 0.08, type: "bandpass", f0: rand(1200, 1700), f1: 2600, q: 1.2, attack: 0.01 });
      for (let i = 0; i < 3; i++) osc(s.d, s.t + 0.04 + i * rand(0.02, 0.05), { freq: rand(900, 1600), slideTo: rand(1800, 2600), dur: 0.035, vol: 0.02 });
    }
  },
  bump: () => { const s = fx(0.2); if (!s) return; osc(s.d, s.t, { freq: 80, slideTo: 50, dur: 0.15, vol: 0.25 }); noiseHit(s.d, s.t, { dur: 0.08, vol: 0.15, type: "lowpass", f0: 600 }); },
  /** Card leaves the hand: a paper swish. */
  card: () => { const s = fx(0.05); if (!s) return; noiseHit(s.d, s.t, { dur: 0.14, vol: 0.12, type: "bandpass", f0: 2800, f1: 6500, q: 1.2, attack: 0.03 }); },
  /** Sword hit: whoosh, impact, a short ring of steel. */
  hit: () => {
    const s = fx(0.2); if (!s) return;
    noiseHit(s.d, s.t, { dur: 0.12, vol: 0.16, type: "highpass", f0: 5000, f1: 1500, attack: 0.02 });
    noiseHit(s.d, s.t + 0.05, { dur: 0.1, vol: 0.32, type: "lowpass", f0: 1400 });
    osc(s.d, s.t + 0.05, { freq: 160, slideTo: 70, dur: 0.14, vol: 0.22 });
    metal(s.d, s.t + 0.05, rand(1700, 2000), [[1, 0.05, 0.25], [1.48, 0.03, 0.18]]);
  },
  /** Heavy hit: bigger impact, crunch and a low boom. */
  heavy: () => {
    const s = fx(0.3); if (!s) return;
    noiseHit(s.d, s.t, { dur: 0.16, vol: 0.2, type: "highpass", f0: 4000, f1: 900, attack: 0.03 });
    noiseHit(s.d, s.t + 0.07, { dur: 0.22, vol: 0.45, type: "lowpass", f0: 1100 });
    bigDrum(s.d, s.t + 0.07, 0.4);
    metal(s.d, s.t + 0.07, rand(1100, 1300), [[1, 0.07, 0.4], [1.62, 0.04, 0.3]]);
  },
  /** You take damage: body thud and a dull crack. */
  hurt: () => {
    const s = fx(0.15); if (!s) return;
    noiseHit(s.d, s.t, { dur: 0.18, vol: 0.35, type: "lowpass", f0: 700 });
    osc(s.d, s.t, { freq: 120, slideTo: 60, dur: 0.22, vol: 0.25, type: "triangle" });
    noiseHit(s.d, s.t + 0.01, { dur: 0.05, vol: 0.12, f0: 3000, q: 2 });
  },
  /** Block: a bright metal clang. */
  block: () => {
    const s = fx(0.25); if (!s) return;
    metal(s.d, s.t, rand(500, 560), [[1, 0.12, 0.5], [2.52, 0.08, 0.35], [4.1, 0.05, 0.25], [6.3, 0.03, 0.15]]);
    noiseHit(s.d, s.t, { dur: 0.05, vol: 0.18, f0: 4000, q: 1 });
  },
  /** Coins on a counter. */
  coin: () => {
    const s = fx(0.2); if (!s) return;
    for (let i = 0; i < 3; i++) metal(s.d, s.t + i * rand(0.04, 0.07), rand(2600, 3400), [[1, 0.05, 0.25], [1.34, 0.03, 0.2], [2.1, 0.015, 0.12]]);
  },
  /** A thief strikes: a squeak and a rustle. */
  steal: () => {
    const s = fx(0.1); if (!s) return;
    osc(s.d, s.t, { freq: 1800, slideTo: 3200, dur: 0.08, vol: 0.06, type: "sine" });
    osc(s.d, s.t + 0.09, { freq: 2800, slideTo: 1600, dur: 0.1, vol: 0.05, type: "sine" });
    noiseHit(s.d, s.t, { dur: 0.25, vol: 0.12, f0: 1800, f1: 900, q: 0.8 });
  },
  /** Interrupt: a cracking chime and a falling tone. */
  interrupt: () => {
    const s = fx(0.35); if (!s) return;
    metal(s.d, s.t, 1320, [[1, 0.09, 0.6], [1.5, 0.06, 0.5], [2.7, 0.04, 0.35]]);
    noiseHit(s.d, s.t, { dur: 0.2, vol: 0.2, type: "highpass", f0: 6000, f1: 2000 });
    osc(s.d, s.t + 0.05, { freq: 600, slideTo: 150, dur: 0.4, vol: 0.08, type: "triangle" });
  },
  /** Temple bell: entering a floor, phase changes. */
  bell: () => { const s = fx(0.6); if (!s) return; templeBell(s.d, s.t, 196, 0.4); },
  gong: () => { const s = fx(0.5); if (!s) return; gong(s.d, s.t, 0.45); },
  /** Victory flourish: a rising pipa run. */
  win: () => { const s = fx(0.35); if (!s) return; [0, 4, 7, 12].forEach((n, i) => pluck(s.d, s.t + i * 0.08, 392 * Math.pow(2, n / 12), 0.4, "pipa")); },
  lose: () => { const s = fx(0.4); if (!s) return; pluck(s.d, s.t, 98, 0.6, "guqin", -3); noiseHit(s.d, s.t + 0.1, { dur: 1, vol: 0.08, type: "lowpass", f0: 400 }); },
  /** Drawing a hand: quick paper flicks, one per card. */
  draw: (n = 5) => {
    const s = fx(0.05); if (!s) return;
    for (let i = 0; i < Math.min(n, 8); i++) noiseHit(s.d, s.t + i * rand(0.045, 0.07), { dur: 0.06, vol: 0.06, type: "bandpass", f0: rand(3000, 4200), f1: rand(5000, 7000), q: 1.5, attack: 0.01 });
  },
  /** Your turn starts: one soft woodblock. */
  turn: () => { const s = fx(0.1); if (!s) return; woodblock(s.d, s.t, 0.08); },
  /** Harvest succeeded: a bright pipa chime. */
  harvest: () => { const s = fx(0.35); if (!s) return; pluck(s.d, s.t, 784, 0.35, "pipa"); pluck(s.d, s.t + 0.09, 1175, 0.3, "pipa"); },
  /** Oil drained / ash eaten: a bubbling gulp. */
  drain: () => { const s = fx(0.1); if (!s) return; for (let i = 0; i < 3; i++) osc(s.d, s.t + i * 0.06, { freq: rand(300, 500), slideTo: rand(700, 900), dur: 0.06, vol: 0.06 }); },
  /** Burn tick: a crackle. */
  burn: () => { const s = fx(0.1); if (!s) return; for (let i = 0; i < 4; i++) noiseHit(s.d, s.t + i * rand(0.02, 0.05), { dur: 0.04, vol: 0.12, f0: rand(2000, 5000), q: 3 }); },
};
