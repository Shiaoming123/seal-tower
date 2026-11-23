import { BASE_DECK, CARDS, type CardDef, STARTER_GEAR } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { EVENTS } from "../data/events";
import { GEAR_IDS, GOODS } from "../data/goods";
import { ORDERS } from "../data/orders";
import { RELICS } from "../data/relics";
import * as bag from "./bag";
import { combatDeck, has, startCombat } from "./combat";
import { DIRS, entityAt, generate, isWall, reveal, revealAll, revealNear } from "./dungeon";
import { addGood, autoPackPending, gainRelic, randomRelic } from "./inventory";
import { type RngState, chance, int, makeRng, pick, weighted } from "./rng";
import type { Entity, FloorNo, GoodId, Market, RewardState, RunState, ShopState, WeaponId } from "./types";

export const START_HP = 50;
export const START_GOLD = 20;
export const START_OIL = 90;
export const MAX_OIL = 120;
/** Extra damage per enemy hit while your lamp is out. */
export const DARK_DAMAGE = 3;

export function createRun(seed: number, weapon: WeaponId, order: string, difficulty = 0, regular = false): RunState {
  const rng = makeRng(seed);
  let uid = 1;
  const run: RunState = {
    version: 2, seed, rng, difficulty, weapon, order, orderDone: false, regular,
    hp: START_HP - difficulty * 3, maxHp: START_HP - difficulty * 3, gold: weapon === "abacus" ? 32 : START_GOLD,
    deck: BASE_DECK.map((id) => ({ uid: uid++, id, up: false })),
    relics: [],
    bag: { w: 5, h: 4, items: [] },
    floor: 1,
    dungeon: generate(1, rng),
    pos: { x: 0, y: 0, dir: 0 },
    screen: "explore", combat: null, pending: [], reward: null, event: null, shop: null, at: null,
    stats: { steps: 0, harvests: 0, kills: 0, goldEarned: 0, goodsSold: 0, goodsUsed: 0, damageTaken: 0, turns: 0 },
    nextUid: 1000, outcome: null, mapRevealed: false, markets: makeMarkets(rng), rumor: false, oil: START_OIL, maxOil: MAX_OIL, bossIntel: false, cardPick: null, log: [], flags: [],
  };
  enterFloor(run, 1);
  addGood(run, STARTER_GEAR[weapon]);
  if (weapon === "lamp") for (let i = 0; i < 4; i++) addGood(run, "ash");
  if (regular) {
    const r = ORDERS[order].regular;
    for (const g of r.gift) addGood(run, g);
    if (r.relic) gainRelic(run, r.relic);
  }
  return run;
}

function enterFloor(run: RunState, floor: FloorNo) {
  run.floor = floor;
  if (floor > 1) run.dungeon = generate(floor, run.rng);
  const s = run.dungeon.start;
  // Face the first open corridor so the floor doesn't start staring at a wall.
  const dir = [0, 1, 3, 2].find((d) => !isWall(run.dungeon, s.x + DIRS[d][0], s.y + DIRS[d][1])) ?? 0;
  run.pos = { x: s.x, y: s.y, dir };
  run.mapRevealed = false;
  run.bossIntel = false;
  run.rumor = false;
  run.shop = null;
  reveal(run.dungeon, s.x, s.y);
}

export function flag(run: RunState, f: string) { if (!run.flags.includes(f)) run.flags.push(f); }

export const currentEntity = (run: RunState): Entity | null => run.dungeon.entities.find((e) => e.id === run.at) ?? null;

/** Called after every step. Opens whatever is on the tile. Returns true if a screen opened. */
export function arrive(run: RunState, x: number, y: number, dir: number, deliberate: boolean): boolean {
  run.pos = { x, y, dir };
  run.stats.steps++;
  run.oil = Math.max(0, run.oil - 1);
  if (run.oil === 0) flag(run, "dark");
  // In the dark you only see the tiles right next to you.
  if (run.oil > 0) reveal(run.dungeon, x, y);
  else revealNear(run.dungeon, x, y);
  if (run.mapRevealed) revealAll(run.dungeon);
  const e = entityAt(run.dungeon, x, y);
  if (!e) return false;
  if (e.kind === "shop" && e.done && !deliberate) return false;
  return openEntity(run, e);
}

