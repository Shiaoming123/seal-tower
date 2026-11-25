import { RELICS, RELIC_POOL } from "../data/relics";
import { pick } from "./rng";
import { GOODS, stackMax } from "../data/goods";
import { discover } from "./discover";
import { bump } from "./stats";
import * as bag from "./bag";
import type { GoodId, RunState } from "./types";

/** Put a good into the bag if it fits, otherwise into the pending pile the player sorts out later. */
export function addGood(run: RunState, id: GoodId): boolean {
  discover(run, "g:" + id);
  // Small goods go onto a stack of the same kind first (GAME-008).
  const stack = bag.stackWithRoom(run.bag, id);
  if (stack) { stack.n = bag.qty(stack) + 1; return true; }
  const spot = bag.findSpot(run.bag, id);
  if (spot) {
    run.bag.items.push({ uid: run.nextUid++, id, ...spot });
    return true;
  }
  run.pending.push(id);
  return false;
}

/** What a good would fetch at a floor's shop (defaults to the shop you're in). Gear sells back at half price. */
/** How much each earlier sale of the same good lowers its price at this 狐市 (fraction of the base). */
export const SELL_GLUT = 0.2;
/** 狐市 pays this share of a good's value; carrying it home to town pays it in full. */
export const SELL_RATE = 0.6;

export function sellPrice(run: RunState, id: GoodId, floor: 1 | 2 | 3 = run.floor, sold = run.shop?.sold[id] ?? 0, uid?: number): number {
  const g = GOODS[id];
  const item = uid === undefined ? undefined : run.bag.items.find((i) => i.uid === uid);
  const pin = (run.relics.includes("pin") ? 1 : 0) + (item && g.kind === "goods" ? bag.auraOn(run.bag, item, "sell") : 0);
  if (g.kind !== "goods") return Math.max(1, Math.floor(g.price / 2)) + pin;
  const m = run.markets[floor];
  // This floor's 签文 only applies to the floor you're on (rumours about the next floor ignore it).
  const omen = floor === run.floor ? run.omen : "calm";
  const festival = omen === "festival" && id === "ash" ? 2 : 1;
  const market = omen === "market" ? 1.25 : 1;
  const raw = Math.round(g.price * SELL_RATE * (m.mult[id] ?? 1) * (m.wanted === id ? 2 : 1) * festival * market);
  const material = g.tags?.includes("material") && bag.tagLevel(run.bag, "material") >= 1 ? 2 : 0;
  // Each one of the same good already sold here knocks 20% off (at least 1 石): the buyer's shelf fills up. The
  // markdown applies to the whole price, flat bonuses included (REVIEW-001: bonuses used to dodge it).
  const full = raw + pin + material + (omen === "rain" ? 2 : 0);
  return Math.max(1, full - Math.max(sold, Math.round(full * SELL_GLUT * sold)));
}

export function sellItem(run: RunState, uid: number): number {
  const item = run.bag.items.find((it) => it.uid === uid);
  if (!item) return 0;
  const price = sellPrice(run, item.id, run.floor, run.shop?.sold[item.id] ?? 0, uid);
  bag.takeOne(run.bag, item); // one off a stack at a time
  if (run.shop && GOODS[item.id].kind === "goods") run.shop.sold[item.id] = (run.shop.sold[item.id] ?? 0) + 1;
  run.gold += price;
  run.stats.goldEarned += price;
  run.stats.goodsSold++;
  bump(run, "soldValue", price);
  if (run.relics.includes("ledger")) run.hp = Math.min(run.maxHp, run.hp + 1);
  return price;
}

// ---------------------------------------------------------------- expansion (扩囊衬布)

/** Can a 扩囊衬布 still add anything? */
export const canExpand = (run: RunState) => !!bag.autoPiece(run.bag, "square") || !!bag.autoPiece(run.bag, "line") || !!bag.autoPiece(run.bag, "ell");

/** Sew a lining piece onto the bag at the given cells (from bag.pieceCells), using up the lining item. */
export function sewPiece(run: RunState, uid: number, cells: [number, number][]): string | null {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it || !GOODS[it.id].use?.bagRow || run.combat) return null;
  // The cloth itself comes out of the bag first, so its own cells are free when checking the piece.
  bag.removeUid(run.bag, uid);
  if (!bag.expand(run.bag, cells)) { run.bag.items.push(it); return null; }
  bump(run, "sews");
  return `行囊多了 ${cells.length} 格（现在 ${bag.cellCount(run.bag)} 格）。`;
}

