// Procedural background music: a low drone plus guqin-like pentatonic plucks, one mood per floor.
// Combat adds a soft drum pulse. Everything is synthesised; nothing to download, nothing licensed.
import { audioContext, musicBus } from "./sfx";

type Mood = { root: number; scale: number[]; tempo: number; drone: number; bell: boolean; density: number };

const MOODS: Record<string, Mood> = {
  // 照影廊: moonlit, unhurried (D minor pentatonic)
  f1: { root: 146.8, scale: [0, 3, 5, 7, 10, 12, 15], tempo: 820, drone: 73.4, bell: false, density: 0.55 },
  // 桥驿: watery, a little uneasy (E, with a flat second)
  f2: { root: 164.8, scale: [0, 1, 5, 7, 8, 12, 13], tempo: 720, drone: 82.4, bell: false, density: 0.6 },
  // 钟楼: heavy and sparse, with bells (A minor)
  f3: { root: 110, scale: [0, 3, 5, 7, 10, 12, 15], tempo: 980, drone: 55, bell: true, density: 0.45 },
  // 镇灯铺 / title: warm major pentatonic
  town: { root: 196, scale: [0, 2, 4, 7, 9, 12, 14], tempo: 760, drone: 98, bell: false, density: 0.5 },
};

let timer = 0;
let current = "";
let combat = false;
let droneNodes: { osc: OscillatorNode; gain: GainNode }[] = [];
let step = 0;

function pluck(freq: number, when: number, vol: number) {
  const a = audioContext(); const bus = musicBus();
  if (!a || !bus) return;
  // Two detuned triangles with a fast decay and a tiny pitch drop, like a plucked silk string.
  for (const detune of [-4, 5]) {
    const o = a.createOscillator(), g = a.createGain(), f = a.createBiquadFilter();
    o.type = "triangle";
    o.frequency.setValueAtTime(freq * 1.004, when);
    o.frequency.exponentialRampToValueAtTime(freq, when + 0.08);
    o.detune.value = detune;
    f.type = "lowpass"; f.frequency.value = 2400;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 1.6);
    o.connect(f).connect(g).connect(bus);
    o.start(when); o.stop(when + 1.7);
  }
}

function bell(freq: number, when: number) {
  const a = audioContext(); const bus = musicBus();
  if (!a || !bus) return;
  for (const [mul, vol] of [[1, 0.05], [2.76, 0.02], [5.4, 0.01]] as const) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = "sine"; o.frequency.value = freq * mul;
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 3.5);
    o.connect(g).connect(bus);
    o.start(when); o.stop(when + 3.6);
  }
}

function drum(when: number, accent: boolean) {
  const a = audioContext(); const bus = musicBus();
  if (!a || !bus) return;
  const o = a.createOscillator(), g = a.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(accent ? 90 : 70, when);
  o.frequency.exponentialRampToValueAtTime(40, when + 0.18);
  g.gain.setValueAtTime(accent ? 0.12 : 0.07, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.25);
  o.connect(g).connect(bus);
  o.start(when); o.stop(when + 0.3);
}

function startDrone(m: Mood) {
  stopDrone();
  const a = audioContext(); const bus = musicBus();
  if (!a || !bus) return;
  for (const [mul, vol] of [[1, 0.035], [1.5, 0.015]] as const) {
    const osc = a.createOscillator(), gain = a.createGain();
    osc.type = "sine"; osc.frequency.value = m.drone * mul;
    gain.gain.setValueAtTime(0.0001, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(vol, a.currentTime + 2);
    osc.connect(gain).connect(bus);
    osc.start();
    droneNodes.push({ osc, gain });
  }
}

function stopDrone() {
  const a = audioContext();
  for (const { osc, gain } of droneNodes) {
    if (a) { gain.gain.cancelScheduledValues(a.currentTime); gain.gain.setTargetAtTime(0.0001, a.currentTime, 0.4); }
    osc.stop((a?.currentTime ?? 0) + 1.5);
  }
  droneNodes = [];
}

function tickMusic() {
  const a = audioContext();
  const m = MOODS[current];
  // Before the first click the context is suspended; don't pile up notes for later.
  if (!a || !m || a.state !== "running") return;
  const now = a.currentTime + 0.05;
  step++;
  // A wandering melody: mostly steps along the scale, sometimes a rest.
  if (Math.random() < m.density + (combat ? 0.15 : 0)) {
    const deg = m.scale[Math.floor(Math.abs(Math.sin(step * 1.7) * 7 + Math.random() * 2)) % m.scale.length];
    pluck(m.root * Math.pow(2, deg / 12), now, 0.05);
    if (Math.random() < 0.2) pluck(m.root * Math.pow(2, (deg + 7) / 12) / 2, now + 0.18, 0.03);
  }
  if (m.bell && step % 8 === 0) bell(m.root * 2, now);
  if (combat) { drum(now, step % 4 === 0); if (step % 2 === 0) drum(now + m.tempo / 2000, false); }
}

/** Switch mood: "f1" | "f2" | "f3" | "town" | "" (silence). */
export function setMusic(mood: string, inCombat = false) {
  if (mood === current && inCombat === combat) return;
  const changed = mood !== current;
  current = mood;
  combat = inCombat;
  clearInterval(timer);
  if (!mood || !MOODS[mood]) { stopDrone(); return; }
  if (changed) startDrone(MOODS[mood]);
  const tempo = MOODS[mood].tempo * (inCombat ? 0.75 : 1);
  timer = window.setInterval(tickMusic, tempo);
}
