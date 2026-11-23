// Composed, synthesised background music. Each mood is a short loop written in a Chinese pentatonic
// mode: a lead melody (guqin / pipa / dizi), an accompaniment and light percussion. A lookahead
// scheduler keeps timing tight; moods crossfade when you move between screens.
import { ac, bigDrum, flute, gong, out, pluck, running, templeBell, woodblock, type StringVoice } from "./engine";

type Note = [degree: number | null, eighths: number];
interface Song {
  bpm: number;
  /** Frequency of degree 0. */
  root: number;
  /** Semitone offsets of one octave of the mode (5 notes). */
  mode: number[];
  lead: { voice: StringVoice | "flute"; phrases: Note[][]; octave?: number; vol: number; slide?: boolean };
  second?: { voice: StringVoice | "flute"; phrases: Note[][]; octave?: number; vol: number };
  /** Accompaniment played on every eighth note of the loop. */
  accomp?: (i: number, bar: number, pos: number, play: Play) => void;
}
type Play = {
  note: (deg: number, vol: number, voice?: StringVoice, octave?: number) => void;
  drum: (vol: number) => void;
  block: (vol: number, high?: boolean) => void;
  bell: (deg: number, vol: number) => void;
  gong: (vol: number) => void;
};

const 宫 = [0, 2, 4, 7, 9];   // major pentatonic
const 羽 = [0, 3, 5, 7, 10];  // minor pentatonic
const 商 = [0, 2, 5, 7, 10];

const SONGS: Record<string, Song> = {
  // 镇灯铺: warm, a little busy, like a street at dusk.
  town: {
    bpm: 84, root: 196, mode: 宫,
    lead: { voice: "pipa", vol: 0.42, octave: 1, phrases: [
      [[5, 2], [4, 1], [3, 1], [4, 2], [5, 2], [6, 2], [5, 1], [4, 1], [3, 4]],
      [[3, 2], [4, 1], [5, 1], [6, 2], [8, 2], [7, 2], [6, 2], [5, 4]],
      [[5, 2], [4, 1], [3, 1], [4, 2], [5, 2], [4, 2], [2, 2], [0, 4]],
      [[null, 2], [3, 1], [4, 1], [5, 2], [3, 2], [4, 3], [3, 1], [2, 4]],
    ] },
    accomp: (_i, bar, pos, p) => {
      const chord = [0, 3, 2, 0][bar % 4];
      if (pos === 0) p.note(chord - 5, 0.32, "zheng");
      if (pos === 4) p.note(chord - 2, 0.2, "zheng");
      if (pos === 2 || pos === 6) p.block(0.06, pos === 6);
    },
  },
  // 照影廊: moonlit and unhurried — guqin with long slides, a dizi answering.
  f1: {
    bpm: 66, root: 146.8, mode: 羽,
    lead: { voice: "guqin", vol: 0.55, slide: true, phrases: [
      [[5, 4], [4, 2], [3, 2], [2, 6], [3, 2]],
      [[3, 2], [5, 2], [6, 4], [5, 2], [4, 2], [3, 4]],
      [[2, 2], [3, 2], [5, 4], [4, 3], [3, 1], [2, 4]],
      [[1, 4], [2, 2], [3, 2], [0, 8]],
    ] },
    second: { voice: "flute", vol: 0.16, octave: 1, phrases: [
      [[null, 8], [8, 6], [7, 2]], [[6, 4], [5, 4], [null, 8]], [[null, 8], [7, 4], [8, 2], [9, 2]], [[8, 8], [null, 8]],
    ] },
    accomp: (_i, bar, pos, p) => {
      if (pos === 0) p.note([0, -2, -1, 0][bar % 4] - 5, 0.35, "guqin");
      if (pos === 6 && bar % 2 === 1) p.note(-2, 0.18, "guqin");
    },
  },
  // 桥驿: water under the bridge — rippling zheng arpeggios, a sparse pipa tune.
  f2: {
    bpm: 76, root: 164.8, mode: 商,
    lead: { voice: "pipa", vol: 0.32, octave: 1, phrases: [
      [[null, 4], [4, 2], [3, 2], [2, 4], [1, 4]],
      [[null, 4], [3, 2], [4, 2], [5, 6], [4, 2]],
      [[null, 4], [4, 2], [5, 2], [6, 4], [5, 2], [3, 2]],
      [[2, 4], [1, 2], [2, 2], [0, 8]],
    ] },
    accomp: (i, bar, pos, p) => {
      const base = [0, 1, -1, 0][bar % 4];
      p.note(base + [0, 2, 4, 5, 4, 2, 3, 1][pos] - 5, pos === 0 ? 0.26 : 0.14, "zheng");
      if (i % 32 === 28) p.bell(10, 0.05);
    },
  },
  // 钟楼: heavy and sparse, bronze bells marking time.
  f3: {
    bpm: 58, root: 110, mode: 羽,
    lead: { voice: "guqin", vol: 0.6, slide: true, phrases: [
      [[5, 6], [4, 2], [3, 8]],
      [[2, 4], [3, 2], [1, 2], [0, 8]],
      [[3, 4], [5, 4], [6, 6], [5, 2]],
      [[4, 4], [3, 4], [2, 8]],
    ] },
    second: { voice: "flute", vol: 0.12, octave: 2, phrases: [[[null, 8], [5, 8]], [[4, 8], [3, 8]], [[null, 8], [6, 8]], [[5, 16]]] },
    accomp: (i, bar, pos, p) => {
      if (pos === 0 && bar % 2 === 0) p.bell(5, 0.14);
      if (pos === 0) p.drum(0.2);
      if (i % 16 === 12) p.note(-5, 0.3, "guqin");
    },
  },
};

