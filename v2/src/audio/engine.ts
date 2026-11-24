// Audio engine: one context, a master compressor, music and SFX buses, and a generated reverb hall.
// Instruments are synthesised here (plucked strings by Karplus–Strong, a breathy dizi flute, bells,
// drums), so every sound in the game is original and needs no licence or download.

let ctx: AudioContext | null = null;
let master: GainNode;
let musicBus: GainNode;
let sfxBus: GainNode;
let reverbIn: GainNode;
let verbOut: GainNode | null = null;
let enabled = true;
let musicVol = 0.7;
let sfxVol = 0.8;

export function setEnabled(on: boolean) { enabled = on; if (ctx) master.gain.setTargetAtTime(on ? 0.9 : 0, ctx.currentTime, 0.05); }
export function setVolumes(music: number, sfx: number) {
  musicVol = music; sfxVol = sfx;
  if (ctx) { musicBus.gain.setTargetAtTime(music * 0.55, ctx.currentTime, 0.05); sfxBus.gain.setTargetAtTime(sfx, ctx.currentTime, 0.05); }
}

/** Generated impulse response: early reflections then a dark tail. `dark` 0..1, `early` = density of first reflections. */
function hallImpulse(a: AudioContext, seconds = 2.6, dark = 0.5, early = 0.004): AudioBuffer {
  const len = Math.floor(a.sampleRate * seconds);
  const buf = a.createBuffer(2, len, a.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / a.sampleRate;
      const env = Math.pow(1 - i / len, 3.2) * (t < 0.08 ? 0.6 + (Math.random() < early ? 2 : 0) : 1);
      const bright = 0.55 - 0.4 * dark;
      lp += (Math.random() * 2 - 1 - lp) * (bright - (bright - 0.06) * (i / len)); // darker as it decays
      d[i] = lp * env * 0.6;
    }
  }
  return buf;
}

// Browsers refuse to start audio before the player touches the page, and log a warning every time we ask.
// Ask only after the first tap or key (REVIEW-002: the playtest saw ~80 such warnings in one run).
let gestured = false;
// A touch counts only on its release (pointerup / touchend / click), so listen to all of them until audio is running.
if (typeof window !== "undefined") {
  const kinds = ["pointerdown", "pointerup", "touchend", "click", "keydown"] as const;
  const on = () => {
    gestured = true;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume().then(() => { if (ctx?.state === "running") off(); });
    else if (ctx.state === "running") off();
  };
  const off = () => kinds.forEach((k) => window.removeEventListener(k, on, true));
  kinds.forEach((k) => window.addEventListener(k, on, true));
}

export function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      master = ctx.createGain(); master.gain.value = 0.9;
      master.connect(comp).connect(ctx.destination);
      reverbIn = ctx.createGain(); reverbIn.gain.value = 1;
      swapRoom(ctx, room, 0);
      musicBus = ctx.createGain(); musicBus.gain.value = musicVol * 0.55;
      sfxBus = ctx.createGain(); sfxBus.gain.value = sfxVol;
      musicBus.connect(master); sfxBus.connect(master);
    } catch { return null; }
  }
  if (ctx.state === "suspended" && gestured) void ctx.resume();
  return ctx;
}

// ---------------------------------------------------------------- rooms

/** Each place has its own acoustic: the town street is open, the bridge damp and short, the belfry huge. */
const ROOMS: Record<string, { seconds: number; dark: number; early: number; level: number }> = {
  town: { seconds: 1.5, dark: 0.35, early: 0.002, level: 0.22 },
  f1: { seconds: 2.4, dark: 0.45, early: 0.006, level: 0.32 },
  f2: { seconds: 1.6, dark: 0.75, early: 0.01, level: 0.3 },
  f3: { seconds: 4.2, dark: 0.3, early: 0.003, level: 0.42 },
};
let room = "f1";

function swapRoom(a: AudioContext, key: string, fade: number) {
  const r = ROOMS[key] ?? ROOMS.f1;
  const verb = a.createConvolver();
  verb.buffer = hallImpulse(a, r.seconds, r.dark, r.early);
  const g = a.createGain();
  g.gain.setValueAtTime(fade ? 0.0001 : r.level, a.currentTime);
  if (fade) g.gain.exponentialRampToValueAtTime(r.level, a.currentTime + fade);
  reverbIn.connect(verb).connect(g).connect(master);
  const old = verbOut;
  if (old) { old.gain.setTargetAtTime(0.0001, a.currentTime, fade / 3 || 0.01); setTimeout(() => old.disconnect(), (fade + 1) * 1000); }
  verbOut = g;
}

/** Change the reverb to suit the place ("town" | "f1" | "f2" | "f3"), crossfading over a second. */
export function setRoom(key: string) {
  if (!ROOMS[key] || key === room) return;
  room = key;
  if (ctx) swapRoom(ctx, key, 1.2);
}

export const running = () => !!ctx && ctx.state === "running" && enabled;

