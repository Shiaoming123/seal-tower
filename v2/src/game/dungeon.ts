import { FLOOR_SPAWNS } from "../data/enemies";
import { EVENTS, EVENT_IDS } from "../data/events";
import { type RngState, int, next, pick, shuffle } from "./rng";
import type { Dungeon, Entity, EntityKind, FloorNo } from "./types";

export const DIRS: [number, number][] = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // N E S W
export const DIR_NAMES = ["北", "东", "南", "西"];

const SIZES: Record<FloorNo, [number, number]> = { 1: [5, 5], 2: [6, 5], 3: [6, 6] };
const FIGHTS: Record<FloorNo, number> = { 1: 4, 2: 4, 3: 4 };

export const idx = (d: Dungeon, x: number, y: number) => y * d.w + x;
export const isWall = (d: Dungeon, x: number, y: number) => x < 0 || y < 0 || x >= d.w || y >= d.h || d.tiles[idx(d, x, y)] === 1;
/** Active entity on a tile. Shops stay visitable after the first visit. */
export const entityAt = (d: Dungeon, x: number, y: number) =>
  d.entities.find((e) => e.x === x && e.y === y && (!e.done || e.kind === "shop"));

export function generate(floor: FloorNo, r: RngState): Dungeon {
  const [cw, ch] = SIZES[floor];
  const w = cw * 2 + 1, h = ch * 2 + 1;
  const tiles = new Array(w * h).fill(1);
  const open = (x: number, y: number) => { tiles[y * w + x] = 0; };
  // Recursive backtracker over cells.
  const visited = new Set<number>();
  const startCell = { x: Math.floor(cw / 2), y: ch - 1 };
  const stack = [startCell];
  visited.add(startCell.y * cw + startCell.x);
  open(startCell.x * 2 + 1, startCell.y * 2 + 1);
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = shuffle(r, [0, 1, 2, 3]).map((d) => ({ d, x: cur.x + DIRS[d][0], y: cur.y + DIRS[d][1] }))
      .filter((n) => n.x >= 0 && n.y >= 0 && n.x < cw && n.y < ch && !visited.has(n.y * cw + n.x));
    if (!options.length) { stack.pop(); continue; }
    const n = options[0];
    visited.add(n.y * cw + n.x);
    open(cur.x * 2 + 1 + DIRS[n.d][0], cur.y * 2 + 1 + DIRS[n.d][1]);
    open(n.x * 2 + 1, n.y * 2 + 1);
    stack.push({ x: n.x, y: n.y });
  }
  // Knock out a few walls so there are loops and optional detours.
  const loops = Math.round(cw * ch * 0.18);
  for (let i = 0, tries = 0; i < loops && tries < 200; tries++) {
    const x = int(r, 1, w - 2), y = int(r, 1, h - 2);
    const horizontal = x % 2 === 0 && y % 2 === 1, vertical = x % 2 === 1 && y % 2 === 0;
    if ((horizontal || vertical) && tiles[y * w + x] === 1) { open(x, y); i++; }
  }

  const d: Dungeon = { w, h, tiles, seen: new Array(w * h).fill(false), start: { x: startCell.x * 2 + 1, y: startCell.y * 2 + 1, dir: 0 }, entities: [] };
  placeEntities(d, floor, r);
  return d;
}

export function distances(d: Dungeon, from: { x: number; y: number }): number[] {
  const dist = new Array(d.w * d.h).fill(-1);
  const q = [from];
  dist[idx(d, from.x, from.y)] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy;
      if (isWall(d, x, y) || dist[idx(d, x, y)] >= 0) continue;
      dist[idx(d, x, y)] = dist[idx(d, c.x, c.y)] + 1;
      q.push({ x, y });
    }
  }
  return dist;
}

function openNeighbours(d: Dungeon, x: number, y: number) {
  return DIRS.filter(([dx, dy]) => !isWall(d, x + dx, y + dy)).length;
}

