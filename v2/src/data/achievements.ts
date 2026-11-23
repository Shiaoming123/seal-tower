import type { Profile, RunState } from "../game/types";
import { ORDERS } from "./orders";

export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  renown: number;
  /** Checked when a run ends. */
  check: (run: RunState, profile: Profile) => boolean;
}

const has = (run: RunState, flag: string) => run.flags.includes(flag);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: "floor2", name: "初登桥驿", text: "到达第二层。", renown: 1, check: (r) => r.floor >= 2 },
  { id: "win", name: "镇塔钟鸣", text: "击败负钟君。", renown: 3, check: (r) => r.outcome === "win" },
  { id: "clasp", name: "完好如初", text: "从狐妖身上取下一枚完整狐扣。", renown: 1, check: (r) => has(r, "clasp") },
  { id: "recover", name: "虎口夺货", text: "在灯鼠钻洞前打死它，追回被抢的货。", renown: 1, check: (r) => has(r, "recover") },
  { id: "bell-break", name: "断钟", text: "打断负钟君的「蓄钟」。", renown: 2, check: (r) => has(r, "bell-break") },
  { id: "harvest5", name: "取材老手", text: "一趟里取材成功 5 次。", renown: 2, check: (r) => r.stats.harvests >= 5 },
  { id: "trader", name: "狐市常客", text: "一趟里卖出 15 件货。", renown: 1, check: (r) => r.stats.goodsSold >= 15 },
  { id: "lit", name: "灯不灭", text: "灯油一次也没烧完，并击败负钟君。", renown: 2, check: (r) => r.outcome === "win" && !has(r, "dark") },
  { id: "lean", name: "轻装上阵", text: "牌组（含装备的牌）不超过 14 张时击败负钟君。", renown: 2, check: (r) => r.outcome === "win" && has(r, "lean") },
  { id: "regular", name: "四方信誉", text: "所有委托人的单都完成过。", renown: 3, check: (_r, p) => Object.keys(ORDERS).every((o) => p.ordersDone.includes(o)) },
  { id: "bestiary", name: "百妖谱", text: "一趟里打倒 12 只妖。", renown: 1, check: (r) => r.stats.kills >= 12 },
  { id: "fallen", name: "清理门户", text: "不碰堕道者的架势，拿到它的斩妖令。", renown: 2, check: (r) => r.flags.includes("token") },
];
