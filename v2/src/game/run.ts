import { bump, noteFloorEnd } from "./stats";
import { BASE_DECK, CARDS, type CardDef, STARTER_GEAR } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { eventOptions } from "../data/events";
import { GEAR_IDS, GOODS } from "../data/goods";
import { ORDERS } from "../data/orders";
import { RELICS } from "../data/relics";
import * as bag from "./bag";
import { combatDeck, has, startCombat } from "./combat";
import { DIRS, entityAt, generate, isWall, reveal, revealAll, revealNear } from "./dungeon";
import { OMENS } from "../data/omens";
import { ORDER_CHARACTER, discover } from "./discover";
import { addGood, autoPackPending, gainRelic, randomRelic } from "./inventory";
import { type RngState, chance, int, makeRng, pick, weighted } from "./rng";
import type { Entity, FloorNo, GoodId, Market, RewardState, RunOrder, RunState, ShopState, WeaponId } from "./types";
import { MAX_FAVOR } from "../data/town";

export const START_HP = 54;
export const START_GOLD = 20;
export const START_OIL = 90;
export const MAX_OIL = 120;
/** Extra damage per enemy hit while your lamp is out. */
export const DARK_DAMAGE = 3;

export interface RunOptions {
  /** 交情 per client; missing = 0. */
  favor?: Record<string, number>;
  /** 营建 levels. */
  upgrades?: Record<string, number>;
}

/** `regular: true` is shorthand for favour 1 with every chosen client (used by tests). */
export function createRun(seed: number, weapon: WeaponId, orders: string | string[], difficulty = 0, opts: boolean | RunOptions = false): RunState {
  const rng = makeRng(seed);
  const ids = Array.isArray(orders) ? orders : [orders];
  const o: RunOptions = opts === true ? { favor: Object.fromEntries(ids.map((id) => [id, 1])) } : opts || {};
  const town = { ...(o.upgrades ?? {}) };
  let uid = 1;
  const extraOil = (town.oil ?? 0) * 15;
  const run: RunState = {
    version: 2, seed, rng, difficulty, weapon,
    orders: ids.map((id) => ({ id, level: Math.min(MAX_FAVOR, o.favor?.[id] ?? 0), done: false })), town,
    hp: START_HP - difficulty * 3, maxHp: START_HP - difficulty * 3,
    gold: (weapon === "abacus" ? 32 : START_GOLD) + (town.ledger ?? 0) * 15,
    deck: BASE_DECK.map((id) => ({ uid: uid++, id, up: false })),
    relics: [],
    bag: { w: 5, h: town.bagsmith ? 5 : 4, items: [] },
    floor: 1,
    dungeon: generate(1, rng),
    pos: { x: 0, y: 0, dir: 0 },
    screen: "explore", combat: null, pending: [], pouch: [], reward: null, event: null, shop: null, at: null,
    stats: { steps: 0, harvests: 0, kills: 0, goldEarned: 0, goodsSold: 0, goodsUsed: 0, damageTaken: 0, turns: 0, startedAt: Date.now() },
    nextUid: 1000, outcome: null, mapRevealed: false, markets: makeMarkets(rng), rumor: false,
    oil: START_OIL + extraOil, maxOil: MAX_OIL + extraOil, bossIntel: false, cardPick: null, log: [], flags: [], eventFight: null, warp: 0, omen: "calm", omenSeen: false, discovered: [],
  };
  enterFloor(run, 1);
  for (const ord of run.orders) discover(run, "c:" + ORDER_CHARACTER[ord.id]);
  addGood(run, STARTER_GEAR[weapon]);
  if (weapon === "lamp") for (let i = 0; i < 4; i++) addGood(run, "ash");
  for (const ord of run.orders) if (ord.level >= 1) {
    const r = ORDERS[ord.id].regular;
    for (const g of r.gift) addGood(run, g);
    if (r.relic) gainRelic(run, r.relic);
  }
  if (town.medicine) addGood(run, "salve");
  if ((town.medicine ?? 0) >= 2) addGood(run, "pill");
  if (town.shelf) {
    const tier = town.shelf >= 2 ? 2 : 1;
    addGood(run, pick(rng, GEAR_IDS.filter((id) => GOODS[id].tier === tier && !["sword", "shield", "lamp", "abacus"].includes(id))));
  }
  if (town.school) {
    run.reward = { gold: 0, goods: [], cards: cardChoices(run, "elite"), relic: null, relicChoices: null, from: "school", note: "学堂的先生教你一招，挑一张带进塔。" };
    run.screen = "reward";
  }
  return run;
}

