import type { RngState } from "./rng";

export type WeaponId = "sword" | "shield" | "lamp";
export type GoodId =
  | "ash" | "fang" | "silk" | "shell" | "knot" | "wick" | "clasp" | "clasp-broken" | "copper"
  | "sword" | "shield" | "lamp" | "ironsword" | "hook" | "mirror" | "abacus" | "bell" | "purse"
  | "salve" | "pill" | "lining";
export type StatusId = "str" | "weak" | "vuln" | "thorns" | "focus" | "ward" | "barricade" | "lampArray" | "swordIntent" | "bulwark" | "counter";
export type Screen = "town" | "explore" | "combat" | "reward" | "shop" | "event" | "rest" | "result";
export type FloorNo = 1 | 2 | 3;

export interface CardInst { uid: number; id: string; up: boolean; /** gear the card comes from */ from?: GoodId }

export interface PlacedGood { uid: number; id: GoodId; x: number; y: number; rot: number }
export interface Bag { w: number; h: number; items: PlacedGood[] }

/** One enemy action. Every field is optional so a move can mix attack, block, buff and debuff. */
export interface Intent {
  key: string;
  name: string;
  dmg?: number;
  hits?: number;
  block?: number;
  str?: number;
  apply?: { status: "weak" | "vuln"; n: number };
  /** If any of this attack's damage gets through, the enemy grabs the most valuable good in the bag. */
  steal?: boolean;
  /** Winding up. Dealing `threshold` total damage this turn interrupts it; otherwise `then` lands next turn. */
  charge?: { threshold: number; then: string };
  stunned?: boolean;
  text?: string;
}

export interface Fighter { hp: number; maxHp: number; block: number; status: Partial<Record<StatusId, number>> }

export interface EnemyState extends Fighter {
  id: string;
  name: string;
  sprite: string;
  turn: number;
  intent: Intent;
  dmgAdd: number;
  phase: number;
  /** null when the enemy has no fragile part. */
  partIntact: boolean | null;
  /** Move to use next turn (set by a charge or by phase change). */
  queued: string | null;
  history: string[];
}

export type FightKind = "fight" | "elite" | "guardian";

export interface CombatState {
  kind: FightKind;
  enemy: EnemyState;
  energy: number;
  maxEnergy: number;
  block: number;
  status: Partial<Record<StatusId, number>>;
  draw: CardInst[];
  hand: CardInst[];
  discard: CardInst[];
  exhaust: CardInst[];
  turn: number;
  attacksThisTurn: number;
  cardsThisTurn: number;
  dmgThisTurn: number;
  goodsUsed: number;
  stolen: GoodId[];
  /** Guaranteed extra drop on kill (挑材). */
  harvest: number;
  drawBonusNext: number;
  purseUsed: boolean;
  over: null | "win" | "lose";
  rng: RngState;
}

export type EntityKind = "fight" | "elite" | "guardian" | "stairs" | "shop" | "event" | "rest" | "chest";

export interface Entity {
  id: number;
  kind: EntityKind;
  x: number;
  y: number;
  enemy?: string;
  hpMul?: number;
  dmgAdd?: number;
  event?: string;
  done: boolean;
}

export interface Dungeon {
  w: number;
  h: number;
  /** 1 = wall, 0 = floor */
  tiles: number[];
  seen: boolean[];
  start: { x: number; y: number; dir: number };
  entities: Entity[];
}

export interface RewardState {
  gold: number;
  goods: GoodId[];
  cards: string[] | null;
  relic: string | null;
  relicChoices: string[] | null;
  /** Fight kind that produced this reward, used for text. */
  from: FightKind | "chest";
  /** Enemy part note shown on the reward screen. */
  note: string;
}

export interface ShopState {
  cards: { id: string; price: number; sold: boolean }[];
  relics: { id: string; price: number; sold: boolean }[];
  gear: { id: GoodId; price: number; sold: boolean }[];
  consumables: { id: GoodId; price: number; sold: boolean }[];
  removePrice: number;
  removed: boolean;
  wanted: GoodId;
}

export interface EventState { id: string; step: number; result: string | null }

export interface RunStats { kills: number; goldEarned: number; goodsSold: number; goodsUsed: number; damageTaken: number; turns: number }

export interface RunState {
  version: 2;
  seed: number;
  rng: RngState;
  difficulty: number;
  weapon: WeaponId;
  order: string;
  orderDone: boolean;
  hp: number;
  maxHp: number;
  gold: number;
  deck: CardInst[];
  relics: string[];
  bag: Bag;
  floor: FloorNo;
  dungeon: Dungeon;
  pos: { x: number; y: number; dir: number };
  screen: Screen;
  combat: CombatState | null;
  /** Goods waiting to be packed (loot, event gifts). Never blocks progress: leaving drops them. */
  pending: GoodId[];
  reward: RewardState | null;
  event: EventState | null;
  shop: ShopState | null;
  /** Entity currently being resolved (fight / shop / event). */
  at: number | null;
  stats: RunStats;
  nextUid: number;
  outcome: null | "win" | "dead" | "retreat";
  mapRevealed: boolean;
  /** Open card picker (upgrade / remove), from an event, rest or shop. */
  cardPick: { mode: "upgrade" | "remove"; source: "event" | "rest" | "shop"; price?: number } | null;
  bossIntel: boolean;
  log: string[];
}

export interface Profile {
  renown: number;
  runs: number;
  wins: number;
  bestFloor: number;
  ordersDone: string[];
  seenTips: string[];
  sound: boolean;
}