// ---------------------------------------------------------------- side pouch (侧袋)

export const POUCH_SLOTS = 3;
export const pouchFull = (run: RunState) => run.pouch.length >= POUCH_SLOTS;
/** Only one-cell things fit in a pouch slot (REVIEW-001: a 2×2 钟铜 used to slip into one). */
export const pouchFits = (id: GoodId) => GOODS[id].shape.length === 1;

/** Move a packed item into the side pouch. Not during a fight. */
export function toPouch(run: RunState, uid: number): boolean {
  if (run.combat || pouchFull(run)) return false;
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it || !pouchFits(it.id)) return false;
  run.pouch.push(bag.takeOne(run.bag, it));
  bump(run, "pouchStash");
  return true;
}

/** Move a not-yet-packed good straight into the side pouch. */
export function pendingToPouch(run: RunState, index: number): boolean {
  if (run.combat || pouchFull(run) || run.pending[index] === undefined || !pouchFits(run.pending[index])) return false;
  run.pouch.push(run.pending.splice(index, 1)[0]);
  bump(run, "pouchStash");
  return true;
}

/** Take an item out of the pouch into the bag: at a given spot, or the first free one. */
export function fromPouch(run: RunState, i: number, at?: { x: number; y: number; rot: number }): boolean {
  const id = run.pouch[i];
  if (run.combat || id === undefined) return false;
  const onto = at ? stackAt(run, id, at.x, at.y) : bag.stackWithRoom(run.bag, id);
  if (onto) { onto.n = bag.qty(onto) + 1; run.pouch.splice(i, 1); return true; }
  const spot = at && bag.fits(run.bag, id, at.x, at.y, at.rot) ? at : at ? null : bag.findSpot(run.bag, id);
  if (!spot) return false;
  run.bag.items.push({ uid: run.nextUid++, id, ...spot });
  run.pouch.splice(i, 1);
  return true;
}

export function sellPouch(run: RunState, i: number): number {
  const id = run.pouch[i];
  if (id === undefined) return 0;
  const price = sellPrice(run, id);
  run.pouch.splice(i, 1);
  if (run.shop && GOODS[id].kind === "goods") run.shop.sold[id] = (run.shop.sold[id] ?? 0) + 1;
  run.gold += price;
  run.stats.goldEarned += price;
  run.stats.goodsSold++;
  bump(run, "soldValue", price);
  if (run.relics.includes("ledger")) run.hp = Math.min(run.maxHp, run.hp + 1);
  return price;
}

/** Sell a good straight from the floor's pile (GAME-008: no need to pack it first). */
export function sellPending(run: RunState, index: number): number {
  const id = run.pending[index];
  if (id === undefined) return 0;
  const price = sellPrice(run, id);
  run.pending.splice(index, 1);
  if (run.shop && GOODS[id].kind === "goods") run.shop.sold[id] = (run.shop.sold[id] ?? 0) + 1;
  run.gold += price;
  run.stats.goldEarned += price;
  run.stats.goodsSold++;
  bump(run, "soldValue", price);
  if (run.relics.includes("ledger")) run.hp = Math.min(run.maxHp, run.hp + 1);
  return price;
}

/** Use a consumable. Returns the result line, or null if it can't be used. */
export function useItem(run: RunState, uid: number): string | null {
  const item = run.bag.items.find((it) => it.uid === uid);
  const use = item && GOODS[item.id].use;
  if (!item || !use) return null;
  if (use.bagRow) {
    // Without a chosen spot (the bot, old buttons), sew the first piece that fits along the bottom.
    const cells = bag.autoPiece(run.bag, "line") ?? bag.autoPiece(run.bag, "square") ?? bag.autoPiece(run.bag, "ell");
    return cells ? sewPiece(run, uid, cells) : null;
  }
  if (use.oil && run.oil >= run.maxOil) return null;
  bag.takeOne(run.bag, item); // one off a stack: burning 灯灰 ×3 used to burn all three (REVIEW-002)
  return applyUse(run, use);
}

/** Use a consumable straight from the pile (REVIEW-003: 养元丹 in the pile had to be packed before it could be eaten). */
export function usePending(run: RunState, index: number): string | null {
  const id = run.pending[index];
  const use = id && GOODS[id].use;
  if (!use || use.bagRow || run.combat) return null;
  if (use.oil && run.oil >= run.maxOil) return null;
  run.pending.splice(index, 1);
  return applyUse(run, use);
}