/** A voice output: dry to the bus, plus a send into the reverb. */
export function out(bus: "music" | "sfx", wet = 0.3): AudioNode | null {
  const a = ac(); if (!a) return null;
  const g = a.createGain();
  g.connect(bus === "music" ? musicBus : sfxBus);
  if (wet > 0) { const s = a.createGain(); s.gain.value = wet; g.connect(s).connect(reverbIn); }
  return g;
}

/**
 * A positioned voice output: panned left/right, quieter and duller with distance (`dist` in tiles), and more
 * of it in the reverb when far away. `muffle` adds extra dulling (behind a wall, in fog).
 */
export function spatial(pan: number, dist: number, muffle = 0): AudioNode | null {
  const a = ac(); if (!a) return null;
  const d = Math.max(0.6, dist);
  const dest = out("sfx", Math.min(0.9, 0.2 + d * 0.15));
  if (!dest) return null;
  const g = a.createGain(); g.gain.value = Math.min(1, 1.4 / (0.4 + d));
  const lp = a.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = Math.max(500, 9000 / (1 + (d - 1) * 0.7) * (1 - muffle * 0.7)); lp.Q.value = 0.5;
  const p = a.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(lp).connect(p).connect(dest);
  return g;
}

// ---------------------------------------------------------------- noise

