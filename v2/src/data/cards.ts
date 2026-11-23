import type { GoodId, StatusId, WeaponId } from "../game/types";

/** What a card is allowed to do during combat. Implemented in game/combat.ts. */
export interface Ctx {
  attack(n: number, hits?: number): number;
  block(n: number): void;
  enemyStatus(id: StatusId, n: number): void;
  selfStatus(id: StatusId, n: number): void;
  draw(n: number): void;
  energy(n: number): void;
  heal(n: number): void;
  goods(id?: GoodId): number;
  consume(id: GoodId | "cheapest", n?: number): GoodId[];
  gainGood(id: GoodId): void;
  gold(): number;
  spendGold(n: number): boolean;
  currentBlock(): number;
  enemyAttacking(): boolean;
  attacksThisTurn(): number;
  interrupt(): boolean;
  harvest(): void;
  drawNext(n: number): void;
  enemyBurn(): number;
  gainGold(n: number): void;
  lastConsumedPrice: number;
}

/** Live numbers for card text (strength, weak, vulnerable…). */
export interface Preview {
  dmg(n: number): number;
  ash: number;
  gold: number;
  block: number;
  attacks: number;
  inCombat: boolean;
  burn: number;
  goods: number;
}

type Vals = Record<string, number>;
export type Pool = "neutral" | WeaponId;
export type Rarity = "basic" | "common" | "uncommon" | "rare";

export interface CardDef {
  id: string;
  name: string;
  cost: number | [number, number];
  type: "attack" | "skill" | "power";
  rarity: Rarity;
  pool: Pool;
  exhaust?: boolean | [boolean, boolean];
  v: [Vals, Vals];
  text: (v: Vals, p: Preview) => string;
  play: (c: Ctx, v: Vals) => void;
  /** Return a reason the card can't be played right now, or null. */
  needs?: (c: Ctx, v: Vals) => string | null;
  /** Tags used by AI / UI: uses goods, can interrupt, etc. */
  tags?: ("goods" | "heavy" | "multi" | "money" | "interrupt" | "fire")[];
}

const d = (p: Preview, n: number) => (p.inCombat ? `${p.dmg(n)}` : `${n}`);
const needAsh = (c: Ctx, v: Vals) => (c.goods("ash") < (v.ash ?? 1) ? `需要 ${v.ash ?? 1} 份灯灰` : null);