/** Put one pile item into the bag wherever it fits (stack first). False if there's no room. */
export function packOnePending(run: RunState, index: number): boolean {
  const id = run.pending[index];
  if (!id) return false;
  const stack = bag.stackWithRoom(run.bag, id);
  if (stack) { stack.n = bag.qty(stack) + 1; run.pending.splice(index, 1); return true; }
  const spot = bag.findSpot(run.bag, id);
  if (!spot) return false;
  run.bag.items.push({ uid: run.nextUid++, id, ...spot });
  run.pending.splice(index, 1);
  return true;
}

function applyUse(run: RunState, use: NonNullable<(typeof GOODS)[GoodId]["use"]>): string {
  const lines: string[] = [];
  if (use.maxHp) { run.maxHp += use.maxHp; lines.push(`最大气血 +${use.maxHp}`); }
  if (use.heal) { const a = Math.min(use.heal, run.maxHp - run.hp); run.hp += a; lines.push(`回复 ${a} 气血`); }
  if (use.oil) { const a = Math.min(use.oil, run.maxOil - run.oil); run.oil += a; lines.push(`灯油 +${a}`); }
  return lines.join("，") + "。";
}

/** Move a pending good into a specific bag position. */
export function packPending(run: RunState, index: number, x: number, y: number, rot: number): boolean {
  const id = run.pending[index];
  if (id === undefined) return false;
  const onto = stackAt(run, id, x, y);
  if (onto) { onto.n = bag.qty(onto) + 1; run.pending.splice(index, 1); return true; }
  if (!bag.fits(run.bag, id, x, y, rot)) return false;
  run.bag.items.push({ uid: run.nextUid++, id, x, y, rot });
  run.pending.splice(index, 1);
  return true;
}

/** Drop a bag item back onto the floor (into pending) to make room. */
export function unpack(run: RunState, uid: number) {
  const it = bag.removeUid(run.bag, uid);
  if (it) for (let k = 0; k < bag.qty(it); k++) run.pending.push(it.id);
}

/** A same-kind stack with room covering cell (x, y), to drop a good onto. */
export function stackAt(run: RunState, id: GoodId, x: number, y: number, quantity = 1, ignoreUid = -1) {
  return run.bag.items.find(it => it.uid !== ignoreUid && it.id === id && bag.qty(it) + quantity <= stackMax(id)
    && bag.footprint(it).some(([cx, cy]) => cx === x && cy === y)) ?? null;
}

/** Throw one good away for good (a stack loses one; a single item leaves the bag). */
export function discard(run: RunState, uid: number, all = false): GoodId | null {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it || run.combat) return null;
  if (all) { bag.removeUid(run.bag, uid); return it.id; }
  return bag.takeOne(run.bag, it);
}

export function moveItem(run: RunState, uid: number, x: number, y: number, rot: number): boolean {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it) return false;
  // Dropped onto another stack of the same good: merge if it all fits.
  const onto = stackAt(run, it.id, x, y, bag.qty(it), uid);
  if (onto) { onto.n = bag.qty(onto) + bag.qty(it); bag.removeUid(run.bag, uid); return true; }
  if (!bag.fits(run.bag, it.id, x, y, rot, uid)) return false;
  Object.assign(it, { x, y, rot });
  return true;
}

/** Fill free space with pending goods, most valuable first. */
export function autoPackPending(run: RunState) {
  const order = run.pending.map((id, i) => ({ id, i })).sort((a, b) => GOODS[b.id].price - GOODS[a.id].price);
  const placed = new Set<number>();
  for (const { id, i } of order) {
    const stack = bag.stackWithRoom(run.bag, id);
    if (stack) { stack.n = bag.qty(stack) + 1; placed.add(i); continue; }
    const spot = bag.findSpot(run.bag, id);
    if (spot) { run.bag.items.push({ uid: run.nextUid++, id, ...spot }); placed.add(i); }
  }
  run.pending = run.pending.filter((_, i) => !placed.has(i));
}


export function gainRelic(run: RunState, id: string) {
  if (run.relics.includes(id)) return;
  run.relics.push(id);
  discover(run, "r:" + id);
}

/** A relic the player doesn't own yet. */
export function randomRelic(run: RunState, rarity?: "common" | "rare"): string | null {
  const options = RELIC_POOL.filter((id) => !run.relics.includes(id) && (!rarity || RELICS[id].rarity === rarity));
  const fallback = RELIC_POOL.filter((id) => !run.relics.includes(id));
  const list = options.length ? options : fallback;
  return list.length ? pick(run.rng, list) : null;
}
