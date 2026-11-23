import { CARDS, type Ctx, type Preview, cardCost, cardExhausts, cardVals } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { GOODS } from "../data/goods";
import * as bag from "./bag";
import { addGood } from "./inventory";
import { type RngState, int, makeRng, shuffle } from "./rng";
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
  | { t: "thorns"; amount: number }
  | { t: "intent" }
  | { t: "fled" }
  | { t: "enemy-move"; name: string };

const HAND = 5;
/** True if you own the 法宝 or carry the gear with this id. */
export const has = (run: RunState, id: string) => run.relics.includes(id) || run.bag.items.some((it) => it.id === id);

/** Your deck for a fight: known cards plus the cards of every weapon in the bag. */
export function combatDeck(run: RunState): CardInst[] {
  const out = run.deck.map((c) => ({ ...c }));
  let uid = -1;
  for (const it of run.bag.items) for (const id of GOODS[it.id].cards ?? []) out.push({ uid: uid--, id, up: false, from: it.id });
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
  const c: CombatState = {
    kind, enemy, energy: 3, maxEnergy: 3, block: 0, status: {},
    draw: shuffle(r, combatDeck(run)), hand: [], discard: [], exhaust: [],
    turn: 0, attacksThisTurn: 0, cardsThisTurn: 0, dmgThisTurn: 0, goodsUsed: 0, stolen: [], harvest: 0, drawBonusNext: 0,
    over: null, rng: r, purseUsed: false, fullBlocks: 0, interrupts: 0, dark: run.oil <= 0,
  };
  run.combat = c;
  if (has(run, "mirror")) c.block += 6;
  if (has(run, "thorn")) c.status.thorns = (c.status.thorns ?? 0) + 2;
  if (has(run, "abacus")) { const s = Math.min(3, Math.floor(run.gold / 15)); if (s) c.status.str = s; }
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
export function enemyHitDamage(_run: RunState, c: CombatState, intent: Intent = c.enemy.intent): number {
  if (!intent.dmg) return 0;
  let dmg = intent.dmg + c.enemy.dmgAdd + (c.enemy.status.str ?? 0) + (c.dark ? 3 : 0);
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
function playerHit(c: CombatState, base: number, bonus: number): number {
  let dmg = base + bonus + (c.status.str ?? 0);
  if (c.status.weak) dmg = Math.floor(dmg * 0.75);
  if (c.enemy.status.vuln) dmg = Math.floor(dmg * 1.5);
  return Math.max(0, dmg);
}

function damageEnemy(_run: RunState, c: CombatState, dmg: number, events: CombatEvent[]): number {
  const e = c.enemy;
  const blocked = Math.min(e.block, dmg);
  e.block -= blocked;
  const taken = Math.min(e.hp, dmg - blocked);
  e.hp -= taken;
  c.dmgThisTurn += taken;
  const def = ENEMIES[e.id];
  let part: "broke" | undefined;
  if (def.part && e.partIntact && dmg - blocked >= def.part.threshold) { e.partIntact = false; part = "broke"; }
  events.push({ t: "hit", target: "enemy", amount: taken, blocked, part });
  if (e.hp <= 0) { c.over = "win"; return taken; }
  if (def.phase2 && e.phase === 1 && e.hp <= e.maxHp * def.phase2.at) {
    e.phase = 2;
    e.sprite = def.phase2.sprite;
    e.status.str = (e.status.str ?? 0) + def.phase2.str;
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
  bag.removeUid(run.bag, item.uid);
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

function makeCtx(run: RunState, c: CombatState, events: CombatEvent[], card: { first: boolean; isAttack: boolean }): Ctx {
  const ctx: Ctx = {
    lastConsumedPrice: 0,
    attack(n, hits = 1) {
      let total = 0;
      for (let h = 0; h < hits && !c.over; h++) {
        let bonus = 0;
        if (card.first) {
          card.first = false;
          if (c.status.focus) { bonus += c.status.focus; delete c.status.focus; }
          if (card.isAttack && c.attacksThisTurn === 0 && has(run, "sword")) bonus += 2;
        }
        total += damageEnemy(run, c, playerHit(c, n, bonus), events);
      }
      return total;
    },
    block(n) { if (n > 0) { c.block += n; events.push({ t: "block", target: "player", amount: n }); } },
    enemyStatus(id, n) { c.enemy.status[id] = (c.enemy.status[id] ?? 0) + n; events.push({ t: "status", target: "enemy", id, n }); },
    selfStatus(id, n) { c.status[id] = (c.status[id] ?? 0) + n; events.push({ t: "status", target: "player", id, n }); },
    draw(n) { drawCards(c, n); },
    energy(n) { c.energy += n; },
    heal(n) { const a = Math.min(n, run.maxHp - run.hp); run.hp += a; events.push({ t: "heal", amount: a }); },
    goods(id) { return bag.count(run.bag, id); },
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
    harvest() { c.harvest++; },
    drawNext(n) { c.drawBonusNext += n; },
  };
  return ctx;
}

export function previewFor(run: RunState, c: CombatState | null): Preview {
  return {
    inCombat: !!c,
    dmg: (n) => (c ? playerHit(c, n, c.status.focus ?? 0) : n),
    ash: bag.count(run.bag, "ash"),
    gold: run.gold,
    block: c?.block ?? 0,
    attacks: c?.attacksThisTurn ?? 0,
  };
}

/** Why a card in hand can't be played, or null. */
export function blockedReason(run: RunState, c: CombatState, card: CardInst): string | null {
  const def = CARDS[card.id];
  if (c.over) return "战斗已结束";
  if (cardCost(def, card.up) > c.energy) return "能量不够";
  const ctx = makeCtx(run, c, [], { first: true, isAttack: false });
  return def.needs?.(ctx, cardVals(def, card.up)) ?? null;
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
  const ctx = makeCtx(run, c, events, { first: true, isAttack });
  def.play(ctx, cardVals(def, card.up));
  c.cardsThisTurn++;
  if (isAttack) {
    if (c.attacksThisTurn === 0 && c.status.swordIntent && !c.over) { drawCards(c, c.status.swordIntent); c.energy += c.status.swordIntent; }
    c.attacksThisTurn++;
  }
  if (c.cardsThisTurn === 3 && has(run, "tassel") && !c.over) damageEnemy(run, c, playerHit(c, 6, 0), events);
  if (def.type === "power") { /* powers leave the deck for this fight */ }
  else if (cardExhausts(def, card.up)) c.exhaust.push(card);
  else c.discard.push(card);
  return { ok: true, events };
}

function startTurn(run: RunState, events: CombatEvent[]) {
  const c = run.combat!;
  c.turn++;
  run.stats.turns++;
  if (!c.status.barricade) c.block = has(run, "shield") ? Math.min(2, c.block) : 0;
  c.energy = c.maxEnergy + (c.turn === 1 && has(run, "bell") ? 1 : 0);
  c.attacksThisTurn = 0;
  c.cardsThisTurn = 0;
  c.dmgThisTurn = 0;
  delete c.status.ward;
  delete c.status.counter;
  drawCards(c, HAND + c.drawBonusNext + (c.turn === 1 && has(run, "silkfan") ? 2 : 0));
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
  tick(c.status);

  // Enemy turn.
  const e = c.enemy;
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
      if (i.steal && through > 0 && !c.over) steal(run, c, events);
    }
    if (i.apply && !c.over) { c.status[i.apply.status] = (c.status[i.apply.status] ?? 0) + i.apply.n; events.push({ t: "status", target: "player", id: i.apply.status, n: i.apply.n }); }
    if (i.charge) e.queued = i.charge.then;
  }
  tick(e.status);
  e.turn++;
  if (c.over) return events;
  chooseIntent(e, c.rng);
  events.push({ t: "intent" });
  startTurn(run, events);
  return events;
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
  bag.removeUid(run.bag, item.uid);
  c.stolen.push(item.id);
  events.push({ t: "steal", good: item.id, saved: false });
  // Thieves that keep what they grab try to run for it next turn.
  if (ENEMIES[c.enemy.id].stealFlees) c.enemy.queued = "flee";
}

/** Weak / vulnerable wear off by one at the end of the owner's turn. */
function tick(s: CombatState["status"]) {
  for (const k of ["weak", "vuln"] as const) if (s[k]) { s[k]! -= 1; if (!s[k]) delete s[k]; }
}

/** What the enemy is about to steal, for the intent label. */
export function stealTarget(run: RunState): GoodId | null {
  return bag.mostValuable(run.bag)?.id ?? null;
}
