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
  /** Accessory that boosts the 8 cells around it in the bag. */
  aura?: { kind: "dmg" | "blk" | "sell" | "ward" | "ash"; n: number; text: string };
  tier?: 1 | 2 | 3;
  /** Rotate a diagonal icon so it lies along the item's long side (degrees) and enlarge it. */
  tilt?: [number, number];
  /** Set tags: carrying enough items with the same tag (anywhere in the bag) turns on a set bonus. */
  tags?: TagId[];
  use?: { label: string; heal?: number; maxHp?: number; bagRow?: boolean; oil?: number; inCombat: boolean };
  dim?: boolean;
  /** Fragile goods: taking a hit with this in the bag may crack it into this cheaper good. */
  fragile?: GoodId;
  /** Refined gear (精): the item it was refined from. It keeps that item's passive and counts as it. */
  base?: GoodId;
  /** Refined gear: its cards come upgraded, and get this bonus. */
  cardsUp?: boolean;
  selfBonus?: { dmg?: number; blk?: number };
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
    text: "妖物偷吃灯油后剩下的灰。镇上的灯匠收它补灯，引灯的招式也要烧它，实在没油了还能烧来照路。",
    use: { label: "烧来照路 · 灯油 +8", oil: 8, inCombat: false } },
  { id: "fang", tags: ["material"], kind: "goods", name: "鼠牙", icon: "fang", tilt: [-45, 1.25], shape: V2, price: 3, text: "灯鼠的门牙，药铺收去磨粉。" },
  { id: "silk", tags: ["material"], kind: "goods", name: "蛾丝卷", icon: "silk", shape: V2, price: 4, text: "纸灯蛾吐的丝，裁缝拿来糊灯罩。" },
  { id: "shell", tags: ["material"], kind: "goods", name: "墨壳", icon: "shell", shape: H2, price: 5, text: "书虱褪下的硬壳，刻印匠抢着要。" },
  { id: "knot", tags: ["material"], kind: "goods", name: "狐毛结", icon: "knot", shape: V2, price: 6, text: "黑狐身上扯下的毛结，能编护身绳。" },
  { id: "wick", tags: ["lamp"], kind: "goods", name: "灯芯", icon: "seal", shape: ONE, price: 6, text: "大妖体内还亮着的一截灯芯。燃芯的招式能把它烧成力气。" },
  { id: "clasp", tags: ["material"], kind: "goods", name: "完整狐扣", icon: "clasp", shape: ONE, price: 10, fragile: "clasp-broken", text: "狐妖颈下的铜扣，完好无损。绯绡出高价收。易碎：挨打时可能磕碎。" },
  { id: "clasp-broken", kind: "goods", name: "碎狐扣", icon: "clasp", shape: ONE, price: 3, dim: true, text: "被重击打裂的狐扣，只能当废铜卖。" },
  { id: "redpaper", tags: ["material"], kind: "goods", name: "红纸", icon: "icon-redpaper", shape: ONE, price: 5, text: "纸人童身上没烧着的红纸。纸扎铺拿它扎新的灯笼。" },
  { id: "fur", tags: ["material"], kind: "goods", name: "火鼠毛", icon: "icon-fur", shape: ONE, price: 7, text: "火鼠背上的毛，烧不坏。裁缝拿来缝灯罩的里衬。" },
  { id: "inkdust", tags: ["material"], kind: "goods", name: "墨粉", icon: "icon-inkdust", shape: ONE, price: 6, text: "墨蛾翅上抖下来的粉，书院拿它研墨。" },
  { id: "pearl", tags: ["material"], kind: "goods", name: "水珠", icon: "icon-pearl", shape: ONE, price: 9, fragile: "pearl-cracked", text: "水鬼含在嘴里的珠子，夜里会发光。易碎：挨打时可能磕裂。" },
  { id: "pearl-cracked", kind: "goods", name: "裂水珠", icon: "icon-pearl", shape: ONE, price: 4, dim: true, text: "磕出裂纹的水珠，光也暗了，只能便宜卖。" },
  { id: "rubbing", tags: ["material"], kind: "goods", name: "碑拓", icon: "icon-rubbing", shape: V2, price: 8, text: "从活过来的石碑上拓下的字。书院先生收。" },
  { id: "token", tags: ["material"], kind: "goods", name: "斩妖令", icon: "icon-token", shape: ONE, price: 12, text: "堕道者腰间的令牌。上面的名字，是一位失踪的斩妖人。" },
  { id: "shard", tags: ["material"], kind: "goods", name: "铜片", icon: "icon-shard", shape: ONE, price: 6, text: "铜傀身上掉下的铜片，铁匠拿它补锅。" },
  { id: "feather", tags: ["material"], kind: "goods", name: "枭羽", icon: "icon-feather", shape: V2, price: 8, text: "夜枭的翎羽。做成箭羽，射得又快又准。" },
  { id: "tail", tags: ["material"], kind: "goods", name: "白狐尾", icon: "icon-tail", shape: H2, price: 14, text: "假狐商的一条尾巴。绯绡说，这本来就不该长在它身上。" },
  { id: "copper", kind: "goods", name: "钟铜", icon: "bell-item", shape: SQ, price: 16, fragile: "copper-cracked", text: "负钟君的碎钟片。镇长要它重铸镇塔钟。易碎：挨打时可能磕裂。" },
  { id: "copper-cracked", kind: "goods", name: "裂钟铜", icon: "bell-item", shape: SQ, price: 8, dim: true, text: "裂成两半的钟片，铸不了钟，只能当铜卖。" },

  // ---------- gear ----------
  { id: "sword", tags: ["blade"], kind: "gear", tier: 2, name: "照影剑", icon: "sword", tilt: [-45, 1.6], shape: V3, price: 14, cards: ["unison", "twin"],
    passive: "每回合第一张攻击牌伤害 +2。", text: "斩妖人家传的剑。快、准，适合连续出招。" },
  { id: "shield", tags: ["guard"], kind: "gear", tier: 1, name: "木挡板", icon: "plank", shape: H2, price: 10, cards: ["bash", "spikes"],
    passive: "回合结束时最多保留 2 点格挡。", text: "桥驿常见的厚木板，挡得住鼠牙也挡得住狐爪。" },
  { id: "lamp", tags: ["lamp"], kind: "gear", tier: 2, name: "引灯盘", icon: "seal", shape: V2, price: 12, cards: ["dust", "flame"],
    passive: "每场战斗胜利后多得 1 份灯灰。", text: "镇灯铺的引火盘。能把灯灰烧成照妖的火。" },
  { id: "ironsword", tags: ["blade"], kind: "gear", tier: 1, name: "铁剑", icon: "ward-blade", tilt: [-45, 1.6], shape: V3, price: 8, cards: ["strike", "gap"],
    text: "铁匠铺的大路货。多一把剑，就多两招。" },
  { id: "hook", tags: ["blade"], kind: "gear", tier: 1, name: "竹柄钩", icon: "hook", shape: L3, price: 9, cards: ["riposte", "pluck"],
    text: "取材用的弯钩，顺手也能刺一下。" },
  { id: "mirror", tags: ["guard"], kind: "gear", tier: 2, name: "护心镜", icon: "mirror", shape: SQ, price: 14, cards: ["wall"],
    passive: "每场战斗开始时获得 6 点格挡。", text: "挂在胸前的铜镜，很重，但真能救命。" },
  { id: "abacus", tags: ["coin"], kind: "gear", tier: 2, name: "算盘", icon: "abacus", shape: SQ, price: 14, cards: ["scatter", "reckon"],
    passive: "战斗开始时，身上每有 15 石，获得 1 点力量（最多 3）。", text: "账房先生的算盘。钱越多，底气越足。" },
  { id: "bell", kind: "gear", tier: 2, name: "铜铃", icon: "bell-item", shape: SQ, price: 15,
    passive: "每场战斗第一回合多 1 点能量。", text: "摇一下，先手就是你的。" },
  { id: "purse", tags: ["coin"], kind: "gear", tier: 1, name: "货郎钱袋", icon: "order-purse", shape: H2, price: 7, cards: ["guardgoods"],
    text: "货郎的钱袋，教你怎么护住货。" },

  // ---------- accessories: they boost whatever sits around them (8 neighbouring cells) ----------
  { id: "whetstone", tags: ["blade"], kind: "gear", tier: 1, name: "磨刀石", icon: "icon-whetstone", shape: ONE, price: 6,
    aura: { kind: "dmg", n: 2, text: "相邻装备的攻击牌伤害 +2" }, text: "放在兵器旁边，出鞘前磨一磨。" },
  { id: "amulet", tags: ["guard"], kind: "gear", tier: 1, name: "护身符", icon: "icon-amulet", shape: ONE, price: 6,
    aura: { kind: "blk", n: 2, text: "相邻装备的格挡牌格挡 +2" }, text: "庙里求来的符，贴在盾上更结实。" },
  { id: "oilpot", tags: ["lamp"], kind: "gear", tier: 2, name: "灯油壶", icon: "icon-oilpot", shape: V2, price: 8,
    aura: { kind: "ash", n: 1, text: "相邻的每份灯灰，在「灯火」这类按灯灰算的牌里算两份" }, text: "浸过油的灰烧得更旺。" },
  { id: "luckybag", tags: ["coin"], kind: "gear", tier: 1, name: "招财袋", icon: "icon-luckybag", shape: ONE, price: 7,
    aura: { kind: "sell", n: 2, text: "相邻的每件货物卖价 +2" }, text: "绣着元宝的小袋子，挨着它的货都显得金贵。" },
  { id: "wardcharm", kind: "gear", tier: 1, name: "镇货符", icon: "icon-wardcharm", shape: ONE, price: 6,
    aura: { kind: "ward", n: 1, text: "相邻的货不会被抢" }, text: "贴在货上，鼠妖不敢下嘴。" },

  // ---------- refined gear (精): made in the bag, never sold in shops; same art with a gold 精 badge ----------
  { id: "ironsword-fine", base: "ironsword", tags: ["blade"], kind: "gear", name: "精铁剑", icon: "ward-blade", tilt: [-45, 1.6], shape: V3, price: 14, cards: ["strike", "gap"], cardsUp: true, selfBonus: { dmg: 1 },
    passive: "牌已升级，伤害再 +1。", text: "磨刀石磨了一整夜的铁剑，刃口亮得能照人。" },
  { id: "shield-fine", base: "shield", tags: ["guard"], kind: "gear", name: "精木挡板", icon: "plank", shape: H2, price: 16, cards: ["bash", "spikes"], cardsUp: true,
    passive: "牌已升级。回合结束时最多保留 4 点格挡。", text: "贴了护身符的木挡板，挨一下就嗡一声。" },
  { id: "lamp-fine", base: "lamp", tags: ["lamp"], kind: "gear", name: "精引灯盘", icon: "seal", shape: V2, price: 18, cards: ["dust", "flame"], cardsUp: true,
    passive: "牌已升级。每场战斗胜利后多得 2 份灯灰。", text: "浸过灯油的引灯盘，火一点就旺。" },
  { id: "purse-fine", base: "purse", tags: ["coin"], kind: "gear", name: "精钱袋", icon: "order-purse", shape: H2, price: 12, cards: ["guardgoods"], cardsUp: true,
    aura: { kind: "sell", n: 1, text: "相邻的每件货物卖价 +1" }, text: "缝进了招财袋的钱袋，货装进去都显得体面。" },

  // ---------- consumables ----------
  { id: "salve", kind: "consumable", name: "金疮药", icon: "salve", shape: V2, price: 5,
    text: "随时可以取出来用，回复 12 气血。", use: { label: "用药 · 回复 12 气血", heal: 12, inCombat: true } },
  { id: "pill", kind: "consumable", name: "养元丹", icon: "pouch", shape: ONE, price: 8,
    text: "吃下后最大气血 +5，并回复 5 气血。", use: { label: "服下 · 最大气血 +5", maxHp: 5, heal: 5, inCombat: false } },
  { id: "lining", kind: "consumable", name: "扩囊衬布", icon: "lining", shape: H2, price: 9,
    text: "缝进行囊：选一块 4 格的形状（一字、拐角或方块），拼到行囊外沿你想要的位置。行囊最大 8×7、36 格。", use: { label: "缝进行囊 · 扩 4 格", bagRow: true, inCombat: false } },
];

