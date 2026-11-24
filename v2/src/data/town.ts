// 镇灯铺营建: permanent upgrades bought with the treasury (money you brought home alive).

export interface UpgradeDef {
  id: string;
  name: string;
  icon: string;
  /** Text for each level, index 0 = level 1. */
  levels: { cost: number; text: string }[];
}

export const UPGRADES: UpgradeDef[] = [
  { id: "ledger", name: "账房", icon: "abacus", levels: [
    { cost: 50, text: "开局多带 15 石。" }, { cost: 120, text: "开局多带 30 石。" }] },
  { id: "oil", name: "灯油坊", icon: "lamp", levels: [
    { cost: 40, text: "开局灯油和上限 +15。" }, { cost: 100, text: "开局灯油和上限 +30。" }] },
  { id: "medicine", name: "药柜", icon: "salve", levels: [
    { cost: 50, text: "开局带 1 瓶金疮药。" }, { cost: 120, text: "再多带 1 颗养元丹。" }] },
  { id: "shelf", name: "货架", icon: "ward-blade", levels: [
    { cost: 70, text: "开局多带一件随机的普通装备或配件。" }, { cost: 160, text: "改为一件随机的好装备或配件。" }] },
  { id: "school", name: "学堂", icon: "silk", levels: [
    { cost: 90, text: "进塔前先从 3 张牌里挑 1 张学。" }] },
  { id: "bagsmith", name: "行囊匠", icon: "lining", levels: [
    { cost: 140, text: "行囊开局是 5×5。" }] },
  { id: "counter", name: "订单柜", icon: "order-purse", levels: [
    { cost: 110, text: "一趟可以同时接两张委托。" }] },
  { id: "branch", name: "狐市分号", icon: "pin", levels: [
    { cost: 100, text: "塔里的狐市多卖一张牌、一件装备。" }] },
];

export const UPGRADE = Object.fromEntries(UPGRADES.map((u) => [u.id, u])) as Record<string, UpgradeDef>;

export const MAX_FAVOR = 5;