export function openEntity(run: RunState, e: Entity): boolean {
  run.at = e.id;
  switch (e.kind) {
    case "fight": case "elite": case "guardian":
      startCombat(run, e, e.kind);
      run.screen = "combat";
      return true;
    case "shop":
      if (!run.shop) run.shop = makeShop(run);
      e.done = true;
      run.screen = "shop";
      return true;
    case "event":
      run.event = { id: e.event!, step: 0, result: null };
      run.screen = "event";
      return true;
    case "rest":
      run.screen = "rest";
      return true;
    case "chest":
      e.done = true;
      run.reward = chestReward(run);
      run.screen = "reward";
      return true;
    case "stairs":
      return false; // the explore view shows the stairs prompt
  }
}

// ---------------------------------------------------------------- combat outcome

export function winCombat(run: RunState) {
  const c = run.combat!;
  const e = currentEntity(run)!;
  const def = ENEMIES[c.enemy.id];
  run.stats.kills++;
  const goods: GoodId[] = [];
  for (const d of def.drops) if (chance(c.rng, d.chance)) goods.push(d.good);
  for (let i = 0; i < c.harvest; i++) goods.push(def.drops[0].good);
  let note = "";
  if (def.part) {
    goods.push(c.enemy.partIntact ? def.part.good : def.part.broken);
    if (c.enemy.partIntact && def.part.good === "clasp") flag(run, "clasp");
    note = c.enemy.partIntact ? `${def.part.label}完好无损。` : `${def.part.label}被重击打碎了。`;
  }
  if (has(run, "lamp")) goods.push("ash");
  if (has(run, "fangcharm")) run.hp = Math.min(run.maxHp, run.hp + 4);
  // Normal fights sometimes drop a piece of basic gear; elites always drop tier-2 gear or better.
  const gearPool = GEAR_IDS.filter((id) => !["sword", "shield", "lamp"].includes(id));
  if (c.kind === "fight" && chance(c.rng, 0.3)) goods.push(pick(c.rng, gearPool.filter((id) => GOODS[id].tier === 1)));
  if (c.kind === "elite") goods.push(pick(c.rng, gearPool.filter((id) => GOODS[id].tier === 2)));
  if (def.harvest) {
    if (def.harvest.got(c)) {
      if (def.harvest.good === "stolen") { flag(run, "recover"); goods.push(...c.stolen); note += ` 追回了被抢的${c.stolen.map((g) => GOODS[g].name).join("、")}。`; }
      else { goods.push(def.harvest.good); note += ` 取材成功：多拿到${GOODS[def.harvest.good].name}。`; }
      run.stats.harvests++;
    } else if (def.harvest.good !== "stolen") note += ` 没能取到${def.harvest.label}（${def.harvest.text}）。`;
  }
  if (c.stolen.length && def.harvest?.good !== "stolen") note += ` 被抢走的${c.stolen.map((g) => GOODS[g].name).join("、")}被它毁了。`;
  const gold = c.kind === "guardian" && run.floor === 3 ? 0 : int(c.rng, def.gold[0], def.gold[1]);
  const reward: RewardState = {
    gold, goods, from: c.kind, note: note.trim(),
    cards: cardChoices(run, c.kind === "fight" ? "normal" : "elite"),
    relic: c.kind === "elite" ? randomRelic(run, "common") : null,
    relicChoices: c.kind === "guardian" && run.floor < 3 ? pickRelics(run, 3) : null,
  };
  run.combat = null;
  run.reward = reward;
  run.gold += gold;
  run.stats.goldEarned += gold;
  for (const g of goods) addGood(run, g);
  if (c.enemy.id === "bell" && c.interrupts > 0) flag(run, "bell-break");
  if (c.enemy.id === "bell" && combatDeck(run).length <= 14) flag(run, "lean");
  if (e.kind === "guardian") {
    e.kind = "stairs";
    e.done = false;
    if (run.floor === 3) { run.outcome = "win"; }
  } else e.done = true;
  run.screen = "reward";
}

