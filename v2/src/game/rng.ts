/** Seeded RNG (mulberry32). The state is a plain number so it can live inside saved run state. */
export interface RngState { s: number }

export function makeRng(seed: number): RngState {
  return { s: (seed >>> 0) || 0x9e3779b9 };
}

export function next(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const int = (r: RngState, lo: number, hi: number) => lo + Math.floor(next(r) * (hi - lo + 1));
export const chance = (r: RngState, p: number) => next(r) < p;
export const pick = <T>(r: RngState, list: readonly T[]): T => list[Math.floor(next(r) * list.length)];

export function shuffle<T>(r: RngState, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(next(r) * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Pick n distinct items, weighted. */
export function weighted<T>(r: RngState, items: readonly T[], weight: (t: T) => number, n = 1): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < n && pool.length) {
    const total = pool.reduce((s, t) => s + weight(t), 0);
    let roll = next(r) * total;
    let i = 0;
    for (; i < pool.length - 1; i++) { roll -= weight(pool[i]); if (roll <= 0) break; }
    out.push(pool.splice(i, 1)[0]);
  }
  return out;
}

export function seedFromString(text: string): number {
  let h = 2166136261;
  for (const ch of text) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
}
