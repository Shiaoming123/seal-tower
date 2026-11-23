import { addGood, gainRelic, randomRelic } from "../game/inventory";
import * as bag from "../game/bag";
import { chance, pick } from "../game/rng";
import type { GoodId, RunState } from "../game/types";
import { RELICS } from "./relics";

export interface EventOption {
  label: string;
  detail: string;
  /** Reason the option is unavailable, or null. */
  locked?: (run: RunState) => string | null;
  /** Apply the choice; return the line shown afterwards. */
  apply: (run: RunState) => string;
}

export interface EventDef {
  id: string;
  title: string;
  sprite: string;
  text: string;
  options: EventOption[];
}

const leave: EventOption = { label: "离开", detail: "什么也不做。", apply: () => "你没有停留。" };
const hurt = (run: RunState, n: number) => { run.hp = Math.max(1, run.hp - n); run.stats.damageTaken += n; };

export const EVENTS: Record<string, EventDef> = {
  lampstand: {
    id: "lampstand", title: "没人管的灯台", sprite: "lamp",
    text: "一盏旧灯台还亮着，灯油不多了。可以借着灯光包扎伤口，也可以把灯里的灰刮下来带走。",
    options: [
      { label: "包扎", detail: "回复 12 气血。", apply: (r) => { const a = Math.min(12, r.maxHp - r.hp); r.hp += a; return `你包扎好伤口，回复了 ${a} 气血。`; } },
      { label: "刮灯灰", detail: "得到 2 份灯灰。", apply: (r) => { addGood(r, "ash"); addGood(r, "ash"); return "你刮下两份灯灰，灯也灭了。"; } },
      { label: "倒灯油", detail: "把剩下的灯油倒进你的灯里，灯油 +30。", apply: (r) => { const a = Math.min(30, r.maxOil - r.oil); r.oil += a; return `灯油 +${a}。`; } },
    ],
  },
  broker: {
    id: "broker", title: "血客", sprite: "broker",
    text: "穿红袍的血客拦住你：“气血换钱，现结。要药也有，就是贵。”",
    options: [
      { label: "卖血", detail: "最大气血 -6，得到 30 石。", locked: (r) => (r.maxHp <= 20 ? "你已经太虚弱了" : null),
        apply: (r) => { r.maxHp -= 6; r.hp = Math.min(r.hp, r.maxHp); r.gold += 30; r.stats.goldEarned += 30; return "血客收走一碗血，数给你 30 石。"; } },
      { label: "买药", detail: "花 12 石，买一瓶金疮药。", locked: (r) => (r.gold < 12 ? "石不够" : null),
        apply: (r) => { r.gold -= 12; addGood(r, "salve"); return "你买下一瓶金疮药。"; } },
      leave,
    ],
  },
  guide: {
    id: "guide", title: "歇脚的道友", sprite: "guide",
    text: "一位老道友靠在墙边歇脚。他在这层走了很多遍，知道路，也认得守关的妖。",
    options: [
      { label: "问路", detail: "付 8 石，本层地图全部点亮。", locked: (r) => (r.gold < 8 ? "石不够" : null),
        apply: (r) => { r.gold -= 8; r.mapRevealed = true; return "道友在你的地图上画出了整层的路。"; } },
      { label: "问守关妖", detail: "免费。之后在地图上能看到守关妖的招式。",
        apply: (r) => { r.bossIntel = true; return "道友把守关妖的招式一招一招讲给你听。打开地图上的守关标记就能看到。"; } },
      { label: "打听行情", detail: "付 3 石，知道下一层狐市每种货收多少钱。", locked: (r) => (r.floor >= 3 ? "这已经是最高层了" : r.gold < 3 ? "石不够" : null),
        apply: (r) => { r.gold -= 3; r.rumor = true; return "道友把上一层狐市的行情一样一样告诉你。到狐市时可以对照着卖。"; } },
      { label: "以货换牌", detail: "给他一件货，他帮你升级 1 张牌。", locked: (r) => (bag.count(r.bag) ? null : "行囊里没有货"),
        apply: (r) => {
          const item = bag.cheapest(r.bag)!;
          r.bag.items = r.bag.items.filter((i) => i !== item);
          r.cardPick = { mode: "upgrade", source: "event" };
          return "道友收下货，示意你挑一张牌。";
        } },
    ],
  },
  stele: {
    id: "stele", title: "断碑", sprite: "stele",
    text: "半截石碑上刻着前辈的剑诀。碑面粗糙，能拿来磨剑，只是会磨破手。",
    options: [
      { label: "磨剑", detail: "失去 6 气血，升级 1 张牌。", apply: (r) => { hurt(r, 6); r.cardPick = { mode: "upgrade", source: "event" }; return "选一张牌升级。"; } },
      { label: "抄碑文", detail: "移除 1 张牌（让牌组更精）。", apply: (r) => { r.cardPick = { mode: "remove", source: "event" }; return "选一张牌移除。"; } },
      leave,
    ],
  },
  purse: {
    id: "purse", title: "遗落的货袋", sprite: "purse",
    text: "墙角有个被人丢下的货袋，鼓鼓囊囊。旁边还滚着一个小钱袋。",
    options: [
      { label: "翻货袋", detail: "得到 3 件随机货物（要腾地方装）。",
        apply: (r) => { const got: GoodId[] = []; for (let i = 0; i < 3; i++) { const g = pick(r.rng, ["ash", "fang", "silk", "shell", "knot"] as GoodId[]); got.push(g); addGood(r, g); } return "你翻出三件货。"; } },
      { label: "只拿钱袋", detail: "得到 12 石。", apply: (r) => { r.gold += 12; r.stats.goldEarned += 12; return "钱袋里有 12 石。"; } },
    ],
  },
  ratnest: {
    id: "ratnest", title: "鼠窝", sprite: "rock",
    text: "石缝里是灯鼠的窝，里面堆着它们抢来的东西。伸手进去会被咬。",
    options: [
      { label: "掏窝", detail: "失去 5 气血，得到 2 件货，可能有灯芯。",
        apply: (r) => { hurt(r, 5); addGood(r, "fang"); addGood(r, chance(r.rng, 0.5) ? "wick" : "ash"); return "你被咬了一口，掏出两件货。"; } },
      leave,
    ],
  },
  thorn: {
    id: "thorn", title: "荆棘碑", sprite: "stele-thorn",
    text: "缠满荆棘的石碑下压着一件法宝。要拿出来，就得让荆棘扎进手里。",
    options: [
      { label: "硬拿", detail: "失去 9 气血，得到一件随机法宝。",
        apply: (r) => { hurt(r, 9); const id = randomRelic(r); if (!id) return "碑下什么也没有。"; gainRelic(r, id); return `你拿到了「${RELICS[id].name}」：${RELICS[id].text}`; } },
      leave,
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);