let noiseBuf: AudioBuffer | null = null;
export function noise(a: AudioContext): AudioBuffer {
  if (!noiseBuf) {
    noiseBuf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/** Filtered noise burst with an envelope and an optional filter sweep. */
export function noiseHit(dest: AudioNode, when: number, o: { dur: number; vol: number; type?: BiquadFilterType; f0: number; f1?: number; q?: number; attack?: number }) {
  const a = ac(); if (!a) return;
  const src = a.createBufferSource(); src.buffer = noise(a);
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = a.createBiquadFilter(); f.type = o.type ?? "bandpass"; f.Q.value = o.q ?? 1;
  f.frequency.setValueAtTime(o.f0, when);
  if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, when + o.dur);
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(o.vol, when + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
  src.connect(f).connect(g).connect(dest);
  src.start(when, Math.random()); src.stop(when + o.dur + 0.05);
}

/** Simple enveloped oscillator, with optional pitch slide. */
export function osc(dest: AudioNode, when: number, o: { freq: number; dur: number; vol: number; type?: OscillatorType; slideTo?: number; attack?: number; detune?: number }) {
  const a = ac(); if (!a) return;
  const v = a.createOscillator(); v.type = o.type ?? "sine";
  v.frequency.setValueAtTime(o.freq, when);
  if (o.slideTo) v.frequency.exponentialRampToValueAtTime(Math.max(20, o.slideTo), when + o.dur);
  if (o.detune) v.detune.value = o.detune;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(o.vol, when + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, when + o.dur);
  v.connect(g).connect(dest);
  v.start(when); v.stop(when + o.dur + 0.05);
}

/** Inharmonic partials: bells, gongs, metal clangs. */
export function metal(dest: AudioNode, when: number, base: number, partials: [number, number, number][], vol = 1) {
  for (const [mul, v, dur] of partials) osc(dest, when, { freq: base * mul, dur, vol: v * vol, attack: 0.002 });
}

// ---------------------------------------------------------------- plucked strings (Karplus–Strong)

const pluckCache = new Map<string, AudioBuffer>();

/**
 * Render a plucked string offline. `bright` 0..1 (guqin dark … pipa bright), `decay` close to 1 = longer.
 */
function pluckBuffer(a: AudioContext, freq: number, bright: number, decay: number, seconds: number): AudioBuffer {
  const key = `${Math.round(freq * 10)}:${bright}:${decay}:${seconds}`;
  const hit = pluckCache.get(key);
  if (hit) return hit;
  const sr = a.sampleRate;
  const len = Math.floor(sr * seconds);
  const buf = a.createBuffer(1, len, sr);
  const d = buf.getChannelData(0);
  const N = Math.max(2, Math.round(sr / freq));
  const line = new Float32Array(N);
  // Excitation: noise softened by a one-pole lowpass (darker = more like a finger on silk).
  let lp = 0;
  for (let i = 0; i < N; i++) { lp += (Math.random() * 2 - 1 - lp) * (0.15 + 0.8 * bright); line[i] = lp; }
  // Pluck position comb gives the body of the tone.
  const pos = Math.floor(N * (0.12 + 0.1 * (1 - bright)));
  for (let i = N - 1; i >= pos; i--) line[i] -= line[i - pos] * 0.6;
  // Karplus–Strong: each pass averages neighbouring samples (a gentle lowpass) and loses a little energy.
  let idx = 0;
  for (let i = 0; i < len; i++) {
    const nxt = (idx + 1) % N;
    const y = line[idx];
    d[i] = y;
    line[idx] = decay * 0.5 * (y + line[nxt]);
    idx = nxt;
  }
  // Normalise.
  let peak = 0;
  for (let i = 0; i < Math.min(len, 4000); i++) peak = Math.max(peak, Math.abs(d[i]));
  if (peak > 0) for (let i = 0; i < len; i++) d[i] /= peak;
  pluckCache.set(key, buf);
  return buf;
}

export type StringVoice = "guqin" | "pipa" | "zheng";
const VOICES: Record<StringVoice, { bright: number; decay: number; seconds: number }> = {
  guqin: { bright: 0.25, decay: 0.9965, seconds: 3.2 },
  pipa: { bright: 0.75, decay: 0.993, seconds: 1.6 },
  zheng: { bright: 0.55, decay: 0.996, seconds: 2.6 },
};

/** Play a plucked note; `slide` bends the pitch by semitones over the note (guqin 吟猱 / glissando). */
export function pluck(dest: AudioNode, when: number, freq: number, vol: number, voice: StringVoice = "guqin", slide = 0, pan = 0) {
  const a = ac(); if (!a) return;
  const v = VOICES[voice];
  const src = a.createBufferSource();
  src.buffer = pluckBuffer(a, freq, v.bright, v.decay, v.seconds);
  if (slide) {
    src.playbackRate.setValueAtTime(1, when + 0.12);
    src.playbackRate.linearRampToValueAtTime(Math.pow(2, slide / 12), when + 0.5);
  }
  const g = a.createGain(); g.gain.value = vol;
  const body = a.createBiquadFilter(); body.type = "peaking"; body.frequency.value = voice === "guqin" ? 220 : 900; body.gain.value = 4; body.Q.value = 0.8;
  const p = a.createStereoPanner(); p.pan.value = pan;
  src.connect(body).connect(g).connect(p).connect(dest);
  src.start(when); src.stop(when + v.seconds);
}

// ---------------------------------------------------------------- dizi (bamboo flute)

/** A breathy flute note with delayed vibrato. */
export function flute(dest: AudioNode, when: number, freq: number, dur: number, vol: number) {
  const a = ac(); if (!a) return;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(vol, when + 0.09);
  g.gain.setValueAtTime(vol, when + Math.max(0.1, dur - 0.15));
  g.gain.linearRampToValueAtTime(0.0001, when + dur);
  const vib = a.createOscillator(), vibAmt = a.createGain();
  vib.frequency.value = 5.2;
  vibAmt.gain.setValueAtTime(0, when);
  vibAmt.gain.linearRampToValueAtTime(freq * 0.012, when + Math.min(0.5, dur * 0.5));
  vib.connect(vibAmt);
  for (const [mul, v] of [[1, 1], [2, 0.18], [3, 0.06]] as const) {
    const o = a.createOscillator(); o.type = "sine"; o.frequency.value = freq * mul;
    vibAmt.connect(o.frequency);
    const og = a.createGain(); og.gain.value = v * 0.6;
    o.connect(og).connect(g);
    o.start(when); o.stop(when + dur + 0.05);
  }
  // Breath: band-passed noise riding the pitch, the "dimo" buzz of a dizi.
  const n = a.createBufferSource(); n.buffer = noise(a); n.loop = true;
  const bp = a.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = freq * 2; bp.Q.value = 6;
  const ng = a.createGain(); ng.gain.value = 0.22;
  n.connect(bp).connect(ng).connect(g);
  n.start(when, Math.random()); n.stop(when + dur + 0.05);
  vib.start(when); vib.stop(when + dur + 0.05);
  g.connect(dest);
}

// ---------------------------------------------------------------- percussion

export function bigDrum(dest: AudioNode, when: number, vol: number) {
  osc(dest, when, { freq: 95, slideTo: 42, dur: 0.45, vol: vol });
  noiseHit(dest, when, { dur: 0.06, vol: vol * 0.5, type: "lowpass", f0: 1800 });
}
export function woodblock(dest: AudioNode, when: number, vol: number, high = false) {
  osc(dest, when, { freq: high ? 1350 : 920, dur: 0.07, vol, type: "sine" });
  noiseHit(dest, when, { dur: 0.03, vol: vol * 0.4, f0: high ? 3200 : 2200, q: 4 });
}
export function templeBell(dest: AudioNode, when: number, base: number, vol: number) {
  metal(dest, when, base, [[1, 0.5, 4.5], [2.01, 0.25, 3.2], [2.76, 0.2, 2.6], [5.4, 0.08, 1.6], [8.93, 0.04, 0.9]], vol);
}
export function gong(dest: AudioNode, when: number, vol: number) {
  metal(dest, when, 70, [[1, 0.5, 4], [1.47, 0.35, 3.5], [2.09, 0.25, 3], [2.56, 0.2, 2.5], [3.42, 0.12, 2]], vol);
  noiseHit(dest, when, { dur: 1.8, vol: vol * 0.25, type: "bandpass", f0: 400, f1: 180, q: 0.7, attack: 0.05 });
}