/** A thief got away with your goods. No reward; the way is clear. */
export function fledCombat(run: RunState) {
  const e = currentEntity(run);
  if (e) e.done = true;
  run.combat = null;
  run.at = null;
  run.screen = "explore";
}

export function loseCombat(run: RunState) {
  run.outcome = "dead";
  run.combat = null;
  run.screen = "result";
}

/** Step back out of a normal fight. The enemy heals; stolen goods stay lost. */
export function flee(run: RunState, back: { x: number; y: number }) {
  run.combat = null;
  run.at = null;
  run.pos = { ...run.pos, x: back.x, y: back.y };
  run.screen = "explore";
}

function pickRelics(run: RunState, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const id = randomRelic({ ...run, relics: [...run.relics, ...out] }, i === 0 ? "rare" : undefined);
    if (id) out.push(id);
  }
  return out;
}

export function cardChoices(run: RunState, tier: "normal" | "elite" | "shop", n = 3): string[] {
  const pool = Object.values(CARDS).filter((c) => c.rarity !== "basic" && (c.pool === "neutral" || c.pool === run.weapon || chance(run.rng, 0.25)));
  const w = (c: CardDef) => {
    const base = c.rarity === "common" ? 60 : c.rarity === "uncommon" ? 30 : tier === "normal" ? 6 : 14;
    return base * (c.pool === run.weapon ? 1.6 : 1);
  };
  return weighted(run.rng, pool, w, n).map((c) => c.id);
}

function chestReward(run: RunState): RewardState {
  const relic = chance(run.rng, 0.6) ? randomRelic(run, "common") : null;
  const gold = int(run.rng, 10, 18);
  const goods: GoodId[] = relic ? ["pill"] : ["wick", "lining"];
  run.gold += gold;
  run.stats.goldEarned += gold;
  for (const g of goods) addGood(run, g);
  return { gold, goods, cards: null, relic, relicChoices: null, from: "chest", note: "" };
}

export function takeRewardCard(run: RunState, id: string | null) {
  if (!run.reward) return;
  if (id) run.deck.push({ uid: run.nextUid++, id, up: false });
  run.reward.cards = null;
}

export function takeRewardRelic(run: RunState, id: string) {
  if (!run.reward) return;
  gainRelic(run, id);
  run.reward.relic = null;
  run.reward.relicChoices = null;
  // A larger bag might now fit what was left on the floor.
  autoPackPending(run);
}

/** Leave the reward screen. Unpacked goods stay behind on the floor. */
export function closeReward(run: RunState) {
  run.reward = null;
  run.pending = [];
  run.at = null;
  run.screen = run.outcome === "win" ? "result" : "explore";
}

// ---------------------------------------------------------------- shop

function makeShop(run: RunState): ShopState {
  const off = run.relics.includes("pin") ? 0.8 : 1;
  const price = (n: number) => Math.round(n * off * (1 + 0.15 * (run.floor - 1)));
  const cardPrice = (id: string) => price({ common: 14, uncommon: 22, rare: 34, basic: 10 }[CARDS[id].rarity] + int(run.rng, -2, 2));
  const relics = [randomRelic(run, "common"), randomRelic(run)].filter((id, i, a): id is string => !!id && a.indexOf(id) === i);
  return {
    cards: cardChoices(run, "shop", 3).map((id) => ({ id, price: cardPrice(id), sold: false })),
    relics: relics.map((id) => ({ id, price: price(RELICS[id].price ?? 30), sold: false })),
    gear: weighted(run.rng, GEAR_IDS.filter((id) => !run.bag.items.some((it) => it.id === id) && !["sword", "shield", "lamp"].includes(id) || id === ["shield", "lamp", "sword"][run.floor - 1]),
      (id) => (GOODS[id].tier === 1 ? 3 : 2), 2).map((id) => ({ id, price: price(GOODS[id].price * 2), sold: false })),
    consumables: (["salve", "pill", "lining"] as GoodId[]).map((id) => ({ id, price: price(GOODS[id].price * 2), sold: false })),
    removePrice: price(18),
    removed: false,
    oil: { amount: 25, price: price(6), bought: 0 },
    wanted: run.markets[run.floor].wanted,
    sold: {},
  };
}