function placeEntities(d: Dungeon, floor: FloorNo, r: RngState) {
  const dist = distances(d, d.start);
  const cells: { x: number; y: number; dist: number; dead: boolean }[] = [];
  for (let y = 1; y < d.h; y += 2) for (let x = 1; x < d.w; x += 2) {
    if (x === d.start.x && y === d.start.y) continue;
    cells.push({ x, y, dist: dist[idx(d, x, y)], dead: openNeighbours(d, x, y) === 1 });
  }
  const used = new Set<string>();
  const take = (c: { x: number; y: number }) => used.add(c.x + "," + c.y);
  const free = () => cells.filter((c) => !used.has(c.x + "," + c.y));
  let id = 1;
  const add = (kind: EntityKind, c: { x: number; y: number }, extra: Partial<Entity> = {}) => {
    take(c);
    d.entities.push({ id: id++, kind, x: c.x, y: c.y, done: false, ...extra });
  };
  const spawns = FLOOR_SPAWNS[floor];
  const maxDist = Math.max(...cells.map((c) => c.dist));

  // Guardian on the farthest cell, prefer dead ends.
  const far = [...cells].sort((a, b) => (b.dist + (b.dead ? 2 : 0)) - (a.dist + (a.dead ? 2 : 0)))[0];
  add("guardian", far, { enemy: pick(r, spawns.guardian).id });
  const guardDist = distances(d, far);
  const gd = (c: { x: number; y: number }) => guardDist[idx(d, c.x, c.y)];

  // Rest close to the guardian so the player can heal before the fight.
  const restSpot = free().filter((c) => gd(c) >= 2 && gd(c) <= 6 && c.dist >= 4).sort((a, b) => gd(a) - gd(b))[0] ?? free()[0];
  add("rest", restSpot);

  // Shop around the middle of the floor.
  const shopSpot = free().sort((a, b) => Math.abs(a.dist - maxDist * 0.45) - Math.abs(b.dist - maxDist * 0.45))[0];
  add("shop", shopSpot);

  // Elite in a dead end if possible, a chest in another dead end.
  const deadEnds = shuffle(r, free().filter((c) => c.dead && c.dist >= 4));
  const eliteSpawn = pick(r, spawns.elite);
  add("elite", deadEnds[0] ?? pick(r, free().filter((c) => c.dist >= 4)), { enemy: eliteSpawn.id, hpMul: eliteSpawn.hp, dmgAdd: eliteSpawn.dmg });
  const chestSpot = free().filter((c) => c.dead)[0] ?? pick(r, free());
  add("chest", chestSpot);

  // Three events.
  const events = shuffle(r, EVENT_IDS.filter((id) => (EVENTS[id].minFloor ?? 1) <= floor));
  for (let i = 0; i < 3; i++) {
    const options = free().filter((c) => c.dist >= 2);
    if (!options.length) break;
    add("event", pick(r, options), { event: events[i] });
  }

  // Normal fights, spread out: prefer cells not adjacent to other fights.
  const roster = shuffle(r, [...spawns.normal]);
  for (let i = 0; i < FIGHTS[floor]; i++) {
    const options = free().filter((c) => c.dist >= 2);
    if (!options.length) break;
    const scored = options.map((c) => ({ c, s: Math.min(...d.entities.map((e) => Math.abs(e.x - c.x) + Math.abs(e.y - c.y))) + next(r) * 2 }));
    scored.sort((a, b) => b.s - a.s);
    const spawn = roster[i % roster.length];
    add("fight", scored[0].c, { enemy: spawn.id, hpMul: spawn.hp, dmgAdd: spawn.dmg });
  }
}

/** Reveal what the player can see from (x, y): neighbours and straight corridors. */
export function reveal(d: Dungeon, x: number, y: number) {
  const mark = (tx: number, ty: number) => { if (tx >= 0 && ty >= 0 && tx < d.w && ty < d.h) d.seen[idx(d, tx, ty)] = true; };
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) mark(x + dx, y + dy);
  for (const [dx, dy] of DIRS) {
    let cx = x, cy = y;
    for (let i = 0; i < 12; i++) {
      cx += dx; cy += dy;
      mark(cx, cy);
      mark(cx + dy, cy + dx);
      mark(cx - dy, cy - dx);
      if (isWall(d, cx, cy)) break;
    }
  }
}

export function revealAll(d: Dungeon) { d.seen.fill(true); }

/** With the lamp out: only the eight tiles around you. */
export function revealNear(d: Dungeon, x: number, y: number) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const tx = x + dx, ty = y + dy;
    if (tx >= 0 && ty >= 0 && tx < d.w && ty < d.h) d.seen[idx(d, tx, ty)] = true;
  }
}

/** BFS over seen floor tiles. Entities that are still active block the path unless they are the goal. */
export function findPath(d: Dungeon, from: { x: number; y: number }, to: { x: number; y: number }, ignoreEntities = false): { x: number; y: number }[] | null {
  if (isWall(d, to.x, to.y) || !d.seen[idx(d, to.x, to.y)]) return null;
  const prev = new Map<number, number>();
  const start = idx(d, from.x, from.y), goal = idx(d, to.x, to.y);
  const q = [from];
  prev.set(start, -1);
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    if (idx(d, c.x, c.y) === goal) break;
    for (const [dx, dy] of DIRS) {
      const x = c.x + dx, y = c.y + dy, k = idx(d, x, y);
      if (isWall(d, x, y) || prev.has(k) || !d.seen[k]) continue;
      if (!ignoreEntities && k !== goal && entityAt(d, x, y) && blocks(entityAt(d, x, y)!)) continue;
      prev.set(k, idx(d, c.x, c.y));
      q.push({ x, y });
    }
  }
  if (!prev.has(goal)) return null;
  const path: { x: number; y: number }[] = [];
  for (let k = goal; k !== start; k = prev.get(k)!) path.unshift({ x: k % d.w, y: Math.floor(k / d.w) });
  return path;
}

/** Entities you must stop at (fights, events…). Finished shops and rests can be walked through. */
export const blocks = (e: Entity) => !e.done;

/** Ids of active entities currently on revealed tiles (what the minimap shows). */
export function sightedIds(d: Dungeon): Set<number> {
  return new Set(d.entities.filter((e) => !e.done && e.kind !== "stairs" && d.seen[idx(d, e.x, e.y)]).map((e) => e.id));
}

/** Entities that became visible since `before` — auto-walk stops when one appears. */
export function newlySighted(d: Dungeon, before: Set<number>): Entity[] {
  return d.entities.filter((e) => !e.done && e.kind !== "stairs" && d.seen[idx(d, e.x, e.y)] && !before.has(e.id));
}
