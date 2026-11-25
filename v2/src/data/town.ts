// 镇灯铺营建: permanent upgrades bought with the treasury (money you brought home alive).

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** Text for each level, index 0 = level 1. */
  levels: { cost: number; text: string }[];
}

// Costs doubled (REVIEW-003): one winning run brought home ~950 石 and every first level cost 650 together.
export const UPGRADES: UpgradeDef[] = [
  { id: "ledger", name: "账房", icon: "abacus", levels: [
    { cost: 100, text: "开局多带 15 石。" }, { cost: 240, text: "开局多带 30 石。" }] },
  { id: "oil", name: "灯油坊", icon: "lamp", levels: [
    { cost: 80, text: "开局灯油和上限 +15。" }, { cost: 200, text: "开局灯油和上限 +30。" }] },
  { id: "medicine", name: "药柜", icon: "salve", levels: [
    { cost: 100, text: "开局带 1 瓶金疮药。" }, { cost: 240, text: "再多带 1 颗养元丹。" }] },
  { id: "shelf", name: "货架", icon: "ward-blade", levels: [
    { cost: 140, text: "开局多带一件随机的普通装备或配件。" }, { cost: 320, text: "改为一件随机的好装备或配件。" }] },
  { id: "school", name: "学堂", icon: "silk", levels: [
    { cost: 180, text: "进塔前先从 3 张牌里挑 1 张学。" }] },
  { id: "bagsmith", name: "行囊匠", icon: "lining", levels: [
    { cost: 280, text: "行囊开局是 5×5。" }] },
  { id: "counter", name: "订单柜", icon: "order-purse", levels: [
    { cost: 220, text: "一趟可以同时接两张委托。" }] },
  { id: "branch", name: "狐市分号", icon: "pin", levels: [
    { cost: 200, text: "塔里的狐市多卖一张牌、一件装备。" }] },
];

export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<string, UpgradeDef>;

export const MAX_FAVOR = 5;
