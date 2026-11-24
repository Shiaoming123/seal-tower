import { CARDS, type Ctx, type Preview, cardCost, cardExhausts, cardVals } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { GOODS } from "../data/goods";
import * as bag from "./bag";
import { addGood } from "./inventory";
import { discover } from "./discover";
import { bump } from "./stats";
import { type RngState, chance, int, makeRng, shuffle } from "./rng";
import type { CardInst, CombatState, EnemyState, Entity, FightKind, GoodId, Intent, RunState, StatusId } from "./types";

export type CombatEvent =
  | { t: "hit"; target: "enemy" | "player"; amount: number; blocked: number; part?: "broke" }
  | { t: "block"; target: "enemy" | "player"; amount: number }
  | { t: "status"; target: "enemy" | "player"; id: StatusId; n: number }
  | { t: "steal"; good: GoodId | null; saved: boolean }
  | { t: "interrupt" }
  | { t: "stunned" }
  | { t: "phase"; text: string }
  | { t: "heal"; amount: number }
  | { t: "goods"; good: GoodId; gained: boolean }
  | { t: "crack"; good: GoodId; into: GoodId }
  | { t: "thorns"; amount: number; target?: "player" }
  | { t: "intent" }
  | { t: "fled" }
  | { t: "drain"; what: "oil" | "ash" | "gold"; amount: number }
  | { t: "enemy-move"; name: string }
  /** A passive set off by what you played (行云, 剑谱残页): said out loud so it doesn't happen unnoticed. */
  | { t: "proc"; text: string };

const HAND = 5;
/** From this turn on the monster gains 2 strength each turn (妖气渐盛). */
export const RAMP_TURN = 8;
/** True if you own the 法宝 or carry the gear with this id. */
export const has = (run: RunState, id: string) => run.relics.includes(id) || run.bag.items.some((it) => it.id === id || GOODS[it.id].base === id);

/** Your deck for a fight: known cards plus the cards of every weapon in the bag. */
export function combatDeck(run: RunState): CardInst[] {
  const out = run.deck.map((c) => ({ ...c }));
  let uid = -1;
  for (const it of run.bag.items) {
    const cards = GOODS[it.id].cards;
    if (!cards) continue;
    const g = GOODS[it.id];
    const dmg = bag.auraOn(run.bag, it, "dmg") + (g.selfBonus?.dmg ?? 0), blk = bag.auraOn(run.bag, it, "blk") + (g.selfBonus?.blk ?? 0);
    const bonus = dmg || blk ? { dmg, blk } : undefined;
    for (const id of cards) out.push({ uid: uid--, id, up: !!g.cardsUp, from: it.id, bonus });
  }
  return out;
}

export function makeEnemy(id: string, hpMul: number, dmgAdd: number, difficulty: number, r: RngState): EnemyState {
  const def = ENEMIES[id];
  const hp = Math.round(int(r, def.hp[0], def.hp[1]) * hpMul * (1 + 0.1 * difficulty));
  const e: EnemyState = {
    id, name: def.name, sprite: def.sprite, hp, maxHp: hp, block: 0, status: {}, turn: 0, phase: 1,
    dmgAdd: dmgAdd + Math.floor(difficulty / 2), partIntact: def.part ? true : null, queued: null, history: [],
    intent: { key: "", name: "" },
  };
  return e;
}