/** Battle music: same key as the floor, driving drums and a pipa ostinato. */
function battleSong(floorSong: Song, boss: boolean): Song {
  return {
    bpm: boss ? 124 : 112, root: floorSong.root, mode: floorSong.mode,
    lead: { voice: "pipa", vol: 0.34, octave: 1, phrases: [
      [[5, 1], [5, 1], [4, 1], [5, 1], [6, 2], [5, 2], [4, 1], [3, 1], [4, 2], [null, 4]],
      [[3, 1], [3, 1], [4, 1], [5, 1], [3, 2], [2, 2], [3, 4], [null, 4]],
      [[6, 1], [6, 1], [5, 1], [6, 1], [8, 2], [6, 2], [5, 1], [4, 1], [5, 2], [null, 4]],
      [[4, 2], [3, 2], [2, 2], [3, 2], [0, 4], [null, 4]],
    ] },
    second: { voice: "flute", vol: 0.13, octave: 1, phrases: [[[null, 16]], [[8, 8], [7, 8]], [[null, 16]], [[6, 8], [5, 8]]] },
    accomp: (i, bar, pos, p) => {
      if (pos === 0 || pos === 3 || (pos === 6 && bar % 2 === 1)) p.drum(pos === 0 ? 0.42 : 0.28);
      if (pos % 2 === 1) p.block(0.07, pos === 7);
      p.note([0, 0, 3, 0, 5, 3, 0, 2][pos] - 5, 0.16, "pipa");
      if (boss && i % 64 === 0) p.gong(0.35);
    },
  };
}

// ---------------------------------------------------------------- scheduler

let current = "";
let song: Song | null = null;
let songOut: GainNode | null = null;
let timer = 0;
let step = 0;
let nextTime = 0;
let leadLine: { at: number; deg: number | null; len: number }[] = [];
let secondLine: { at: number; deg: number | null; len: number }[] = [];
let leadLen = 1, secondLen = 1;

function flatten(phrases: Note[][]) {
  const line: { at: number; deg: number | null; len: number }[] = [];
  let t = 0;
  for (const ph of phrases) for (const [deg, len] of ph) { line.push({ at: t, deg, len }); t += len; }
  return { line, len: t };
}

