// QA-001: invariant fuzzing. Random but seeded sequences of player actions (take goods, move / stack / unpack /
// discard / sell them, the side pouch, consumables, sewing, orders, fights, stairs), and after every single step a
// set of rules that must always hold. Inspired by "smart playtesting" invariants and Factorio's heavy mode (save,
// reload, compare). A failure prints the seed and step so it can be replayed.
//   npx vitest run tests/invariants.test.ts            (40 seeds × 250 steps)
//   FUZZ_SEEDS=400 npx vitest run tests/invariants.test.ts --testTimeout=600000
import { describe, expect, it } from "vitest";
import { GOODS, stackMax } from "../src/data/goods";
import * as bag from "../src/game/bag";
import { endTurn, playCard } from "../src/game/combat";
import * as inv from "../src/game/inventory";
import * as R from "../src/game/run";
import type { GoodId, RunState } from "../src/game/types";

const SEEDS = Number(process.env.FUZZ_SEEDS ?? 40);
const STEPS = Number(process.env.FUZZ_STEPS ?? 250);
const POOL = (Object.keys(GOODS) as GoodId[]).filter((id) => !GOODS[id].base);

/** Tiny seeded generator for the fuzzer's own choices (separate from the game's rng). */
function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
  return { next, int: (n: number) => Math.floor(next() * n), pick: <T,>(a: T[]) => a[Math.floor(next() * a.length)] };
}

/** Everything that must be true after any action. Returns the first broken rule, or null. */
export function broken(run: RunState): string | null {
  const b = run.bag;
  const seen = new Map<string, number>();
  for (const it of b.items) {
    if (!GOODS[it.id]) return `unknown good ${it.id} in the bag`;
    const q = bag.qty(it);
    if (!Number.isInteger(q) || q < 1 || q > stackMax(it.id)) return `${it.id} stack of ${q} (max ${stackMax(it.id)})`;
    for (const [x, y] of bag.footprint(it)) {
      if (x < 0 || y < 0 || x >= b.w || y >= b.h) return `${it.id} sticks out of the bag at ${x},${y}`;
      if (!bag.usable(b, x, y)) return `${it.id} sits on a hole at ${x},${y}`;
      const k = `${x},${y}`;
      if (seen.has(k)) return `${it.id} overlaps item ${seen.get(k)} at ${k}`;
      seen.set(k, it.uid);
    }
  }
  if (new Set(b.items.map((i) => i.uid)).size !== b.items.length) return "two bag items share a uid";
  for (const id of [...run.pending, ...run.pouch]) if (!GOODS[id]) return `unknown good ${id} in the pile or pouch`;
  if (run.pouch.length > inv.POUCH_SLOTS) return `side pouch holds ${run.pouch.length}`;
  if (run.hp > run.maxHp) return `hp ${run.hp} above max ${run.maxHp}`;
  if (run.gold < 0 || !Number.isFinite(run.gold)) return `gold ${run.gold}`;
  if (run.oil < 0 || run.oil > run.maxOil || !Number.isFinite(run.oil)) return `oil ${run.oil} / ${run.maxOil}`;
  for (const [k, v] of Object.entries(run.stats)) if (typeof v === "number" && !Number.isFinite(v)) return `stat ${k} is ${v}`;
  // Heavy mode: a save and reload must give back exactly the same state.
  const saved = JSON.stringify(run);
  if (JSON.stringify(JSON.parse(saved)) !== saved) return "save / reload changed the state";
  return null;
}

/** One random action. Returns a short label for the failure report. */
function act(run: RunState, r: ReturnType<typeof lcg>): string {
  const items = run.bag.items;
  const it = items.length ? r.pick(items) : null;
  const c = run.combat;
  if (c && !c.over) {
    // In a fight: mostly play a card, sometimes end the turn.
    if (c.hand.length && r.next() < 0.7) { const i = r.int(c.hand.length); playCard(run, i); return `play ${i}`; }
    endTurn(run); return "end turn";
  }
  if (c?.over) {
    if (c.over === "win") { R.winCombat(run); R.closeReward(run); return "win + close"; }
    if (c.over === "lose") { R.loseCombat(run); return "lose"; }
    R.fledCombat(run); return "fled";
  }
  switch (r.int(14)) {
    case 0: case 1: { const g = r.pick(POOL); inv.addGood(run, g); return `add ${g}`; }
    case 2: if (it) { const x = r.int(run.bag.w), y = r.int(run.bag.h), rot = r.int(4); inv.moveItem(run, it.uid, x, y, rot); return `move ${it.id} ${x},${y} r${rot}`; } break;
    case 3: if (run.pending.length) { const i = r.int(run.pending.length); inv.packPending(run, i, r.int(run.bag.w), r.int(run.bag.h), r.int(4)); return `pack ${i}`; } break;
    case 4: if (it) { inv.unpack(run, it.uid); return `unpack ${it.id}`; } break;
    case 5: if (it) { inv.discard(run, it.uid); return `discard ${it.id}`; } break;
    case 6: if (it) { inv.sellItem(run, it.uid); return `sell ${it.id}`; } break;
    case 7: if (it) { inv.toPouch(run, it.uid); return `to pouch ${it.id}`; } break;
    case 8: if (run.pouch.length) { const i = r.int(run.pouch.length); inv.fromPouch(run, i); return `from pouch ${i}`; } break;
    case 9: inv.autoPackPending(run); return "auto pack";
    case 10: if (it && GOODS[it.id].use) { inv.useItem(run, it.uid); return `use ${it.id}`; } break;
    case 11: if (run.orders.length) { R.deliverOrder(run, r.int(run.orders.length)); return "deliver"; } break;
    case 12: {
      const e = run.dungeon.entities.find((x) => !x.done && x.kind === "fight");
      if (e) { R.openEntity(run, e); return `fight ${e.enemy}`; }
      break;
    }
    case 13: if (run.floor < 3 && r.next() < 0.3) { R.climb(run); return "climb"; } break;
  }
  return "noop";
}

function play(seed: number): { state: string; fail: string | null } {
  const run = R.createRun(seed * 104729, "sword", "lamp");
  const r = lcg(seed);
  for (let step = 0; step < STEPS && !run.outcome; step++) {
    const what = act(run, r);
    const bad = broken(run);
    if (bad) return { state: "", fail: `seed ${seed}, step ${step} (${what}): ${bad}` };
  }
  const { startedAt: _ignored, ...stats } = run.stats; // wall-clock time differs between two runs
  return { state: JSON.stringify({ ...run, stats }), fail: null };
}

describe("invariants under random play", () => {
  it(`hold for ${SEEDS} seeds × ${STEPS} steps`, () => {
    for (let seed = 1; seed <= SEEDS; seed++) expect(play(seed).fail).toBeNull();
  }, 600_000);
  it("the same seed and actions give the same result", () => {
    for (const seed of [3, 17]) expect(play(seed).state).toBe(play(seed).state);
  }, 120_000);
});