export function startCombat(run: RunState, entity: Entity, kind: FightKind): CombatState {
  const r = makeRng((run.seed ^ (entity.id * 2654435761) ^ (run.floor * 97)) >>> 0);
  const enemy = makeEnemy(entity.enemy!, entity.hpMul ?? 1, entity.dmgAdd ?? 0, run.difficulty, r);
  if (ENEMIES[enemy.id].thorns) enemy.status.thorns = ENEMIES[enemy.id].thorns;
  discover(run, "e:" + enemy.id);
  // 签文 that touch fights.
  const hpUp = (run.omen === "horde" && kind === "fight" ? 1.15 : 1) * (run.omen === "patrol" && kind === "elite" ? 1.15 : 1);
  if (hpUp > 1) { enemy.hp = enemy.maxHp = Math.round(enemy.maxHp * hpUp); }
  enemy.dmgAdd += (run.omen === "bloodmoon" ? 1 : 0) + (run.omen === "moon" && kind === "fight" ? 1 : 0);
  const c: CombatState = {
    kind, enemy, energy: 3, maxEnergy: 3, block: 0, status: {},
    draw: shuffle(r, combatDeck(run)), hand: [], discard: [], exhaust: [],
    turn: 0, attacksThisTurn: 0, cardsThisTurn: 0, dmgThisTurn: 0, goodsUsed: 0, stolen: [], harvest: 0, drawBonusNext: 0,
    over: null, rng: r, purseUsed: false, fullBlocks: 0, interrupts: 0, dark: run.oil <= 0,
    oilDrained: 0, ashEaten: 0, goldStolen: 0, blinded: 0, guardHits: 0, lastHit: 0, lastTags: [], oil: run.oil,
  };
  run.combat = c;
  if (has(run, "mirror")) c.block += 6;
  if (bag.tagLevel(run.bag, "guard") >= 1) c.block += 4;
  if (bag.tagLevel(run.bag, "coin") >= 2) { run.gold += 5; run.stats.goldEarned += 5; }
  if (bag.tagLevel(run.bag, "lamp") >= 2) enemy.status.burn = (enemy.status.burn ?? 0) + 3;
  if (has(run, "thorn")) c.status.thorns = (c.status.thorns ?? 0) + 2;
  if (has(run, "abacus")) { const s = Math.min(3, Math.floor(run.gold / 15)); if (s) c.status.str = s; }
  if (has(run, "treasurebag")) { const s = Math.min(3, Math.floor(bag.count(run.bag) / 4)); if (s) c.status.str = (c.status.str ?? 0) + s; }
  chooseIntent(enemy, r);
  startTurn(run, []);
  return c;
}

function chooseIntent(e: EnemyState, r: RngState) {
  const def = ENEMIES[e.id];
  let key: string;
  if (e.queued) { key = e.queued; e.queued = null; }
  else key = (e.phase === 2 && def.phase2 ? def.phase2.ai : def.ai)(e, r);
  e.history.push(key);
  const m = def.moves[key];
  e.intent = { key, ...m, apply: m.apply ? { ...m.apply } : undefined };
}