function enterFloor(run: RunState, floor: FloorNo) {
  run.floor = floor;
  if (floor > 1) run.dungeon = generate(floor, run.rng);
  run.omen = weighted(run.rng, OMENS, (o) => o.weight)[0].id;
  run.omenSeen = false;
  const s = run.dungeon.start;
  // Face the first open corridor so the floor doesn't start staring at a wall.
  const dir = [0, 1, 3, 2].find((d) => !isWall(run.dungeon, s.x + DIRS[d][0], s.y + DIRS[d][1])) ?? 0;
  run.pos = { x: s.x, y: s.y, dir };
  run.mapRevealed = false;
  run.bossIntel = false;
  run.rumor = false;
  run.shop = null;
  if (run.omen === "festival") { run.maxOil += 20; run.oil = run.maxOil; }
  if (run.omen === "moon") revealAll(run.dungeon);
  else if (run.omen === "fog") revealNear(run.dungeon, s.x, s.y);
  else reveal(run.dungeon, s.x, s.y);
}

export const omenIs = (run: RunState, id: string) => run.omen === id;

export function flag(run: RunState, f: string) { if (!run.flags.includes(f)) run.flags.push(f); }

export const currentEntity = (run: RunState): Entity | null => run.dungeon.entities.find((e) => e.id === run.at) ?? null;

