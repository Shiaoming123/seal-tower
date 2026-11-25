import { signal } from "@preact/signals";
import type { Profile, RunState } from "../game/types";

const RUN_KEY = "seal-tower.v2.run";
const PROFILE_KEY = "seal-tower.v2.profile";
const PLAYTEST_KEY = "seal-tower.v2.playtest";

/** Playtest mode (GAME-001): open the game once with ?playtest=1 and the result screen offers to copy a run record. */
export const playtest = (() => {
  try {
    if (new URLSearchParams(location.search).has("playtest")) localStorage.setItem(PLAYTEST_KEY, "1");
    return localStorage.getItem(PLAYTEST_KEY) === "1";
  } catch { return false; }
})();

const defaultProfile: Profile = { renown: 0, runs: 0, wins: 0, bestFloor: 0, ordersDone: [], seenTips: [], achievements: [], treasury: 0, upgrades: {}, favor: {}, codex: [], daily: null, sound: true };

function read<T>(key: string): T | null {
  try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}

export const runSig = signal<RunState | null>(null);
export const profileSig = signal<Profile>({ ...defaultProfile, ...(read<Profile>(PROFILE_KEY) ?? {}) });
/** Bumped after every in-place mutation so components re-render. */
export const tick = signal(0);
export const page = signal<"title" | "town" | "game" | "help" | "achievements" | "codex">("title");
/** 每日签: the next run uses today's shared seed. */
export const dailyMode = signal(false);
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export type CombatPile = "draw" | "discard" | "exhaust";
export const overlay = signal<null | "bag" | "deck" | "map" | "pause" | CombatPile>(null);

/** The run as it was when the current fight began, for 「重新开战」 in the pause menu. Kept in memory only. */
let fightStart: RunState | null = null;
export const rememberFight = (run: RunState) => { fightStart = structuredClone(run); };
export const forgetFight = () => { fightStart = null; };
export const canRestartFight = () => !!fightStart && !!runSig.value?.combat;
export function restartFight() {
  if (!fightStart) return;
  runSig.value = structuredClone(fightStart);
  overlay.value = null;
  commit();
}
export const toast = signal<{ text: string; id: number; at?: number } | null>(null);
/** The glossary popover opened by tapping a <Term>: which word, and where on the stage (stage px). */
export const termTip = signal<{ id: string; x: number; y: number; top?: number } | null>(null);

export function savedRun(): RunState | null {
  const r = read<RunState>(RUN_KEY);
  if (r && !r.pouch) r.pouch = []; // saves from before the side pouch
  return r && r.version === 2 && !r.outcome ? r : null;
}

/** Call after mutating the run or profile. */
export function commit() {
  tick.value++;
  const run = runSig.value;
  // Fold new 图鉴 discoveries into the profile.
  if (run?.discovered?.length) {
    const have = new Set(profileSig.value.codex);
    const fresh = run.discovered.filter((k) => !have.has(k));
    if (fresh.length) profileSig.value = { ...profileSig.value, codex: [...profileSig.value.codex, ...fresh] };
  }
  write(RUN_KEY, run && !run.outcome ? run : null);
  saveProfile();
}

export function saveProfile() { write(PROFILE_KEY, profileSig.value); }

export function clearRun() { write(RUN_KEY, null); }

let toastId = 0;
export function say(text: string, ms = 2600) {
  const id = ++toastId;
  toast.value = { text, id, at: Date.now() };
  setTimeout(() => { if (toast.value?.id === id) toast.value = null; }, ms);
}

export function seenTip(id: string): boolean { return profileSig.value.seenTips.includes(id); }
export function markTip(id: string) {
  if (seenTip(id)) return;
  profileSig.value = { ...profileSig.value, seenTips: [...profileSig.value.seenTips, id] };
  commit();
}

/** Read the current run inside a component and re-render on every commit(). */
export function useRun(): RunState {
  tick.value;
  return runSig.value!;
}