function freqOf(s: Song, deg: number, octave = 0) {
  const o = Math.floor(deg / 5), k = ((deg % 5) + 5) % 5;
  return s.root * Math.pow(2, o + octave + s.mode[k] / 12);
}

function schedule(i: number, t: number) {
  const s = song!, dest = songOut!;
  const eighth = 30 / s.bpm;
  const bar = Math.floor(i / 8), pos = i % 8;
  const play: Play = {
    note: (deg, vol, voice = "zheng", octave = 0) => pluck(dest, t, freqOf(s, deg, octave), vol, voice, 0, (Math.random() - 0.5) * 0.5),
    drum: (vol) => bigDrum(dest, t, vol),
    block: (vol, high) => woodblock(dest, t, vol, high),
    bell: (deg, vol) => templeBell(dest, t, freqOf(s, deg), vol),
    gong: (vol) => gong(dest, t, vol),
  };
  const lead = (part: NonNullable<Song["second"]> | Song["lead"], line: typeof leadLine, len: number, slide = false) => {
    const k = i % len;
    for (const n of line) if (n.at === k && n.deg !== null) {
      const f = freqOf(s, n.deg, part.octave ?? 0);
      if (part.voice === "flute") flute(dest, t, f, n.len * eighth * 0.95, part.vol);
      // Long guqin notes get a little slide up into the next tone (吟).
      else pluck(dest, t, f, part.vol, part.voice, slide && n.len >= 4 && Math.random() < 0.5 ? 0.5 : 0, (Math.random() - 0.5) * 0.3);
    }
  };
  lead(s.lead, leadLine, leadLen, s.lead.slide);
  if (s.second) lead(s.second, secondLine, secondLen);
  s.accomp?.(i, bar, pos, play);
}

function pump() {
  const a = ac();
  if (!a || !song || !songOut) return;
  if (!running()) { nextTime = a.currentTime + 0.1; return; }
  const eighth = 30 / song.bpm;
  if (nextTime < a.currentTime) nextTime = a.currentTime + 0.05;
  while (nextTime < a.currentTime + 0.25) {
    schedule(step, nextTime);
    step++;
    nextTime += eighth;
  }
}

/** Switch mood: "f1" | "f2" | "f3" | "town" | "" (silence). `fight`: "fight" | "boss" | null. */
export function setMusic(mood: string, fight: null | "fight" | "boss" = null) {
  const key = mood ? `${mood}:${fight ?? ""}` : "";
  if (key === current) return;
  current = key;
  const a = ac();
  // Fade the old song out.
  if (songOut && a) { const old = songOut; old.gain.setTargetAtTime(0.0001, a.currentTime, 0.4); setTimeout(() => old.disconnect(), 2500); }
  songOut = null; song = null;
  clearInterval(timer);
  if (!mood || !a || !SONGS[mood]) return;
  song = fight ? battleSong(SONGS[mood], fight === "boss") : SONGS[mood];
  const node = out("music", fight ? 0.18 : 0.38) as GainNode;
  songOut = a.createGain();
  songOut.gain.setValueAtTime(0.0001, a.currentTime);
  songOut.gain.exponentialRampToValueAtTime(1, a.currentTime + 1.2);
  songOut.connect(node);
  ({ line: leadLine, len: leadLen } = flatten(song.lead.phrases));
  ({ line: secondLine, len: secondLen } = song.second ? flatten(song.second.phrases) : { line: [], len: 1 });
  step = 0;
  nextTime = a.currentTime + 0.1;
  timer = window.setInterval(pump, 50);
}

/** Short stingers for winning and losing a run. */
export function stinger(kind: "win" | "lose") {
  const a = ac(); if (!a) return;
  const dest = out("music", 0.5); if (!dest) return;
  const t = a.currentTime + 0.05;
  if (kind === "win") [0, 2, 4, 7, 9, 12].forEach((s, i) => pluck(dest, t + i * 0.11, 392 * Math.pow(2, s / 12), 0.45, "pipa"));
  else { pluck(dest, t, 146.8, 0.6, "guqin", -2); gong(dest, t + 0.3, 0.3); }
}