export const TRADE_GOODS: GoodId[] = ["ash", "fang", "silk", "shell", "knot", "wick", "clasp", "clasp-broken", "copper"];

/**
 * Each floor's shop pays its own prices, fixed when the run starts so rumours can be true.
 * Goods from the lower floors get scarcer (and dearer) the higher you climb.
 */
function makeMarkets(r: RngState): Record<FloorNo, Market> {
  const steps = [0.6, 0.8, 1, 1, 1.2, 1.4, 1.6];
  const lowGoods: GoodId[] = ["ash", "silk", "fang"];
  const out = {} as Record<FloorNo, Market>;
  for (const f of [1, 2, 3] as FloorNo[]) {
    const mult: Partial<Record<GoodId, number>> = {};
    for (const g of TRADE_GOODS) {
      const trend = lowGoods.includes(g) ? 0.15 * (f - 1) : 0;
      mult[g] = g === "copper" || g === "clasp-broken" ? 1 : Math.round((steps[int(r, 0, steps.length - 1)] + trend) * 10) / 10;
    }
    const wantedPool: GoodId[] = f === 1 ? ["silk", "fang", "shell"] : f === 2 ? ["shell", "knot", "fang", "ash"] : ["knot", "wick", "shell", "ash"];
    out[f] = { mult, wanted: wantedPool[int(r, 0, wantedPool.length - 1)] };
  }
  return out;
}

export function buyCard(run: RunState, i: number): boolean {
  const s = run.shop!.cards[i];
  if (!s || s.sold || run.gold < s.price) return false;
  run.gold -= s.price;
  s.sold = true;
  run.deck.push({ uid: run.nextUid++, id: s.id, up: false });
  return true;
}

export function buyRelic(run: RunState, i: number): boolean {
  const s = run.shop!.relics[i];
  if (!s || s.sold || run.gold < s.price) return false;
  run.gold -= s.price;
  s.sold = true;
  gainRelic(run, s.id);
  return true;
}

/** Buy gear or a consumable. Needs room in the bag so nothing is lost. */
export function buyItem(run: RunState, list: "gear" | "consumables", i: number): string | null {
  const s = run.shop![list][i];
  if (!s || s.sold) return "已经卖掉了";
  if (run.gold < s.price) return "石不够";
  if (!bag.findSpot(run.bag, s.id)) return "行囊放不下，先卖掉或丢掉点东西";
  run.gold -= s.price;
  s.sold = true;
  addGood(run, s.id);
  return null;
}

/** Top up the lamp. Each purchase costs 2 more than the last. */
export function buyOil(run: RunState): string | null {
  const s = run.shop!.oil;
  const cost = s.price + s.bought * 2;
  if (run.oil >= run.maxOil) return "灯已经满了";
  if (run.gold < cost) return "石不够";
  run.gold -= cost;
  s.bought++;
  run.oil = Math.min(run.maxOil, run.oil + s.amount);
  return null;
}

export const oilCost = (run: RunState) => run.shop!.oil.price + run.shop!.oil.bought * 2;

export function startRemove(run: RunState): boolean {
  const s = run.shop!;
  if (s.removed || run.gold < s.removePrice) return false;
  run.cardPick = { mode: "remove", source: "shop", price: s.removePrice };
  return true;
}

// ---------------------------------------------------------------- orders

export function orderProgress(run: RunState) {
  const o = ORDERS[run.order];
  const parts = Object.entries(o.needs).map(([id, n]) => ({ id: id as GoodId, need: n!, have: bag.count(run.bag, id as GoodId) }));
  return { order: o, parts, ready: !run.orderDone && parts.every((p) => p.have >= p.need) };
}