/** Called after every step. Opens whatever is on the tile. Returns true if a screen opened. */
export function arrive(run: RunState, x: number, y: number, dir: number, deliberate: boolean): boolean {
  run.pos = { x, y, dir };
  run.stats.steps++;
  run.omenSeen = true; // walking on means you've read the floor's 签文
  run.oil = Math.max(0, run.oil - 1 - (run.omen === "rain" && run.stats.steps % 3 === 0 ? 1 : 0));
  if (run.oil === 0) flag(run, "dark");
  // In the dark (or the fog) you only see the tiles right next to you.
  if (run.oil > 0 && run.omen !== "fog") reveal(run.dungeon, x, y);
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
      if (e.kind === "elite") bump(run, "elitesFought");
      startCombat(run, e, e.kind);
      run.screen = "combat";
      return true;
    case "shop":
      discover(run, "c:feixiao");
      if (!run.shop) run.shop = makeShop(run);
      e.done = true;
      run.screen = "shop";
      return true;
    case "event":
      discover(run, "v:" + e.event);
      if (e.event === "guide" || e.event === "broker") discover(run, "c:" + e.event);
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

/** 负钟君 pays this much: the top of the tower used to pay nothing, so climbing it lost money (REVIEW-001). */
export const BELL_GOLD = 60;
/** 算盘 earns this much more per won fight: the coin weapon's cards spend coin you could otherwise carry home. */
export const ABACUS_WIN_GOLD = 2;
/** What you carry home is multiplied by how far you got: clearing more floors must be worth more than going home early. */
export const CARRY_MULT = [1, 1, 1.2, 1.6];
/** Each difficulty level adds this much to what you carry home. */
export const CARRY_DIFFICULTY_BONUS = 0.15;

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
  if (has(run, "lamp-fine")) goods.push("ash");
  if (run.omen === "horde" && c.kind === "fight") goods.push(def.drops[0].good);
  if (has(run, "fangcharm")) run.hp = Math.min(run.maxHp, run.hp + 3); // REVIEW-001: 4 → 3
  // Normal fights sometimes drop a piece of basic gear; elites always drop tier-2 gear or better.
  const gearPool = GEAR_IDS.filter((id) => !["sword", "shield", "lamp"].includes(id));
  if (c.kind === "fight" && chance(c.rng, 0.3)) goods.push(pick(c.rng, gearPool.filter((id) => GOODS[id].tier === 1)));
  // Elites (REVIEW-001): on floor 3 the reward turns into money and valuables to carry home, since a relic or gear
  // there only helps for one more fight. (Floor 1's elite keeps its gear but hits harder, see FLOOR_SPAWNS.)
  if (c.kind === "elite" && run.floor < 3) goods.push(pick(c.rng, gearPool.filter((id) => GOODS[id].tier === 2)));
  if (c.kind === "elite" && run.floor === 3) goods.push("token", "rubbing");
  if (def.harvest) {
    if (def.harvest.got(c)) {
      if (def.harvest.good === "stolen") { flag(run, "recover"); goods.push(...c.stolen); note += ` 追回了被抢的${c.stolen.map((g) => GOODS[g].name).join("、")}。`; }
      else {
        goods.push(def.harvest.good);
        note += ` 取材成功：多拿到${GOODS[def.harvest.good].name}。`;
        if (def.harvest.good === "token") flag(run, "token");
        if (run.omen === "bloodmoon") goods.push(def.harvest.good);
        if (has(run, "butcher")) { goods.push(def.harvest.good); run.gold += 5; run.stats.goldEarned += 5; note += " 庖丁刀又多割下一份，外加 5 石。"; }
      }
      run.stats.harvests++;
    } else if (def.harvest.good !== "stolen") note += ` 没能取到${def.harvest.label}（${def.harvest.text}）。`;
  }
  // 淬炼: gear next to its accessory is refined after a win, and the accessory is used up.
  const refined = bag.pendingRefines(run.bag);
  for (const r of refined) {
    note += ` 淬炼：${GOODS[r.gear.id].name}和${GOODS[r.with.id].name}炼成了${GOODS[r.into].name}。`;
    bag.removeUid(run.bag, r.with.uid);
    r.gear.id = r.into;
    bump(run, "refines");
    discover(run, "g:" + r.into);
  }
  if (c.stolen.length && def.harvest?.good !== "stolen") note += ` 被抢走的${c.stolen.map((g) => GOODS[g].name).join("、")}被它毁了。`;
  if (has(run, "sealbag") && c.stolen.length) { goods.push(...c.stolen); note += ` 封口锦囊：抢走的${c.stolen.map((g) => GOODS[g].name).join("、")}拿回来了。`; }
  const gold = (c.kind === "guardian" && run.floor === 3 ? BELL_GOLD : int(c.rng, def.gold[0], def.gold[1]))
    + (run.omen === "fog" ? 6 : 0) + (run.omen === "patrol" && c.kind === "elite" ? 20 : 0)
    + (c.kind === "elite" && run.floor === 3 ? 40 : 0)
    + (has(run, "abacus") ? ABACUS_WIN_GOLD : 0)
    + (bag.tagLevel(run.bag, "material") >= 2 ? 3 : 0)
    + (has(run, "sealbag") ? c.goldStolen : 0);
  const reward: RewardState = {
    gold, goods, from: c.kind, note: note.trim(),
    cards: cardChoices(run, c.kind === "fight" ? "normal" : "elite"),
    relic: c.kind === "elite" && run.floor < 3 ? randomRelic(run, "common") : null,
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
    if (run.floor === 3) { run.outcome = "win"; noteFloorEnd(run); }
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
  if (run.combat) run.stats.killedBy = run.combat.enemy.id;
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
  // GAME-008: goods that didn't fit stay in the floor's pile (run.pending) until you leave the floor.
  run.at = null;
  run.screen = run.outcome === "win" ? "result" : "explore";
}

// ---------------------------------------------------------------- shop

/** 狐市 prices rise this much per floor below the first (deeper markets know you're carrying more). */
export const SHOP_INFLATION = 0.25;

function makeShop(run: RunState): ShopState {
  const off = (run.relics.includes("pin") ? 0.8 : 1) * (run.omen === "market" ? 0.75 : 1) * (bag.tagLevel(run.bag, "coin") >= 1 ? 0.8 : 1);
  const price = (n: number) => Math.round(n * off * (1 + SHOP_INFLATION * (run.floor - 1)));
  const cardPrice = (id: string) => price({ common: 14, uncommon: 22, rare: 34, basic: 10 }[CARDS[id].rarity] + int(run.rng, -2, 2));
  const relics = [randomRelic(run, "common"), randomRelic(run)].filter((id, i, a): id is string => !!id && a.indexOf(id) === i);
  return {
    cards: cardChoices(run, "shop", 3 + (run.town.branch ? 1 : 0)).map((id) => ({ id, price: cardPrice(id), sold: false })),
    relics: relics.map((id) => ({ id, price: price(RELICS[id].price ?? 30), sold: false })),
    gear: weighted(run.rng, GEAR_IDS.filter((id) => !run.bag.items.some((it) => it.id === id) && !["sword", "shield", "lamp"].includes(id) || id === ["shield", "lamp", "sword"][run.floor - 1]),
      (id) => (GOODS[id].tier === 1 ? 3 : 2), 2 + (run.town.branch ? 1 : 0)).map((id) => ({ id, price: price(GOODS[id].price * 2), sold: false })),
    consumables: (["salve", "pill", "lining"] as GoodId[]).map((id) => ({ id, price: price(GOODS[id].price * 2), sold: false })),
    removePrice: price(18),
    removed: false,
    oil: { amount: 25, price: price(6), bought: 0 },
    wanted: run.markets[run.floor].wanted,
    sold: {},
  };
}

export const TRADE_GOODS: GoodId[] = ["ash", "fang", "silk", "shell", "knot", "wick", "clasp", "clasp-broken", "copper", "redpaper", "fur", "inkdust", "pearl", "rubbing", "token", "shard", "feather", "tail"];

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

/** What an order asks for at your current favour: every two levels, one more of each good (钟铜 excepted). */
export function orderNeeds(ord: RunOrder): Partial<Record<GoodId, number>> {
  const extra = Math.floor(ord.level / 2);
  return Object.fromEntries(Object.entries(ORDERS[ord.id].needs).map(([g, n]) => [g, g === "copper" ? n : n! + extra]));
}

/** Reward scaled by favour: +25% coin per level, +1 renown per two levels. */
export function orderReward(ord: RunOrder) {
  const o = ORDERS[ord.id];
  const gold = Math.round((o.reward.gold ?? 0) * (1 + 0.25 * ord.level)) + (ord.level >= 1 ? o.regular.bonusGold ?? 0 : 0);
  return { gold, salve: o.reward.salve ?? 0, relic: o.reward.relic, renown: o.renown + Math.floor(ord.level / 2) };
}

export function orderRewardText(ord: RunOrder): string {
  const r = orderReward(ord);
  const parts = [r.gold ? `${r.gold} 石` : "", r.salve ? `${r.salve} 瓶金疮药` : "", r.relic ? "一件稀有法宝" : ""].filter(Boolean);
  return `${parts.join("、") || "声望"} · 声望 +${r.renown}`;
}

export function orderProgress(run: RunState, i = 0) {
  const ord = run.orders[i];
  const order = ORDERS[ord.id];
  const parts = Object.entries(orderNeeds(ord)).map(([id, n]) => ({ id: id as GoodId, need: n!, have: bag.count(run.bag, id as GoodId) + run.pouch.filter((g) => g === id).length + run.pending.filter((g) => g === id).length }));
  return { ord, order, parts, ready: !ord.done && parts.every((p) => p.have >= p.need) };
}

/** Hand an order in (at a shop, or automatically on returning to town). Returns the reward line. */
export function deliverOrder(run: RunState, i = 0): string | null {
  const { ord, order, parts, ready } = orderProgress(run, i);
  if (!ready) return null;
  // Hand over loose goods (the floor's pile) first, then packed ones, then the side pouch.
  for (const p of parts) for (let k = 0; k < p.need; k++) {
    const pi = run.pending.indexOf(p.id);
    if (pi >= 0) run.pending.splice(pi, 1);
    else if (!bag.removeOne(run.bag, p.id)) run.pouch.splice(run.pouch.indexOf(p.id), 1);
  }
  ord.done = true;
  bump(run, "ordersDone");
  const r = orderReward(ord);
  const lines: string[] = [];
  if (r.gold) { run.gold += r.gold; run.stats.goldEarned += r.gold; lines.push(`${r.gold} 石`); }
  for (let k = 0; k < r.salve; k++) addGood(run, "salve");
  if (r.salve) lines.push(`${r.salve} 瓶金疮药`);
  if (r.relic) { const id = randomRelic(run, "rare"); if (id) { gainRelic(run, id); lines.push(`法宝「${RELICS[id].name}」`); } }
  return `${order.client}收下了货。你得到 ${lines.join("、") || "声望"}。`;
}

// ---------------------------------------------------------------- events, rest, cards

/** Options of the open event, stable for this event. */
export function currentEventOptions(run: RunState) {
  return eventOptions(run, run.event!.id, (run.seed ^ Math.imul((run.at ?? 0) + 1, 2654435761)) >>> 0);
}

export function chooseEvent(run: RunState, i: number): boolean {
  const opt = currentEventOptions(run)[i];
  if (!opt || run.event!.result || opt.locked?.(run)) return false;
  run.event!.result = opt.apply(run);
  return true;
}

/** Leave the event. If it turned into a fight, the fight starts here. */
export function closeEvent(run: RunState) {
  const e = currentEntity(run);
  if (run.omen === "incense") run.hp = Math.min(run.maxHp, run.hp + 5);
  run.event = null;
  if (e && run.eventFight) {
    const f = run.eventFight;
    run.eventFight = null;
    Object.assign(e, { kind: f.kind, enemy: f.enemy, hpMul: f.hpMul, dmgAdd: f.dmgAdd, done: false });
    openEntity(run, e);
    return;
  }
  if (e) e.done = true;
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
  else if (pickState.mode === "copy") run.deck.push({ ...card, uid: run.nextUid++ });
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

/** Share of missing 气血 you get back when you take the stairs. */
export const CLIMB_HEAL = 0.4;

/** Leaving a floor: whatever is still in the pile (not packed) stays behind. */
function leavePile(run: RunState) {
  bump(run, "leftBehind", run.pending.length);
  run.pending = [];
}

export function climb(run: RunState) {
  if (run.floor >= 3) return;
  noteFloorEnd(run);
  leavePile(run);
  const healed = Math.round((run.maxHp - run.hp) * CLIMB_HEAL);
  run.hp += healed;
  enterFloor(run, (run.floor + 1) as FloorNo);
  run.screen = "explore";
}

/** Leave the tower early with what you carry. */
export function goHome(run: RunState) {
  if (!run.outcome) noteFloorEnd(run); // after the final win the floor was already counted
  leavePile(run);
  run.outcome = run.outcome ?? "retreat";
  run.screen = "result";
}

export function floorsCleared(run: RunState) {
  if (run.outcome === "win") return 3;
  const beatGuardian = run.dungeon.entities.some((e) => e.kind === "stairs");
  return run.floor - 1 + (beatGuardian ? 1 : 0);
}

/** What something in the bag is worth back in town: goods at full price, gear and consumables at half. */
export function townValue(id: GoodId): number {
  const g = GOODS[id];
  return g.kind === "goods" ? g.price : Math.floor(g.price / 2);
}

/**
 * Settle the run on the result screen. Delivers return-only orders, then works out renown and
 * what you bring home: alive, your coin plus the town value of your bag goes into the treasury;
 * dead, it is all lost.
 */
export function settle(run: RunState): { renown: number; lines: string[]; carried: number; carriedLines: string[]; delivered: string[] } {
  const lines: string[] = [];
  let renown = 0;
  const cleared = floorsCleared(run);
  const alive = run.outcome !== "dead";
  run.orders.forEach((ord, i) => {
    if (alive && ORDERS[ord.id].onReturn && orderProgress(run, i).ready) deliverOrder(run, i);
    if (ord.done) {
      const r = orderReward(ord).renown;
      renown += r;
      lines.push(`完成委托「${ORDERS[ord.id].title}」 +${r}`);
    }
  });
  if (cleared) { renown += cleared; lines.push(`打通 ${cleared} 层 +${cleared}`); }
  if (run.outcome === "win") { renown += 2; lines.push("击败负钟君 +2"); }
  const carriedIds = [...run.bag.items.flatMap((it) => Array<GoodId>(bag.qty(it)).fill(it.id)), ...run.pouch];
  // 妖材 set: each 妖材 is worth 2 more in town too, not only at the 狐市.
  const materialBonus = bag.tagLevel(run.bag, "material") >= 1 ? 2 * carriedIds.filter((id) => GOODS[id].tags?.includes("material")).length : 0;
  const goodsValue = carriedIds.reduce((s, id) => s + townValue(id), 0) + materialBonus;
  // Further up and harder pays more (REVIEW-001): ×1 for one floor, ×1.2 for two, ×1.6 for the top, +15% per difficulty.
  const mult = CARRY_MULT[Math.min(3, cleared)] * (1 + CARRY_DIFFICULTY_BONUS * run.difficulty);
  const carried = alive ? Math.round((run.gold + goodsValue) * mult) : 0;
  const multLine = mult > 1 ? `${cleared >= 3 ? "登顶" : `打通 ${cleared} 层`}${run.difficulty ? `、难度 ${run.difficulty}` : ""}：库银 ×${mult.toFixed(2).replace(/\.?0+$/, "")}` : null;
  const carriedLines = alive
    ? [`身上的石 ${run.gold}`, `行囊里的东西折价 ${goodsValue}${materialBonus ? `（妖材凑齐，多算 ${materialBonus}）` : ""}`, ...(multLine ? [multLine] : [])]
    : [`倒在塔里，身上的 ${run.gold} 石和行囊里值 ${goodsValue} 石的东西都丢了`];
  return { renown, lines, carried, carriedLines, delivered: run.orders.filter((o) => o.done).map((o) => o.id) };
}

export const UPGRADED_NAME = (id: string, up: boolean) => CARDS[id].name + (up ? "+" : "");
