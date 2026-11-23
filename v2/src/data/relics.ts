// 法宝: passive effects that don't take bag space (like relics in Slay the Spire).
export interface RelicDef {
  id: string;
  name: string;
  icon: string;
  text: string;
  rarity: "common" | "rare";
  price?: number;
}

export const RELICS: Record<string, RelicDef> = {
  pin: { id: "pin", name: "狐扣针", icon: "pin", rarity: "common", price: 26, text: "绯绡的货价打八折，收货价每件多给 1 石。" },
  sealbag: { id: "sealbag", name: "封口锦囊", icon: "pouch", rarity: "common", price: 24, text: "每场战斗第一次被抢货时，货不会丢。" },
  thorn: { id: "thorn", name: "棘环", icon: "hook", rarity: "common", price: 28, text: "每场战斗开始时获得 2 层反震。" },
  fangcharm: { id: "fangcharm", name: "鼠牙坠", icon: "fang", rarity: "common", price: 26, text: "每场战斗胜利后回复 4 气血。" },
  silkfan: { id: "silkfan", name: "蛾丝扇", icon: "silk", rarity: "common", price: 26, text: "每场战斗第一回合多抽 2 张牌。" },
  knotcharm: { id: "knotcharm", name: "狐毛护身结", icon: "knot", rarity: "rare", price: 38, text: "回合结束时如果没有格挡，回复 2 气血。" },
  seal: { id: "seal", name: "灯纹印", icon: "grit", rarity: "rare", price: 40, text: "每烧掉或丢掉一件货，抽 1 张牌。" },
  tassel: { id: "tassel", name: "镇妖剑穗", icon: "ward-blade", rarity: "rare", price: 42, text: "每回合打出第 3 张牌时，额外造成 6 点伤害。" },
  butcher: { id: "butcher", name: "庖丁刀", icon: "hook", rarity: "rare", price: 40, text: "取材成功时，多拿 1 份同样的材料，再得 5 石。" },
  treasurebag: { id: "treasurebag", name: "万宝囊", icon: "pouch", rarity: "common", price: 30, text: "战斗开始时，行囊里每有 4 件货物获得 1 点力量（最多 3）。" },
  wickcutter: { id: "wickcutter", name: "灯芯剪", icon: "seal", rarity: "common", price: 28, text: "灼烧每次多烧 2 点。" },
  swordmanual: { id: "swordmanual", name: "剑谱残页", icon: "silk", rarity: "rare", price: 42, text: "每回合打出第 4 张攻击牌时，能量 +2。" },
  ledger: { id: "ledger", name: "绯绡的账本", icon: "order-purse", rarity: "rare", price: 36, text: "每卖出一件货，回复 1 气血。" },
};

export const RELIC_POOL = Object.keys(RELICS);