/** Damage an enemy intent would deal per hit to the player right now. */
export function enemyHitDamage(run: RunState, c: CombatState, intent: Intent = c.enemy.intent): number {
  if (!intent.dmg) return 0;
  const mod = ENEMIES[c.enemy.id].dmgMod?.(run.oil) ?? 0;
  let dmg = intent.dmg + c.enemy.dmgAdd + (c.enemy.status.str ?? 0) + (c.dark ? 3 : 0) + mod;
  if (c.enemy.status.weak) dmg = Math.floor(dmg * 0.75);
  if (c.status.vuln) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

export function incomingDamage(run: RunState, c: CombatState): number {
  const i = c.enemy.intent;
  if (i.stunned || !i.dmg) return 0;
  return enemyHitDamage(run, c) * (i.hits ?? 1);
}

/** Damage shown on cards and dealt by the player's attacks (before block). */
function playerHit(c: CombatState, base: number, bonus: number, tags: readonly string[] = []): number {
  let dmg = base + bonus + (c.status.str ?? 0);
  if (c.status.weak) dmg = Math.floor(dmg * 0.75);
  if (c.enemy.status.vuln) dmg = Math.floor(dmg * 1.5);
  const def = ENEMIES[c.enemy.id];
  if (def.weakTo && tags.includes(def.weakTo)) dmg *= 2;
  if (c.enemy.intent.dive) dmg = Math.floor(dmg / 2);
  if (def.maxHit) dmg = Math.min(def.maxHit, dmg);
  return Math.max(0, dmg);
}

function damageEnemy(run: RunState, c: CombatState, dmg: number, events: CombatEvent[], card?: { tags: readonly string[] }): number {
  const e = c.enemy;
  if (card) { c.lastHit = dmg; c.lastTags = [...card.tags]; }
  const blocked = Math.min(e.block, dmg);
  e.block -= blocked;
  const taken = Math.min(e.hp, dmg - blocked);
  e.hp -= taken;
  // Charge interrupts count the whole blow, block included: 「打出 20 点」 means 20 dealt, not 20 HP lost
  // (REVIEW-001: 负钟君 shells up right before charging, so HP-only needed nearly twice the number shown).
  c.dmgThisTurn += taken + blocked;
  const def = ENEMIES[e.id];
  let part: "broke" | undefined;
  if (def.part && e.partIntact && dmg - blocked >= def.part.threshold) { e.partIntact = false; part = "broke"; }
  events.push({ t: "hit", target: "enemy", amount: taken, blocked, part });
  if (e.hp <= 0) { c.over = "win"; return taken; }
  // Thorns and counter stances hurt whoever lands a blow with a card.
  // The counter stance is the enemy's shown intent, so it is active during your turn.
  const stance = e.intent.stunned ? 0 : e.intent.counter ?? 0;
  const spikes = card ? (e.status.thorns ?? 0) + stance : 0;
  if (spikes) {
    if (stance) c.guardHits++;
    events.push({ t: "thorns", amount: spikes, target: "player" });
    damagePlayer(run, c, spikes, events);
    if (c.over) return taken;
  }
  if (def.phase2 && e.phase === 1 && e.hp <= e.maxHp * def.phase2.at) {
    e.phase = 2;
    e.sprite = def.phase2.sprite;
    e.status.str = (e.status.str ?? 0) + def.phase2.str;
    if (def.phase2.heal) e.hp = Math.min(e.maxHp, e.hp + def.phase2.heal);
    if (def.phase2.block) e.block += def.phase2.block;
    e.queued = null;
    e.intent = { key: "", name: "" };
    chooseIntent(e, c.rng);
    events.push({ t: "phase", text: def.phase2.text });
  }
  return taken;
}

function damagePlayer(run: RunState, c: CombatState, dmg: number, events: CombatEvent[]): number {
  const blocked = Math.min(c.block, dmg);
  c.block -= blocked;
  const taken = Math.min(run.hp, dmg - blocked);
  run.hp -= taken;
  run.stats.damageTaken += taken;
  events.push({ t: "hit", target: "player", amount: taken, blocked });
  if (run.hp <= 0) c.over = "lose";
  return taken;
}

function consumeGood(run: RunState, c: CombatState, which: GoodId | "cheapest", events: CombatEvent[]): GoodId | null {
  const item = which === "cheapest" ? bag.cheapest(run.bag) : run.bag.items.slice().reverse().find((it) => it.id === which) ?? null;
  if (!item) return null;
  bag.takeOne(run.bag, item);
  c.goodsUsed++;
  run.stats.goodsUsed++;
  events.push({ t: "goods", good: item.id, gained: false });
  if (has(run, "seal")) drawCards(c, 1);
  return item.id;
}

function drawCards(c: CombatState, n: number) {
  for (let i = 0; i < n; i++) {
    if (c.hand.length >= 10) return;
    if (!c.draw.length) {
      if (!c.discard.length) return;
      c.draw = shuffle(c.rng, c.discard);
      c.discard = [];
    }
    c.hand.push(c.draw.pop()!);
  }
}

function makeCtx(run: RunState, c: CombatState, events: CombatEvent[], card: { first: boolean; isAttack: boolean; tags?: readonly string[] }): Ctx {
  const blade = bag.tagLevel(run.bag, "blade");
  const ctx: Ctx = {
    lastConsumedPrice: 0,
    attack(n, hits = 1) {
      let total = 0;
      for (let h = 0; h < hits && !c.over; h++) {
        // 刃 set: +1 to every hit; at 4 blades the first attack each turn hits 3 harder.
        let bonus = blade >= 1 ? 1 : 0;
        if (card.first) {
          card.first = false;
          if (c.status.focus) { bonus += c.status.focus; delete c.status.focus; }
          if (card.isAttack && c.attacksThisTurn === 0 && has(run, "sword")) bonus += 2;
          if (card.isAttack && c.attacksThisTurn === 0 && blade >= 2) bonus += 3;
        }
        total += damageEnemy(run, c, playerHit(c, n, bonus, card.tags), events, { tags: card.tags ?? [] });
      }
      return total;
    },
    block(n) { if (n > 0) { n += c.status.ironshirt ?? 0; c.block += n; events.push({ t: "block", target: "player", amount: n }); } },
    enemyBurn: () => c.enemy.status.burn ?? 0,
    gainGold(n) { run.gold += n; run.stats.goldEarned += n; },
    enemyStatus(id, n) { c.enemy.status[id] = (c.enemy.status[id] ?? 0) + n; events.push({ t: "status", target: "enemy", id, n }); },
    selfStatus(id, n) { c.status[id] = (c.status[id] ?? 0) + n; events.push({ t: "status", target: "player", id, n }); },
    draw(n) { drawCards(c, n); },
    energy(n) { c.energy += n; },
    heal(n) { const a = Math.min(n, run.maxHp - run.hp); run.hp += a; events.push({ t: "heal", amount: a }); },
    goods(id) { return bag.count(run.bag, id) + (id === "ash" ? bag.ashBonus(run.bag) : 0); },
    consume(which, n = 1) {
      const out: GoodId[] = [];
      for (let i = 0; i < n; i++) { const g = consumeGood(run, c, which, events); if (g) { out.push(g); ctx.lastConsumedPrice = GOODS[g].price; } }
      return out;
    },
    gainGood(id) { addGood(run, id); events.push({ t: "goods", good: id, gained: true }); },
    gold: () => run.gold,
    spendGold(n) { if (run.gold < n) return false; run.gold -= n; return true; },
    currentBlock: () => c.block,
    enemyAttacking: () => !!c.enemy.intent.dmg && !c.enemy.intent.stunned,
    attacksThisTurn: () => c.attacksThisTurn,
    interrupt() {
      const i = c.enemy.intent;
      if (!i.charge) return false;
      c.enemy.intent = { key: "stunned", name: "被打断", stunned: true, text: "蓄力被打断，这回合什么也做不了。" };
      c.interrupts++;
      events.push({ t: "interrupt" });
      return true;
    },
    harvest() { if (!c.plucked) { c.harvest++; c.plucked = true; } }, // 挑材 counts once per fight (REVIEW-001)
    drawNext(n) { c.drawBonusNext += n; },
  };
  return ctx;
}

export function previewFor(run: RunState, c: CombatState | null): Preview {
  return {
    inCombat: !!c,
    dmg: (n) => (c ? playerHit(c, n, (c.status.focus ?? 0) + (bag.tagLevel(run.bag, "blade") >= 1 ? 1 : 0)) : n),
    // note: fire weakness / dive / caps are applied in the shared formula above
    ash: bag.count(run.bag, "ash") + bag.ashBonus(run.bag),
    gold: run.gold,
    block: c?.block ?? 0,
    attacks: c?.attacksThisTurn ?? 0,
    burn: c?.enemy.status.burn ?? 0,
    goods: bag.count(run.bag),
  };
}

/** What playing a card right now would do, for the preview over the monster before you commit. */
export interface PlayPreview {
  dmg: number; hits: number; absorbed: number; block: number; heal: number;
  kills: boolean; interrupts: boolean; breaksPart: boolean;
  enemyStatus: { id: StatusId; n: number }[]; tags: readonly string[]; weakness: boolean;
}

/**
 * Plays the card on a copy of the run and reads off what happened, so the preview matches the real outcome
 * exactly: focus, sets, weak / vulnerable, fire weakness, multi-hit and the monster's block are all counted.
 * Null if the card can't be played now.
 */
export function simulatePlay(run: RunState, handIndex: number): PlayPreview | null {
  const c = run.combat;
  if (!c || c.over || !c.hand[handIndex] || blockedReason(run, c, c.hand[handIndex])) return null;
  const copy = structuredClone(run);
  const res = playCard(copy, handIndex);
  if (!res.ok) return null;
  const def = CARDS[c.hand[handIndex].id];
  const out: PlayPreview = { dmg: 0, hits: 0, absorbed: 0, block: 0, heal: 0, kills: copy.combat?.over === "win", interrupts: false, breaksPart: false,
    enemyStatus: [], tags: def.tags ?? [], weakness: !!ENEMIES[c.enemy.id].weakTo && !!def.tags?.some((t) => t === ENEMIES[c.enemy.id].weakTo) };
  for (const e of res.events) {
    if (e.t === "hit" && e.target === "enemy") { out.dmg += e.amount; out.absorbed += e.blocked; out.hits++; if (e.part === "broke") out.breaksPart = true; }
    else if (e.t === "block" && e.target === "player") out.block += e.amount;
    else if (e.t === "heal") out.heal += e.amount;
    else if (e.t === "interrupt") out.interrupts = true;
    else if (e.t === "status" && e.target === "enemy") out.enemyStatus.push({ id: e.id, n: e.n });
  }
  return out;
}

/** Why a card in hand can't be played, or null. */
export function blockedReason(run: RunState, c: CombatState, card: CardInst): string | null {
  const def = CARDS[card.id];
  if (c.over) return "战斗已结束";
  if (cardCost(def, card.up) > c.energy) return "能量不够";
  const ctx = makeCtx(run, c, [], { first: true, isAttack: false });
  return def.needs?.(ctx, cardVals(def, card.up, card.bonus)) ?? null;
}

export function playCard(run: RunState, handIndex: number): { ok: boolean; reason?: string; events: CombatEvent[] } {
  const c = run.combat!;
  const card = c.hand[handIndex];
  if (!card) return { ok: false, reason: "没有这张牌", events: [] };
  const reason = blockedReason(run, c, card);
  if (reason) return { ok: false, reason, events: [] };
  const def = CARDS[card.id];
  const events: CombatEvent[] = [];
  c.energy -= cardCost(def, card.up);
  c.hand.splice(handIndex, 1);
  const isAttack = def.type === "attack";
  const ctx = makeCtx(run, c, events, { first: true, isAttack, tags: def.tags ?? [] });
  def.play(ctx, cardVals(def, card.up, card.bonus));
  c.cardsThisTurn++;
  if (isAttack) {
    if (c.attacksThisTurn === 0 && c.status.swordIntent && !c.over) {
      drawCards(c, c.status.swordIntent); c.energy += c.status.swordIntent;
      events.push({ t: "proc", text: `行云：抽 ${c.status.swordIntent} · 能量 +${c.status.swordIntent}` });
    }
    c.attacksThisTurn++;
    if (c.status.swordQi && !c.over) damageEnemy(run, c, c.status.swordQi, events);
    if (c.attacksThisTurn === 4 && has(run, "swordmanual")) { c.energy += 2; events.push({ t: "proc", text: "剑谱残页：能量 +2" }); }

  }

  // 镇妖剑穗 (REVIEW-001: 6 → 4 damage; still any third card, so block-heavy decks keep a use for it).
  if (c.cardsThisTurn === 3 && has(run, "tassel") && !c.over) { events.push({ t: "proc", text: "镇妖剑穗：+4 伤害" }); damageEnemy(run, c, playerHit(c, 4, 0), events); }
  if (def.type === "power") { /* powers leave the deck for this fight */ }
  else if (cardExhausts(def, card.up)) c.exhaust.push(card);
  else c.discard.push(card);
  return { ok: true, events };
}

function startTurn(run: RunState, events: CombatEvent[]) {
  const c = run.combat!;
  c.turn++;
  run.stats.turns++;
  // Block you keep between turns: 木挡板 keeps 4, refined 2 more, a full 盾 set 3 more.
  // (木挡板 was 2: the starter meant for new players won 23% of sims, the others 38–41%; GAME-010.)
  const keep = (has(run, "shield") ? 4 : 0) + (has(run, "shield-fine") ? 2 : 0) + (bag.tagLevel(run.bag, "guard") >= 2 ? 3 : 0);
  // (Not on turn 1: block granted at the start of a fight — 护心镜, the 盾 set — must survive into it.)
  if (!c.status.barricade && c.turn > 1) c.block = Math.min(keep, c.block);
  c.energy = c.maxEnergy + (c.turn === 1 && has(run, "bell") ? 1 : 0);
  c.attacksThisTurn = 0;
  c.cardsThisTurn = 0;
  c.dmgThisTurn = 0;
  // 妖气渐盛: from turn 8 the monster gains 2 strength a turn, so a fight can't be stalled to farm coin (REVIEW-001).
  if (c.turn >= RAMP_TURN) {
    c.enemy.status.str = (c.enemy.status.str ?? 0) + 2;
    events.push({ t: "phase", text: c.turn === RAMP_TURN ? `妖气渐盛：${c.enemy.name}每回合力量 +2` : `妖气渐盛（力量 ${c.enemy.status.str}）` });
  }
  delete c.status.ward;
  delete c.status.counter;
  const blind = c.status.blind ? 1 : 0;
  if (c.status.blind) { c.status.blind -= 1; if (!c.status.blind) delete c.status.blind; }
  drawCards(c, HAND - blind + c.drawBonusNext + (c.turn === 1 && has(run, "silkfan") ? 2 : 0));
  c.drawBonusNext = 0;
  if (c.status.interest) { run.gold += c.status.interest; run.stats.goldEarned += c.status.interest; }
  if (c.status.bulwark) { c.block += c.status.bulwark; events.push({ t: "block", target: "player", amount: c.status.bulwark }); }
  if (c.status.lampArray && bag.count(run.bag, "ash") > 0) {
    consumeGood(run, c, "ash", events);
    damageEnemy(run, c, c.status.lampArray, events);
    c.block += c.status.lampArray;
    events.push({ t: "block", target: "player", amount: c.status.lampArray });
  }
}

/** End the player's turn, let the enemy act, start the next turn. */
export function endTurn(run: RunState): CombatEvent[] {
  const c = run.combat!;
  const events: CombatEvent[] = [];
  if (c.over) return events;
  // End of player turn.
  c.discard.push(...c.hand);
  c.hand = [];
  if (has(run, "knotcharm") && c.block === 0) { const a = Math.min(2, run.maxHp - run.hp); run.hp += a; if (a) events.push({ t: "heal", amount: a }); }
  // Your 虚弱 wears off now (it weakened this turn's attacks). Your 破绽 waits until after the monster has hit you:
  // it used to tick here too, so 1 turn of 破绽 never did anything while the intent showed ×1.5 (REVIEW-001).
  tick(c.status, ["weak"]);
  const vulnBefore = c.status.vuln ?? 0;

  // Burn ticks before the enemy acts and ignores block.
  const e = c.enemy;
  if (e.status.burn) {
    const dmg = Math.min(e.hp, e.status.burn + (has(run, "wickcutter") ? 2 : 0) + (bag.tagLevel(run.bag, "lamp") >= 1 ? 2 : 0));
    e.hp -= dmg;
    events.push({ t: "hit", target: "enemy", amount: dmg, blocked: 0 });
    events.push({ t: "status", target: "enemy", id: "burn", n: -1 });
    e.status.burn -= 1;
    if (!e.status.burn) delete e.status.burn;
    if (e.hp <= 0) { c.over = "win"; return events; }
  }

  // Enemy turn.
  e.block = 0;
  const i = e.intent;
  events.push({ t: "enemy-move", name: i.name });
  if (i.stunned) {
    events.push({ t: "stunned" });
  } else if (i.flee) {
    c.over = "fled";
    events.push({ t: "fled" });
    return events;
  } else if (i.charge && c.dmgThisTurn >= i.charge.threshold) {
    e.intent = { key: "stunned", name: "被打断", stunned: true };
    c.interrupts++;
    events.push({ t: "interrupt" });
  } else {
    if (i.block) { e.block += i.block; events.push({ t: "block", target: "enemy", amount: i.block }); }
    if (i.str) { e.status.str = (e.status.str ?? 0) + i.str; events.push({ t: "status", target: "enemy", id: "str", n: i.str }); }
    if (i.thorns) { e.status.thorns = (e.status.thorns ?? 0) + i.thorns; events.push({ t: "status", target: "enemy", id: "thorns", n: i.thorns }); }
    if (i.dmg) {
      let through = 0;
      for (let h = 0; h < (i.hits ?? 1) && !c.over; h++) {
        through += damagePlayer(run, c, enemyHitDamage(run, c, i), events);
        const back = (c.status.thorns ?? 0) + (c.status.counter ?? 0);
        if (back && !c.over) {
          events.push({ t: "thorns", amount: back });
          damageEnemy(run, c, back, events);
        }
      }
      if (through === 0 && !c.over) c.fullBlocks++;
      if (through > 0 && !c.over) drain(run, c, i, events);
      if (i.steal && through > 0 && !c.over) steal(run, c, events);
      if (through > 0 && !c.over) crack(run, c, events);
    }
    if (i.apply && !c.over) {
      c.status[i.apply.status] = (c.status[i.apply.status] ?? 0) + i.apply.n;
      if (i.apply.status === "blind") c.blinded++;
      events.push({ t: "status", target: "player", id: i.apply.status, n: i.apply.n });
    }
    if (i.charge) e.queued = i.charge.then;
  }
  tick(e.status);
  // Only 破绽 you already had wears off; a fresh one from this very turn lasts into the monster's next hit.
  if (vulnBefore && c.status.vuln) { c.status.vuln -= 1; if (!c.status.vuln) delete c.status.vuln; }
  e.turn++;
  if (c.over) return events;
  chooseIntent(e, c.rng);
  events.push({ t: "intent" });
  startTurn(run, events);
  return events;
}

/**
 * Fragile goods (完整狐扣, 水珠) may crack when a hit gets through: each one has a 25% chance, unless it
 * sits next to a 镇货符 or you played 护货 this turn. Cracked goods keep their place in the bag.
 */
export const CRACK_CHANCE = 0.25;
function crack(run: RunState, c: CombatState, events: CombatEvent[]) {
  if (c.status.ward) return;
  for (const it of [...run.bag.items]) {
    const into = GOODS[it.id].fragile;
    if (!into || bag.auraOn(run.bag, it, "ward") || !chance(c.rng, CRACK_CHANCE)) continue;
    events.push({ t: "crack", good: it.id, into });
    bump(run, "cracks");
    // One of a stack cracks and comes off it; a single good cracks in place.
    if (bag.qty(it) > 1) { it.n = bag.qty(it) - 1; addGood(run, into); }
    else it.id = into;
    discover(run, "g:" + into);
  }
  // The side pouch keeps things from thieves, not from knocks (REVIEW-001).
  run.pouch.forEach((id, i) => {
    const into = GOODS[id].fragile;
    if (!into || !chance(c.rng, CRACK_CHANCE)) return;
    events.push({ t: "crack", good: id, into });
    bump(run, "cracks");
    run.pouch[i] = into;
    discover(run, "g:" + into);
  });
}

/** Oil, ash and coin thieves take their cut when an attack gets through. */
function drain(run: RunState, c: CombatState, i: Intent, events: CombatEvent[]) {
  if (i.drainOil) {
    const a = Math.min(i.drainOil, run.oil);
    run.oil -= a; c.oilDrained += a; c.oil = run.oil;
    if (a) events.push({ t: "drain", what: "oil", amount: a });
  }
  if (i.eatAsh) {
    let n = 0;
    for (; n < i.eatAsh && bag.removeOne(run.bag, "ash"); n++);
    c.ashEaten += n;
    if (n) events.push({ t: "drain", what: "ash", amount: n });
  }
  if (i.stealGold) {
    const a = Math.min(i.stealGold, run.gold);
    run.gold -= a; c.goldStolen += a;
    if (a) events.push({ t: "drain", what: "gold", amount: a });
  }
}

function steal(run: RunState, c: CombatState, events: CombatEvent[]) {
  if (c.status.ward) { events.push({ t: "steal", good: null, saved: true }); return; }
  const item = bag.mostValuable(run.bag);
  if (!item) { events.push({ t: "steal", good: null, saved: false }); return; }
  if (has(run, "sealbag") && !c.purseUsed) {
    c.purseUsed = true;
    events.push({ t: "steal", good: item.id, saved: true });
    return;
  }
  bag.takeOne(run.bag, item); // a thief grabs one off a stack
  c.stolen.push(item.id);
  events.push({ t: "steal", good: item.id, saved: false });
  // Thieves that keep what they grab try to run for it next turn.
  if (ENEMIES[c.enemy.id].stealFlees) c.enemy.queued = "flee";
}

/** Weak / vulnerable wear off by one: the monster's at the end of its turn; yours as noted in endTurn. */
function tick(s: CombatState["status"], keys: ("weak" | "vuln")[] = ["weak", "vuln"]) {
  for (const k of keys) if (s[k]) { s[k]! -= 1; if (!s[k]) delete s[k]; }
}

/** What the enemy is about to steal, for the intent label. */
export function stealTarget(run: RunState): GoodId | null {
  return bag.mostValuable(run.bag)?.id ?? null;
}
