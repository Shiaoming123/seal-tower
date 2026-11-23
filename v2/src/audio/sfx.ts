// Small Web Audio synth. Nothing plays until the first user gesture.
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let music: GainNode | null = null;
let enabled = true;

export function setSound(on: boolean) { enabled = on; if (master) master.gain.value = on ? 0.5 : 0; }

function ac(): AudioContext | null {
  if (!enabled) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      music = ctx.createGain();
      music.gain.value = 0.55;
      music.connect(master);
    } catch { return null; }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Shared context for the music module (null while sound is off). */
export function audioContext(): AudioContext | null { return ac(); }
export function musicBus(): GainNode | null { ac(); return music; }

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0) {
  const a = ac(); if (!a || !master) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq: number, delay = 0) {
  const a = ac(); if (!a || !master) return;
  const t = a.currentTime + delay;
  const len = Math.floor(a.sampleRate * dur);
  const b = a.createBuffer(1, len, a.sampleRate);
  const data = b.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
  src.buffer = b; f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export const sfx = {
  click: () => tone(660, 0.05, "triangle", 0.08),
  step: () => noise(0.08, 0.12, 380),
  bump: () => { noise(0.06, 0.15, 160); tone(90, 0.08, "sine", 0.1); },
  card: () => { noise(0.05, 0.08, 2400); tone(520, 0.06, "triangle", 0.05, 1.4); },
  hit: () => { noise(0.12, 0.35, 1200); tone(180, 0.12, "square", 0.08, 0.5); },
  heavy: () => { noise(0.2, 0.45, 700); tone(110, 0.22, "sawtooth", 0.12, 0.4); },
  hurt: () => { noise(0.16, 0.3, 500); tone(140, 0.2, "sawtooth", 0.1, 0.6); },
  block: () => { tone(880, 0.09, "square", 0.05, 0.7); noise(0.06, 0.12, 3000); },
  coin: () => { tone(1320, 0.08, "triangle", 0.08); tone(1760, 0.12, "triangle", 0.06, 1, 0.06); },
  steal: () => { tone(500, 0.18, "square", 0.07, 0.4); noise(0.1, 0.2, 900, 0.05); },
  interrupt: () => { tone(300, 0.08, "square", 0.1, 2.5); tone(1200, 0.25, "triangle", 0.08, 0.6, 0.06); },
  bell: () => { tone(220, 1.4, "sine", 0.15, 0.98); tone(440, 1.0, "sine", 0.06, 0.99); tone(663, 0.8, "sine", 0.04); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, "triangle", 0.08, 1, i * 0.1)),
  lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.35, "sine", 0.1, 1, i * 0.16)),
  turn: () => tone(330, 0.12, "sine", 0.06, 1.5),
};
