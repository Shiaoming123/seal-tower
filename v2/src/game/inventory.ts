import { RELICS, RELIC_POOL } from "../data/relics";
import { pick } from "./rng";
import { GOODS } from "../data/goods";
import * as bag from "./bag";
import type { GoodId, RunState } from "./types";

/** Put a good into the bag if it fits, otherwise into the pending pile the player sorts out later. */
export function addGood(run: RunState, id: GoodId): boolean {
  const spot = bag.findSpot(run.bag, id);
  if (spot) {
    run.bag.items.push({ uid: run.nextUid++, id, ...spot });
    return true;
  }
  run.pending.push(id);
  return false;
}

/** What a good would fetch at a floor's shop (defaults to the shop you're in). Gear sells back at half price. */
export function sellPrice(run: RunState, id: GoodId, floor: 1 | 2 | 3 = run.floor, sold = run.shop?.sold[id] ?? 0): number {
  const g = GOODS[id];
  const pin = run.relics.includes("pin") ? 1 : 0;
  if (g.kind !== "goods") return Math.max(1, Math.floor(g.price / 2)) + pin;
  const m = run.markets[floor];
  const raw = Math.round(g.price * (m.mult[id] ?? 1) * (m.wanted === id ? 2 : 1));
  return Math.max(1, raw - sold) + pin;
}

export function sellItem(run: RunState, uid: number): number {
  const item = run.bag.items.find((it) => it.uid === uid);
  if (!item) return 0;
  const price = sellPrice(run, item.id);
  bag.removeUid(run.bag, uid);
  if (run.shop && GOODS[item.id].kind === "goods") run.shop.sold[item.id] = (run.shop.sold[item.id] ?? 0) + 1;
  run.gold += price;
  run.stats.goldEarned += price;
  run.stats.goodsSold++;
  if (run.relics.includes("ledger")) run.hp = Math.min(run.maxHp, run.hp + 1);
  return price;
}

export const MAX_BAG_ROWS = 6;

/** Use a consumable. Returns the result line, or null if it can't be used. */
export function useItem(run: RunState, uid: number): string | null {
  const item = run.bag.items.find((it) => it.uid === uid);
  const use = item && GOODS[item.id].use;
  if (!item || !use) return null;
  if (use.bagRow && run.bag.h >= MAX_BAG_ROWS) return null;
  if (use.oil && run.oil >= run.maxOil) return null;
  bag.removeUid(run.bag, uid);
  const lines: string[] = [];
  if (use.maxHp) { run.maxHp += use.maxHp; lines.push(`最大气血 +${use.maxHp}`); }
  if (use.heal) { const a = Math.min(use.heal, run.maxHp - run.hp); run.hp += a; lines.push(`回复 ${a} 气血`); }
  if (use.bagRow) { run.bag.h += 1; lines.push("行囊多了一行"); }
  if (use.oil) { const a = Math.min(use.oil, run.maxOil - run.oil); run.oil += a; lines.push(`灯油 +${a}`); }
  return lines.join("，") + "。";
}

/** Move a pending good into a specific bag position. */
export function packPending(run: RunState, index: number, x: number, y: number, rot: number): boolean {
  const id = run.pending[index];
  if (id === undefined || !bag.fits(run.bag, id, x, y, rot)) return false;
  run.bag.items.push({ uid: run.nextUid++, id, x, y, rot });
  run.pending.splice(index, 1);
  return true;
}

/** Drop a bag item back onto the floor (into pending) to make room. */
export function unpack(run: RunState, uid: number) {
  const it = bag.removeUid(run.bag, uid);
  if (it) run.pending.push(it.id);
}

export function moveItem(run: RunState, uid: number, x: number, y: number, rot: number): boolean {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it || !bag.fits(run.bag, it.id, x, y, rot, uid)) return false;
  Object.assign(it, { x, y, rot });
  return true;
}

/** Fill free space with pending goods, most valuable first. */
export function autoPackPending(run: RunState) {
  const order = run.pending.map((id, i) => ({ id, i })).sort((a, b) => GOODS[b.id].price - GOODS[a.id].price);
  const placed = new Set<number>();
  for (const { id, i } of order) {
    const spot = bag.findSpot(run.bag, id);
    if (spot) { run.bag.items.push({ uid: run.nextUid++, id, ...spot }); placed.add(i); }
  }
  run.pending = run.pending.filter((_, i) => !placed.has(i));
}


export function gainRelic(run: RunState, id: string) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
}

/** A relic the player doesn't own yet. */
export function randomRelic(run: RunState, rarity?: "common" | "rare"): string | null {
  const options = RELIC_POOL.filter((id) => !run.relics.includes(id) && (!rarity || RELICS[id].rarity === rarity));
  const fallback = RELIC_POOL.filter((id) => !run.relics.includes(id));
  const list = options.length ? options : fallback;
  return list.length ? pick(run.rng, list) : null;
}
