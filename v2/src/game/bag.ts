import { GOODS, TAGS, TAG_IDS, type TagId } from "../data/goods";
import type { Bag, GoodId, PlacedGood } from "./types";

/** Cells an item covers after rotating `rot` quarter turns clockwise, normalised to start at 0,0. */
export function shapeOf(id: GoodId, rot: number): [number, number][] {
  let cells = GOODS[id].shape.map(([x, y]) => [x, y] as [number, number]);
  for (let i = 0; i < ((rot % 4) + 4) % 4; i++) cells = cells.map(([x, y]) => [-y, x] as [number, number]);
  const minX = Math.min(...cells.map((c) => c[0]));
  const minY = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - minX, y - minY]);
}

export function footprint(item: Pick<PlacedGood, "id" | "x" | "y" | "rot">): [number, number][] {
  return shapeOf(item.id, item.rot).map(([x, y]) => [x + item.x, y + item.y]);
}

export function sizeOf(id: GoodId, rot: number) {
  const s = shapeOf(id, rot);
  return { w: Math.max(...s.map((c) => c[0])) + 1, h: Math.max(...s.map((c) => c[1])) + 1 };
}

/** Grid of item uids (0 = empty). */
export function occupancy(bag: Bag, ignoreUid = -1): number[] {
  const grid = new Array(bag.w * bag.h).fill(0);
  for (const it of bag.items) {
    if (it.uid === ignoreUid) continue;
    for (const [x, y] of footprint(it)) grid[y * bag.w + x] = it.uid;
  }
  return grid;
}

export function fits(bag: Bag, id: GoodId, x: number, y: number, rot: number, ignoreUid = -1): boolean {
  const grid = occupancy(bag, ignoreUid);
  return shapeOf(id, rot).every(([dx, dy]) => {
    const cx = x + dx, cy = y + dy;
    return cx >= 0 && cy >= 0 && cx < bag.w && cy < bag.h && grid[cy * bag.w + cx] === 0;
  });
}

/** First free spot scanning rows then columns, trying every rotation. */
export function findSpot(bag: Bag, id: GoodId, ignoreUid = -1): { x: number; y: number; rot: number } | null {
  for (const rot of [0, 1, 2, 3]) {
    for (let y = 0; y < bag.h; y++) for (let x = 0; x < bag.w; x++) if (fits(bag, id, x, y, rot, ignoreUid)) return { x, y, rot };
  }
  return null;
}

/** Count one item type, or all trade goods when no id is given. */
/** Items touching `item` (any of the 8 cells around its footprint). */
export function neighbours(bag: Bag, item: PlacedGood): PlacedGood[] {
  const mine = footprint(item);
  return bag.items.filter((o) => o.uid !== item.uid && footprint(o).some(([x, y]) => mine.some(([mx, my]) => Math.abs(mx - x) <= 1 && Math.abs(my - y) <= 1)));
}

/** Sum of an aura kind that reaches `item` from accessories next to it. */
export function auraOn(bag: Bag, item: PlacedGood, kind: "dmg" | "blk" | "sell" | "ward" | "ash"): number {
  return neighbours(bag, item).reduce((s, o) => s + (GOODS[o.id].aura?.kind === kind ? GOODS[o.id].aura!.n : 0), 0);
}

/** Extra 灯灰 counted by ash-scaling cards: each ash next to a 灯油壶 counts again. */
export function ashBonus(bag: Bag): number {
  return bag.items.filter((it) => it.id === "ash" && auraOn(bag, it, "ash") > 0).length;
}

export function count(bag: Bag, id?: GoodId): number {
  return bag.items.filter((it) => (id ? it.id === id : GOODS[it.id].kind === "goods")).length;
}

export function value(bag: Bag): number {
  return bag.items.reduce((s, it) => s + GOODS[it.id].price, 0);
}

export function removeUid(bag: Bag, uid: number): PlacedGood | null {
  const i = bag.items.findIndex((it) => it.uid === uid);
  return i < 0 ? null : bag.items.splice(i, 1)[0];
}

/** Remove one of `id`, preferring the most recently added. */
export function removeOne(bag: Bag, id: GoodId): boolean {
  for (let i = bag.items.length - 1; i >= 0; i--) if (bag.items[i].id === id) { bag.items.splice(i, 1); return true; }
  return false;
}

export function mostValuable(bag: Bag): PlacedGood | null {
  let best: PlacedGood | null = null;
  // Thieves grab goods and consumables, never your gear.
  for (const it of bag.items) if (GOODS[it.id].kind !== "gear" && !auraOn(bag, it, "ward") && (!best || GOODS[it.id].price > GOODS[best.id].price)) best = it;
  return best;
}

export function cheapest(bag: Bag): PlacedGood | null {
  let best: PlacedGood | null = null;
  for (const it of bag.items) if (GOODS[it.id].kind === "goods" && (!best || GOODS[it.id].price < GOODS[best.id].price)) best = it;
  return best;
}

/** Try every item in a fresh layout (largest first). Used by "auto pack". Returns false if not all fit. */
export function autoPack(bag: Bag): boolean {
  const items = [...bag.items].sort((a, b) => GOODS[b.id].shape.length - GOODS[a.id].shape.length);
  const fresh: Bag = { w: bag.w, h: bag.h, items: [] };
  for (const it of items) {
    const spot = findSpot(fresh, it.id);
    if (!spot) return false;
    fresh.items.push({ ...it, ...spot });
  }
  bag.items = fresh.items;
  return true;
}

/** How many packed items carry each tag. */
export function tagCounts(bag: Bag): Record<TagId, number> {
  const out = Object.fromEntries(TAG_IDS.map((t) => [t, 0])) as Record<TagId, number>;
  for (const it of bag.items) for (const t of GOODS[it.id].tags ?? []) out[t]++;
  return out;
}

/** Set level for a tag: 0 (off), 1 (first threshold) or 2 (second). */
export function tagLevel(bag: Bag, tag: TagId): number {
  const n = tagCounts(bag)[tag], [a, b] = TAGS[tag].at;
  return n >= b ? 2 : n >= a ? 1 : 0;
}

/** Cells an accessory reaches when its footprint sits at the given cells (the 8 around it, inside the bag). */
export function auraCells(bag: Pick<Bag, "w" | "h">, cells: [number, number][]): [number, number][] {
  const own = new Set(cells.map(([x, y]) => `${x},${y}`));
  const out = new Map<string, [number, number]>();
  for (const [x, y] of cells) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const cx = x + dx, cy = y + dy, k = `${cx},${cy}`;
    if (cx >= 0 && cy >= 0 && cx < bag.w && cy < bag.h && !own.has(k)) out.set(k, [cx, cy]);
  }
  return [...out.values()];
}