export type TagId = "blade" | "guard" | "lamp" | "coin" | "material";
export interface TagDef { id: TagId; name: string; at: [number, number]; text: [string, string] }
/** Set bonuses. Only items packed in the bag count — the side pouch doesn't. */
export const TAGS: Record<TagId, TagDef> = {
  blade: { id: "blade", name: "刃", at: [2, 4], text: ["所有伤害 +1", "每回合第一张攻击牌再 +3 伤害"] },
  guard: { id: "guard", name: "盾", at: [2, 3], text: ["每场开始获得 4 点格挡", "回合结束多保留 3 点格挡"] },
  lamp: { id: "lamp", name: "灯", at: [2, 4], text: ["灼烧每次多烧 2 点", "每场开始给妖点上 3 层灼烧"] },
  coin: { id: "coin", name: "钱", at: [2, 3], text: ["狐市买东西便宜两成", "每场开始得 5 石"] },
  material: { id: "material", name: "妖材", at: [3, 6], text: ["每件妖材多值 2 石（卖给绯绡或带回镇上都算）", "取材成功时多拿一份"] },
};
export const TAG_IDS = Object.keys(TAGS) as TagId[];

export const GOODS = Object.fromEntries(list.map((g) => [g.id, g])) as Record<GoodId, GoodDef>;
export const goodName = (id: GoodId) => GOODS[id].name;
/** Gear that can drop or be sold (refined gear is only made in the bag). */
export const GEAR_IDS = list.filter((g) => g.kind === "gear" && !g.base).map((g) => g.id);

/** 淬炼: gear sitting next to this accessory when you win a fight is refined; the accessory is used up. */
export const REFINES: { gear: GoodId; with: GoodId; into: GoodId }[] = [
  { gear: "ironsword", with: "whetstone", into: "ironsword-fine" },
  { gear: "shield", with: "amulet", into: "shield-fine" },
  { gear: "lamp", with: "oilpot", into: "lamp-fine" },
  { gear: "purse", with: "luckybag", into: "purse-fine" },
];
export const KIND_LABEL = { goods: "货物", gear: "装备", consumable: "消耗品" } as const;