const list: CardDef[] = [
  // ---------- basics ----------
  { id: "strike", name: "斩", cost: 1, type: "attack", rarity: "basic", pool: "neutral", v: [{ dmg: 6 }, { dmg: 9 }],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害。`, play: (c, v) => { c.attack(v.dmg); } },
  { id: "defend", name: "架", cost: 1, type: "skill", rarity: "basic", pool: "neutral", v: [{ blk: 5 }, { blk: 8 }],
    text: (v) => `获得 ${v.blk} 格挡。`, play: (c, v) => c.block(v.blk) },

  // ---------- 照影剑 ----------
  { id: "unison", name: "合锋", cost: 1, type: "attack", rarity: "basic", pool: "sword", v: [{ dmg: 6, per: 3 }, { dmg: 8, per: 4 }],
    text: (v, p) => `造成 ${d(p, v.dmg + v.per * p.attacks)} 伤害。本回合每打出过一张攻击牌，伤害 +${v.per}。`,
    play: (c, v) => { c.attack(v.dmg + v.per * c.attacksThisTurn()); } },
  { id: "twin", name: "连斩", cost: 1, type: "attack", rarity: "common", pool: "sword", v: [{ dmg: 4 }, { dmg: 5 }], tags: ["multi"],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害 2 次。`, play: (c, v) => { c.attack(v.dmg, 2); } },
  { id: "riposte", name: "回锋", cost: 0, type: "attack", rarity: "common", pool: "sword", v: [{ dmg: 3 }, { dmg: 5 }],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害，抽 1 张牌。`, play: (c, v) => { c.attack(v.dmg); c.draw(1); } },
  { id: "gap", name: "见缝", cost: 1, type: "attack", rarity: "common", pool: "sword", v: [{ dmg: 6, bonus: 6 }, { dmg: 8, bonus: 8 }],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害。敌人这回合要攻击时，再造成 ${d(p, v.bonus)} 伤害。`,
    play: (c, v) => { c.attack(v.dmg); if (c.enemyAttacking()) c.attack(v.bonus); } },
  { id: "breach", name: "破势", cost: 2, type: "attack", rarity: "common", pool: "sword", v: [{ dmg: 11, vuln: 2 }, { dmg: 15, vuln: 3 }], tags: ["heavy"],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害，施加 ${v.vuln} 层破绽。`, play: (c, v) => { c.attack(v.dmg); c.enemyStatus("vuln", v.vuln); } },
  { id: "gather", name: "蓄势", cost: 1, type: "skill", rarity: "common", pool: "sword", v: [{ focus: 7, blk: 3 }, { focus: 10, blk: 5 }],
    text: (v) => `获得 ${v.blk} 格挡。下一张攻击牌伤害 +${v.focus}。`, play: (c, v) => { c.block(v.blk); c.selfStatus("focus", v.focus); } },
  { id: "flurry", name: "三连刺", cost: 2, type: "attack", rarity: "uncommon", pool: "sword", v: [{ dmg: 3 }, { dmg: 4 }], tags: ["multi"],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害 4 次。`, play: (c, v) => { c.attack(v.dmg, 4); } },
  { id: "intent", name: "剑意", cost: 1, type: "power", rarity: "uncommon", pool: "sword", v: [{ str: 2 }, { str: 3 }],
    text: (v) => `获得 ${v.str} 点力量（每次伤害 +${v.str}）。`, play: (c, v) => c.selfStatus("str", v.str) },
  { id: "cleave", name: "斩铁", cost: 3, type: "attack", rarity: "rare", pool: "sword", v: [{ dmg: 24 }, { dmg: 32 }], tags: ["heavy", "interrupt"],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害。`, play: (c, v) => { c.attack(v.dmg); } },
  { id: "flow", name: "行云", cost: [2, 1], type: "power", rarity: "rare", pool: "sword", v: [{}, {}],
    text: () => `每回合打出第一张攻击牌后，抽 1 张牌并获得 1 点能量。`, play: (c) => c.selfStatus("swordIntent", 1) },

  // ---------- 玄甲盾 ----------
  { id: "bash", name: "盾击", cost: 1, type: "attack", rarity: "basic", pool: "shield", v: [{ plus: 0 }, { plus: 4 }],
    text: (v, p) => `造成等同当前格挡${v.plus ? ` +${v.plus}` : ""} 的伤害${p.inCombat ? `（现在是 ${p.dmg(p.block + v.plus)}）` : ""}。`,
    play: (c, v) => { c.attack(c.currentBlock() + v.plus); } },
  { id: "wall", name: "铁壁", cost: 2, type: "skill", rarity: "common", pool: "shield", v: [{ blk: 12 }, { blk: 16 }],
    text: (v) => `获得 ${v.blk} 格挡。`, play: (c, v) => c.block(v.blk) },
  { id: "spikes", name: "反震", cost: 1, type: "skill", rarity: "common", pool: "shield", v: [{ blk: 4, th: 3 }, { blk: 6, th: 5 }],
    text: (v) => `获得 ${v.blk} 格挡。直到你的下回合，每被打一下，回敬 ${v.th} 伤害。`, play: (c, v) => { c.block(v.blk); c.selfStatus("counter", v.th); } },
  { id: "center", name: "守中", cost: 0, type: "skill", rarity: "common", pool: "shield", v: [{ blk: 3 }, { blk: 5 }],
    text: (v) => `获得 ${v.blk} 格挡，抽 1 张牌。`, play: (c, v) => { c.block(v.blk); c.draw(1); } },
  { id: "guardgoods", name: "护货", cost: 1, type: "skill", rarity: "common", pool: "shield", v: [{ blk: 7 }, { blk: 10 }],
    text: (v) => `获得 ${v.blk} 格挡。本回合行囊里的货不会被抢。`, play: (c, v) => { c.block(v.blk); c.selfStatus("ward", 1); } },
  { id: "ram", name: "顶盾", cost: 2, type: "attack", rarity: "uncommon", pool: "shield", v: [{ dmg: 9, blk: 9 }, { dmg: 12, blk: 12 }],
    text: (v, p) => `获得 ${v.blk} 格挡，造成 ${d(p, v.dmg)} 伤害。`, play: (c, v) => { c.block(v.blk); c.attack(v.dmg); } },
  { id: "rooted", name: "不动", cost: [3, 2], type: "power", rarity: "rare", pool: "shield", v: [{}, {}],
    text: () => `回合结束时不再清空格挡。`, play: (c) => c.selfStatus("barricade", 1) },
  { id: "bulwark", name: "以守为攻", cost: 1, type: "power", rarity: "uncommon", pool: "shield", v: [{ th: 2 }, { th: 3 }],
    text: (v) => `获得 ${v.th} 层反震。每回合开始获得 3 格挡。`, play: (c, v) => { c.selfStatus("thorns", v.th); c.selfStatus("bulwark", 3); } },

  // ---------- 引灯盘 ----------
  { id: "dust", name: "扬灰", cost: 0, type: "attack", rarity: "basic", pool: "lamp", v: [{ dmg: 8, ash: 1 }, { dmg: 11, ash: 1 }], tags: ["goods", "fire"],
    text: (v, p) => `烧掉 1 份灯灰：造成 ${d(p, v.dmg)} 伤害，施加 1 层虚弱。`, needs: needAsh,
    play: (c, v) => { c.consume("ash"); c.attack(v.dmg); c.enemyStatus("weak", 1); } },
  { id: "reveal", name: "照妖", cost: 1, type: "skill", rarity: "common", pool: "lamp", v: [{ vuln: 2 }, { vuln: 3 }],
    text: (v) => `施加 ${v.vuln} 层破绽（受到伤害 +50%），抽 1 张牌。`, play: (c, v) => { c.enemyStatus("vuln", v.vuln); c.draw(1); } },
  { id: "flame", name: "灯火", cost: 1, type: "attack", rarity: "common", pool: "lamp", tags: ["fire"], v: [{ dmg: 6, per: 3 }, { dmg: 7, per: 4 }],
    text: (v, p) => `造成 ${d(p, v.dmg + v.per * p.ash)} 伤害。行囊里每有 1 份灯灰，伤害 +${v.per}（不消耗）。`,
    play: (c, v) => { c.attack(v.dmg + v.per * c.goods("ash")); } },
  { id: "burnwick", name: "燃芯", cost: 0, type: "skill", rarity: "uncommon", pool: "lamp", v: [{ e: 2, draw: 2 }, { e: 3, draw: 2 }], tags: ["goods"],
    text: (v) => `烧掉 1 截灯芯：获得 ${v.e} 点能量，抽 ${v.draw} 张牌。`,
    needs: (c) => (c.goods("wick") < 1 ? "需要 1 截灯芯" : null),
    play: (c, v) => { c.consume("wick"); c.energy(v.e); c.draw(v.draw); } },
  { id: "barter", name: "以货挡灾", cost: 1, type: "skill", rarity: "common", pool: "lamp", v: [{ mul: 3 }, { mul: 4 }], tags: ["goods"],
    text: (v) => `丢掉行囊里最便宜的一件货：获得它售价 ×${v.mul} 的格挡。`,
    needs: (c) => (c.goods() < 1 ? "行囊里没有货" : null),
    play: (c, v) => { c.consume("cheapest"); c.block(Math.max(4, c.lastConsumedPrice * v.mul)); } },
  { id: "scatter", name: "撒钱", cost: 1, type: "attack", rarity: "common", pool: "abacus", v: [{ dmg: 11, cost: 5 }, { dmg: 16, cost: 5 }], tags: ["money"],
    text: (v, p) => `花 ${v.cost} 石：造成 ${d(p, v.dmg)} 伤害。`,
    needs: (c, v) => (c.gold() < v.cost ? `需要 ${v.cost} 石` : null),
    play: (c, v) => { c.spendGold(v.cost); c.attack(v.dmg); } },
  { id: "reap", name: "收灰", cost: 1, type: "attack", rarity: "common", pool: "lamp", v: [{ dmg: 6 }, { dmg: 9 }],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害，得到 1 份灯灰。`, play: (c, v) => { c.attack(v.dmg); c.gainGood("ash"); } },
  { id: "lamparray", name: "灯阵", cost: 2, type: "power", rarity: "rare", pool: "lamp", v: [{ dmg: 6 }, { dmg: 9 }],
    text: (v) => `每回合开始，若有灯灰，烧掉 1 份：造成 ${v.dmg} 伤害并获得 ${v.dmg} 格挡。`, play: (c, v) => c.selfStatus("lampArray", v.dmg) },
  { id: "stoke", name: "拨灯", cost: 0, type: "skill", rarity: "common", pool: "lamp", v: [{ n: 1 }, { n: 2 }], exhaust: true,
    text: (v) => `得到 ${v.n} 份灯灰。消耗。`, play: (c, v) => { for (let i = 0; i < v.n; i++) c.gainGood("ash"); } },

  // ---------- 算盘（花钱流） ----------
  { id: "reckon", name: "盘算", cost: 1, type: "skill", rarity: "common", pool: "abacus", v: [{ cap: 12 }, { cap: 16 }], tags: ["money"],
    text: (v, p) => `获得 ${p.inCombat ? `${Math.min(v.cap, Math.floor(p.gold / 4))} 点` : "等同身上石数 ÷4 的"}格挡（最多 ${v.cap}）。`,
    play: (c, v) => c.block(Math.min(v.cap, Math.floor(c.gold() / 4))) },
  { id: "bribe", name: "打点", cost: 0, type: "skill", rarity: "common", pool: "abacus", v: [{ cost: 6, n: 2 }, { cost: 4, n: 2 }], tags: ["money"],
    text: (v) => `花 ${v.cost} 石：施加 ${v.n} 层虚弱（敌人伤害 -25%）。`,
    needs: (c, v) => (c.gold() < v.cost ? `需要 ${v.cost} 石` : null),
    play: (c, v) => { c.spendGold(v.cost); c.enemyStatus("weak", v.n); } },
  { id: "interest", name: "生息", cost: [1, 0], type: "power", rarity: "uncommon", pool: "abacus", v: [{ n: 3 }, { n: 3 }],
    text: (v) => `每回合开始获得 ${v.n} 石。`, play: (c, v) => c.selfStatus("interest", v.n) },
  { id: "windfall", name: "一掷千金", cost: 2, type: "attack", rarity: "rare", pool: "abacus", v: [{ div: 2 }, { div: 1.5 }], tags: ["money"],
    text: (v, p) => `花光身上一半的石：每花 ${v.div === 2 ? "2" : "1.5"} 石造成 1 点伤害${p.inCombat ? `（现在 ${p.dmg(Math.floor(Math.floor(p.gold / 2) / v.div))}）` : ""}。`,
    needs: (c) => (c.gold() < 2 ? "身上没钱" : null),
    play: (c, v) => { const spend = Math.floor(c.gold() / 2); c.spendGold(spend); c.attack(Math.floor(spend / v.div)); } },

  // ---------- combo 关键牌 ----------
  { id: "gale", name: "疾风", cost: 0, type: "attack", rarity: "common", pool: "sword", v: [{ dmg: 4, bonus: 6 }, { dmg: 5, bonus: 8 }], tags: ["multi"],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害。本回合已打出 3 张攻击牌时，再造成 ${d(p, v.bonus)}${p.inCombat ? `（已打 ${p.attacks} 张）` : ""}。`,
    play: (c, v) => { c.attack(v.dmg); if (c.attacksThisTurn() >= 3) c.attack(v.bonus); } },
  { id: "sheathe", name: "收剑", cost: 1, type: "skill", rarity: "common", pool: "sword", v: [{ per: 3 }, { per: 4 }],
    text: (v, p) => `本回合每打出过一张攻击牌，获得 ${v.per} 格挡${p.inCombat ? `（现在 ${v.per * p.attacks}）` : ""}。`,
    play: (c, v) => c.block(v.per * c.attacksThisTurn()) },
  { id: "swordqi", name: "剑气纵横", cost: [2, 1], type: "power", rarity: "rare", pool: "sword", v: [{ n: 2 }, { n: 2 }],
    text: (v) => `之后每打出一张攻击牌，额外造成 ${v.n} 伤害。`, play: (c, v) => c.selfStatus("swordQi", v.n) },
  { id: "ironshirt", name: "铁布衫", cost: 1, type: "power", rarity: "uncommon", pool: "shield", v: [{ n: 1 }, { n: 2 }],
    text: (v) => `之后每次获得格挡，额外 +${v.n}。`, play: (c, v) => c.selfStatus("ironshirt", v.n) },
  { id: "hold", name: "固守", cost: 1, type: "skill", rarity: "common", pool: "shield", v: [{ blk: 5 }, { blk: 7 }],
    text: (v, p) => `获得 ${v.blk} 格挡。如果打出前你已经有格挡，再获得 ${v.blk}${p.inCombat ? (p.block ? "（会触发）" : "（现在没有格挡）") : ""}。`,
    play: (c, v) => { const had = c.currentBlock() > 0; c.block(v.blk); if (had) c.block(v.blk); } },
  { id: "ignite", name: "引火", cost: 1, type: "skill", rarity: "common", pool: "lamp", v: [{ n: 5 }, { n: 7 }], tags: ["fire"],
    text: (v) => `施加 ${v.n} 层灼烧（敌人每回合掉等量的血，无视格挡，然后少一层）。`, play: (c, v) => c.enemyStatus("burn", v.n) },
  { id: "burnout", name: "烧尽", cost: 1, type: "attack", rarity: "uncommon", pool: "lamp", v: [{ mul: 2 }, { mul: 3 }], tags: ["fire"],
    text: (v, p) => `造成敌人灼烧层数 ×${v.mul} 的伤害${p.inCombat ? `（现在 ${p.dmg(p.burn * v.mul)}）` : ""}。不消耗灼烧。`,
    play: (c, v) => { c.attack(c.enemyBurn() * v.mul); } },
  { id: "fuel", name: "火上浇油", cost: 1, type: "skill", rarity: "rare", pool: "lamp", v: [{}, {}], exhaust: [true, false], tags: ["fire"],
    text: (_v, p) => `敌人的灼烧层数翻倍${p.inCombat ? `（${p.burn} → ${p.burn * 2}）` : ""}。`, play: (c) => c.enemyStatus("burn", c.enemyBurn()) },
  { id: "clearance", name: "清仓", cost: 1, type: "attack", rarity: "uncommon", pool: "lamp", v: [{ dmg: 4 }, { dmg: 6 }], tags: ["goods", "fire"],
    text: (v, p) => `烧掉行囊里所有灯灰：每份造成 ${d(p, v.dmg)} 伤害${p.inCombat ? `（${p.ash} 份）` : ""}。`,
    needs: needAsh, play: (c, v) => { const n = c.consume("ash", 99).length; c.attack(v.dmg, n); } },
  { id: "principal", name: "本利", cost: 1, type: "skill", rarity: "common", pool: "abacus", v: [{ g: 4 }, { g: 6 }], tags: ["money"],
    text: (v) => `得到 ${v.g} 石。之后身上不少于 50 石，再抽 2 张牌。`, play: (c, v) => { c.gainGold(v.g); if (c.gold() >= 50) c.draw(2); } },
  { id: "hoard", name: "囤货", cost: [1, 0], type: "power", rarity: "uncommon", pool: "neutral", v: [{}, {}],
    text: (_v, p) => `行囊里每有 3 件货物，获得 1 点力量${p.inCombat ? `（现在 ${Math.floor(p.goods / 3)} 点）` : ""}。`,
    play: (c) => { const n = Math.floor(c.goods() / 3); if (n) c.selfStatus("str", n); } },

  // ---------- 通用 ----------
  { id: "bandage", name: "包扎", cost: 1, type: "skill", rarity: "common", pool: "neutral", v: [{ heal: 5 }, { heal: 8 }], exhaust: true,
    text: (v) => `回复 ${v.heal} 气血。消耗。`, play: (c, v) => c.heal(v.heal) },
  { id: "breath", name: "喘息", cost: 0, type: "skill", rarity: "common", pool: "neutral", v: [{ n: 2 }, { n: 3 }], exhaust: true,
    text: (v) => `抽 ${v.n} 张牌。消耗。`, play: (c, v) => c.draw(v.n) },
  { id: "talisman", name: "定身符", cost: [1, 0], type: "skill", rarity: "uncommon", pool: "neutral", v: [{}, {}], exhaust: true, tags: ["interrupt"],
    text: () => `立刻打断敌人的蓄力。消耗。`, needs: () => null, play: (c) => { c.interrupt(); } },
  { id: "pluck", name: "挑材", cost: 1, type: "attack", rarity: "uncommon", pool: "neutral", v: [{ dmg: 5 }, { dmg: 8 }],
    text: (v, p) => `造成 ${d(p, v.dmg)} 伤害。这场战斗胜利后，多拿一件这只妖的材料。`, play: (c, v) => { c.attack(v.dmg); c.harvest(); } },
  { id: "steady", name: "稳步", cost: 1, type: "skill", rarity: "common", pool: "neutral", v: [{ blk: 6 }, { blk: 9 }],
    text: (v) => `获得 ${v.blk} 格挡。下回合多抽 1 张牌。`, play: (c, v) => { c.block(v.blk); c.drawNext(1); } },
];

export const CARDS: Record<string, CardDef> = Object.fromEntries(list.map((c) => [c.id, c]));

export function cardCost(def: CardDef, up: boolean): number {
  return Array.isArray(def.cost) ? def.cost[up ? 1 : 0] : def.cost;
}
export function cardExhausts(def: CardDef, up: boolean): boolean {
  return Array.isArray(def.exhaust) ? def.exhaust[up ? 1 : 0] : !!def.exhaust;
}
/** Card numbers, including bag-neighbour bonuses on damage and block. */
export function cardVals(def: CardDef, up: boolean, bonus?: { dmg?: number; blk?: number }) {
  const v = def.v[up ? 1 : 0];
  if (!bonus) return v;
  const out = { ...v };
  if (bonus.dmg && out.dmg !== undefined) out.dmg += bonus.dmg;
  if (bonus.dmg && out.plus !== undefined) out.plus += bonus.dmg;
  if (bonus.blk && out.blk !== undefined) out.blk += bonus.blk;
  return out;
}

/** Cards you know by heart. Weapons in the bag add their own cards on top. */
export const BASE_DECK = ["strike", "strike", "strike", "strike", "defend", "defend", "defend", "defend"];
export const STARTER_GEAR: Record<WeaponId, "sword" | "shield" | "lamp" | "abacus"> = { sword: "sword", shield: "shield", lamp: "lamp", abacus: "abacus" };

export const TYPE_LABEL = { attack: "攻击", skill: "技法", power: "心法" } as const;
export const RARITY_LABEL = { basic: "基础", common: "常见", uncommon: "少见", rare: "稀有" } as const;
