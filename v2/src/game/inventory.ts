import { RELICS, RELIC_POOL } from "../data/relics";
import { pick } from "./rng";
import { GOODS } from "../data/goods";
import { discover } from "./discover";
import * as bag from "./bag";
import type { GoodId, RunState } from "./types";

/** Put a good into the bag if it fits, otherwise into the pending pile the player sorts out later. */
export function addGood(run: RunState, id: GoodId): boolean {
  discover(run, "g:" + id);
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
export const SELL_RATE = 0.75;

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
  const material = g.tags?.includes("material") && bag.tagLevel(run.bag, "material") >= 1 ? 1 : 0;
  // Each one of the same good already sold here knocks 20% off (at least 1 石): the buyer's shelf fills up.
  const glut = Math.max(1, raw - Math.max(sold, Math.round(raw * SELL_GLUT * sold)));
  return glut + pin + material + (omen === "rain" ? 1 : 0);
}

export function sellItem(run: RunState, uid: number): number {
  const item = run.bag.items.find((it) => it.uid === uid);
  if (!item) return 0;
  const price = sellPrice(run, item.id, run.floor, run.shop?.sold[item.id] ?? 0, uid);
  bag.removeUid(run.bag, uid);
  if (run.shop && GOODS[item.id].kind === "goods") run.shop.sold[item.id] = (run.shop.sold[item.id] ?? 0) + 1;
  run.gold += price;
  run.stats.goldEarned += price;
  run.stats.goodsSold++;
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
  return `行囊多了 ${cells.length} 格（现在 ${bag.cellCount(run.bag)} 格）。`;
}

// ---------------------------------------------------------------- side pouch (侧袋)

export const POUCH_SLOTS = 3;
export const pouchFull = (run: RunState) => run.pouch.length >= POUCH_SLOTS;

/** Move a packed item into the side pouch. Not during a fight. */
export function toPouch(run: RunState, uid: number): boolean {
  if (run.combat || pouchFull(run)) return false;
  const it = bag.removeUid(run.bag, uid);
  if (!it) return false;
  run.pouch.push(it.id);
  return true;
}

/** Move a not-yet-packed good straight into the side pouch. */
export function pendingToPouch(run: RunState, index: number): boolean {
  if (run.combat || pouchFull(run) || run.pending[index] === undefined) return false;
  run.pouch.push(run.pending.splice(index, 1)[0]);
  return true;
}

/** Take an item out of the pouch into the bag: at a given spot, or the first free one. */
export function fromPouch(run: RunState, i: number, at?: { x: number; y: number; rot: number }): boolean {
  const id = run.pouch[i];
  if (run.combat || id === undefined) return false;
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
  bag.removeUid(run.bag, uid);
  const lines: string[] = [];
  if (use.maxHp) { run.maxHp += use.maxHp; lines.push(`最大气血 +${use.maxHp}`); }
  if (use.heal) { const a = Math.min(use.heal, run.maxHp - run.hp); run.hp += a; lines.push(`回复 ${a} 气血`); }
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
  discover(run, "r:" + id);
}

/** A relic the player doesn't own yet. */
export function randomRelic(run: RunState, rarity?: "common" | "rare"): string | null {
  const options = RELIC_POOL.filter((id) => !run.relics.includes(id) && (!rarity || RELICS[id].rarity === rarity));
  const fallback = RELIC_POOL.filter((id) => !run.relics.includes(id));
  const list = options.length ? options : fallback;
  return list.length ? pick(run.rng, list) : null;
}
