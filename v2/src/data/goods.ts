import type { GoodId } from "../game/types";

/**
 * Everything that lives in the bag. Three kinds:
 * - goods: monster materials. Sell them, hand them in for orders, or burn them with certain cards.
 * - gear: weapons and tools. Each one adds its cards to your deck while you carry it.
 * - consumable: used from the bag, then gone.
 */
export interface GoodDef {
  id: GoodId;
  kind: "goods" | "gear" | "consumable";
  name: string;
  icon: string;
  /** cells relative to the item's top-left, before rotation */
  shape: [number, number][];
  price: number;
  text: string;
  /** gear: cards added to the deck while carried */
  cards?: string[];
  /** gear: passive effect while carried, in plain words */
  passive?: string;
  tier?: 1 | 2 | 3;
  /** Rotate a diagonal icon so it lies along the item's long side (degrees) and enlarge it. */
  tilt?: [number, number];
  use?: { label: string; heal?: number; maxHp?: number; bagRow?: boolean; inCombat: boolean };
  dim?: boolean;
}

const V3: [number, number][] = [[0, 0], [0, 1], [0, 2]];
const V2: [number, number][] = [[0, 0], [0, 1]];
const H2: [number, number][] = [[0, 0], [1, 0]];
const SQ: [number, number][] = [[0, 0], [1, 0], [0, 1], [1, 1]];
const L3: [number, number][] = [[0, 0], [0, 1], [1, 1]];
const ONE: [number, number][] = [[0, 0]];

const list: GoodDef[] = [
  // ---------- goods ----------
  { id: "ash", kind: "goods", name: "灯灰", icon: "ash", shape: ONE, price: 2,
    text: "妖物偷吃灯油后剩下的灰。镇上的灯匠收它补灯，引灯的招式也要烧它。" },
  { id: "fang", kind: "goods", name: "鼠牙", icon: "fang", tilt: [-45, 1.25], shape: V2, price: 3, text: "灯鼠的门牙，药铺收去磨粉。" },
  { id: "silk", kind: "goods", name: "蛾丝卷", icon: "silk", shape: V2, price: 4, text: "纸灯蛾吐的丝，裁缝拿来糊灯罩。" },
  { id: "shell", kind: "goods", name: "墨壳", icon: "shell", shape: H2, price: 5, text: "书虱褪下的硬壳，刻印匠抢着要。" },
  { id: "knot", kind: "goods", name: "狐毛结", icon: "knot", shape: V2, price: 6, text: "黑狐身上扯下的毛结，能编护身绳。" },
  { id: "wick", kind: "goods", name: "灯芯", icon: "seal", shape: ONE, price: 6, text: "大妖体内还亮着的一截灯芯。燃芯的招式能把它烧成力气。" },
  { id: "clasp", kind: "goods", name: "完整狐扣", icon: "clasp", shape: ONE, price: 10, text: "狐妖颈下的铜扣，完好无损。绯绡出高价收。" },
  { id: "clasp-broken", kind: "goods", name: "碎狐扣", icon: "clasp", shape: ONE, price: 3, dim: true, text: "被重击打裂的狐扣，只能当废铜卖。" },
  { id: "copper", kind: "goods", name: "钟铜", icon: "bell-item", shape: SQ, price: 16, text: "负钟君的碎钟片。镇长要它重铸镇塔钟。" },

  // ---------- gear ----------
  { id: "sword", kind: "gear", tier: 2, name: "照影剑", icon: "sword", tilt: [-45, 1.6], shape: V3, price: 14, cards: ["unison", "twin"],
    passive: "每回合第一张攻击牌伤害 +2。", text: "斩妖人家传的剑。快、准，适合连续出招。" },
  { id: "shield", kind: "gear", tier: 1, name: "木挡板", icon: "plank", shape: H2, price: 10, cards: ["bash", "spikes"],
    passive: "回合结束时最多保留 2 点格挡。", text: "桥驿常见的厚木板，挡得住鼠牙也挡得住狐爪。" },
  { id: "lamp", kind: "gear", tier: 2, name: "引灯盘", icon: "seal", shape: V2, price: 12, cards: ["dust", "reveal"],
    passive: "每场战斗胜利后多得 1 份灯灰。", text: "镇灯铺的引火盘。能把灯灰烧成照妖的火。" },
  { id: "ironsword", kind: "gear", tier: 1, name: "铁剑", icon: "ward-blade", tilt: [-45, 1.6], shape: V3, price: 8, cards: ["strike", "gap"],
    text: "铁匠铺的大路货。多一把剑，就多两招。" },
  { id: "hook", kind: "gear", tier: 1, name: "竹柄钩", icon: "hook", shape: L3, price: 9, cards: ["riposte", "pluck"],
    text: "取材用的弯钩，顺手也能刺一下。" },
  { id: "mirror", kind: "gear", tier: 2, name: "护心镜", icon: "mirror", shape: SQ, price: 14, cards: ["wall"],
    passive: "每场战斗开始时获得 6 点格挡。", text: "挂在胸前的铜镜，很重，但真能救命。" },
  { id: "abacus", kind: "gear", tier: 2, name: "算盘", icon: "abacus", shape: SQ, price: 14, cards: ["scatter"],
    passive: "战斗开始时，身上每有 15 石，获得 1 点力量（最多 3）。", text: "账房先生的算盘。钱越多，底气越足。" },
  { id: "bell", kind: "gear", tier: 2, name: "铜铃", icon: "bell-item", shape: SQ, price: 15,
    passive: "每场战斗第一回合多 1 点能量。", text: "摇一下，先手就是你的。" },
  { id: "purse", kind: "gear", tier: 1, name: "货郎钱袋", icon: "order-purse", shape: H2, price: 7, cards: ["guardgoods"],
    text: "货郎的钱袋，教你怎么护住货。" },

  // ---------- consumables ----------
  { id: "salve", kind: "consumable", name: "金疮药", icon: "salve", shape: V2, price: 5,
    text: "随时可以取出来用，回复 12 气血。", use: { label: "用药 · 回复 12 气血", heal: 12, inCombat: true } },
  { id: "pill", kind: "consumable", name: "养元丹", icon: "pouch", shape: ONE, price: 8,
    text: "吃下后最大气血 +5，并回复 5 气血。", use: { label: "服下 · 最大气血 +5", maxHp: 5, heal: 5, inCombat: false } },
  { id: "lining", kind: "consumable", name: "扩囊衬布", icon: "lining", shape: H2, price: 9,
    text: "缝进行囊里，行囊多一行格子（最多 6 行）。", use: { label: "缝进行囊 · 多一行", bagRow: true, inCombat: false } },
];

export const GOODS = Object.fromEntries(list.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;
export const goodName = (id: GoodId) => GOODS[id].name;
export const GEAR_IDS = list.filter((g) => g.kind === "gear").map((g) => g.id);
export const KIND_LABEL = { goods: "货物", gear: "装备", consumable: "消耗品" } as const;