/** Hand the order in (at a shop, or automatically on returning to town). Returns the reward line. */
export function deliverOrder(run: RunState): string | null {
  const { order, parts, ready } = orderProgress(run);
  if (!ready) return null;
  for (const p of parts) for (let i = 0; i < p.need; i++) bag.removeOne(run.bag, p.id);
  run.orderDone = true;
  const r = order.reward;
  const lines: string[] = [];
  const gold = (r.gold ?? 0) + (run.regular ? order.regular.bonusGold ?? 0 : 0);
  if (gold) { run.gold += gold; run.stats.goldEarned += gold; lines.push(`${gold} 石`); }
  if (r.salve) for (let i = 0; i < r.salve; i++) addGood(run, "salve");
  if (r.salve) lines.push(`${r.salve} 瓶金疮药`);
  if (r.relic) { const id = randomRelic(run, "rare"); if (id) { gainRelic(run, id); lines.push(`法宝「${RELICS[id].name}」`); } }
  return `${order.client}收下了货。你得到 ${lines.join("、") || "声望"}。`;
}

// ---------------------------------------------------------------- events, rest, cards

export function chooseEvent(run: RunState, i: number): boolean {
  const ev = EVENTS[run.event!.id];
  const opt = ev.options[i];
  if (!opt || run.event!.result || opt.locked?.(run)) return false;
  run.event!.result = opt.apply(run);
  return true;
}

export function closeEvent(run: RunState) {
  const e = currentEntity(run);
  if (e) e.done = true;
  run.event = null;
  run.pending = [];
  run.at = null;
  run.screen = "explore";
}

export const REST_OIL = 40;

export function rest(run: RunState, choice: "heal" | "upgrade" | "oil") {
  const e = currentEntity(run);
  if (choice === "upgrade") { run.cardPick = { mode: "upgrade", source: "rest" }; return; }
  if (choice === "heal") run.hp = Math.min(run.maxHp, run.hp + Math.round(run.maxHp * 0.3));
  else run.oil = Math.min(run.maxOil, run.oil + REST_OIL);
  if (e) e.done = true;
  run.at = null;
  run.screen = "explore";
}

export function applyCardPick(run: RunState, uid: number | null) {
  const pickState = run.cardPick;
  if (!pickState) return;
  run.cardPick = null;
  if (uid === null) return; // cancelled
  const card = run.deck.find((c) => c.uid === uid);
  if (!card) return;
  if (pickState.mode === "upgrade") card.up = true;
  else run.deck = run.deck.filter((c) => c.uid !== uid);
  if (pickState.source === "shop" && run.shop) { run.gold -= pickState.price ?? 0; run.shop.removed = true; }
  if (pickState.source === "rest") {
    const e = currentEntity(run);
    if (e) e.done = true;
    run.at = null;
    run.screen = "explore";
  }
}

// ---------------------------------------------------------------- floors

export function climb(run: RunState) {
  if (run.floor >= 3) return;
  const healed = Math.round((run.maxHp - run.hp) * 0.5);
  run.hp += healed;
  enterFloor(run, (run.floor + 1) as FloorNo);
  run.screen = "explore";
}

/** Leave the tower early with what you carry. */
export function goHome(run: RunState) {
  run.outcome = run.outcome ?? "retreat";
  run.screen = "result";
}

export function floorsCleared(run: RunState) {
  const beatGuardian = run.dungeon.entities.some((e) => e.kind === "stairs");
  return run.floor - 1 + (beatGuardian ? 1 : 0);
}

/** Renown earned by this run, settled on the result screen. Also delivers return-only orders. */
export function settle(run: RunState): { renown: number; lines: string[] } {
  const lines: string[] = [];
  let renown = 0;
  const cleared = floorsCleared(run);
  if (run.outcome !== "dead") {
    const o = ORDERS[run.order];
    if (o.onReturn && orderProgress(run).ready) { deliverOrder(run); }
    if (run.orderDone) { renown += o.renown; lines.push(`完成委托「${o.title}」 +${o.renown}`); }
  } else if (run.orderDone) {
    const o = ORDERS[run.order];
    renown += o.renown;
    lines.push(`委托「${o.title}」已在塔里交付 +${o.renown}`);
  }
  if (cleared) { renown += cleared; lines.push(`打通 ${cleared} 层 +${cleared}`); }
  if (run.outcome === "win") { renown += 2; lines.push("击败负钟君 +2"); }
  return { renown, lines };
}

export const UPGRADED_NAME = (id: string, up: boolean) => CARDS[id].name + (up ? "+" : "");
