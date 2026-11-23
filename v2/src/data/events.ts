import { addGood, gainRelic, randomRelic } from "../game/inventory";
import * as bag from "../game/bag";
import { type RngState, chance, int, makeRng, pick, shuffle } from "../game/rng";
import { distances, reveal } from "../game/dungeon";
import { FLOOR_SPAWNS } from "./enemies";
import { GEAR_IDS, GOODS } from "./goods";
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
  /** Fixed options, or options built from the run (shop-like events). `r` is seeded per event so they stay stable. */
  options: EventOption[] | ((run: RunState, r: RngState) => EventOption[]);
  /** Only appears from this floor up. */
  minFloor?: number;
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

  // ================= new events (placeholder art; descriptions in docs/美术需求.md) =================
  portal: {
    id: "portal", title: "传送阵", sprite: "portal",
    text: "地上刻着一圈还在发光的阵纹，不知道是哪位前辈留下的。站上去，会被送到这一层的别处。",
    options: [
      { label: "踏进去", detail: "被送到这一层还没去过的地方，省下走路的灯油。落地处的四周会被照亮。",
        apply: (r) => (teleport(r) ? "一阵晕眩之后，你站在了陌生的走廊里。" : "阵纹闪了两下，熄了。这层已经没有你没去过的地方。") },
      { label: "拆下阵眼", detail: "阵就废了，但阵眼里嵌着一截灯芯。", apply: (r) => { addGood(r, "wick"); return "你撬下阵眼，得到一截灯芯。阵纹暗了下去。"; } },
      leave,
    ],
  },
  scavenge: {
    id: "scavenge", title: "妖窝拾荒", sprite: "event-den",
    text: "塌了一半的墙洞里是妖怪的窝，窝主不在。里面堆着它从各处叼来的东西。翻得越久捡得越多，但窝主随时会回来。",
    options: [
      { label: "随手捡一件", detail: "安全。得到 1 件随机货。", apply: (r) => { const g = randomGood(r); addGood(r, g); return `你捡起一件${GOODS[g].name}，悄悄退了出来。`; } },
      { label: "仔细翻", detail: "得到 3 件随机货，然后窝主回来了——打一场这层的普通战斗。",
        apply: (r) => {
          const got = [randomGood(r), randomGood(r), randomGood(r)];
          for (const g of got) addGood(r, g);
          const spawn = pick(r.rng, FLOOR_SPAWNS[r.floor].normal.filter((s) => !s.id.includes("fox")));
          r.eventFight = { enemy: spawn.id, kind: "fight", hpMul: spawn.hp, dmgAdd: spawn.dmg };
          return `你翻出了${got.map((g) => GOODS[g].name).join("、")}。身后传来一声低吼——窝主回来了。`;
        } },
      leave,
    ],
  },
  ratpeddler: {
    id: "ratpeddler", title: "灯鼠货郎", sprite: "event-peddler",
    text: "一只背着大包袱的灯鼠冲你作揖。它不抢东西，它卖别的鼠抢来的东西，价钱好商量。只做一笔买卖。",
    options: (_run, rr) => {
      const goods = shuffle(rr, ["fang", "silk", "shell", "knot", "wick", "fur", "inkdust"] as GoodId[]).slice(0, 2);
      const gear = pick(rr, GEAR_IDS.filter((id) => GOODS[id].tier === 1));
      const offers = [...goods, gear].map((id) => ({ id, price: Math.max(2, Math.round(GOODS[id].price * (GOODS[id].kind === "gear" ? 1.2 : 0.7))) }));
      return [
        ...offers.map((o): EventOption => ({
          label: `买${GOODS[o.id].name}`, detail: `${o.price} 石。${GOODS[o.id].kind === "gear" ? "装备，牌：" + (GOODS[o.id].cards ?? []).length + " 张。" : "狐市一般收 " + GOODS[o.id].price + " 石左右。"}`,
          locked: (r) => (r.gold < o.price ? "石不够" : !bag.findSpot(r.bag, o.id) ? "行囊放不下" : null),
          apply: (r) => { r.gold -= o.price; addGood(r, o.id); return `灯鼠把${GOODS[o.id].name}递给你，数了三遍钱。`; },
        })),
        leave,
      ];
    },
  },
  fakefox: {
    id: "fakefox", title: "可疑的白狐摊", sprite: "fake-fox", minFloor: 2,
    text: "又一个狐市？摊主也是个狐女，可尾巴是白的，货价便宜得出奇。绯绡说过，塔里只有她一家狐市。",
    options: [
      { label: "买便宜货", detail: "花 8 石，得到 2 件货——不过其中一件可能是假的。", locked: (r) => (r.gold < 8 ? "石不够" : null),
        apply: (r) => {
          r.gold -= 8;
          const a = randomGood(r); addGood(r, a);
          if (chance(r.rng, 0.5)) { const b = randomGood(r); addGood(r, b); return `你买到了${GOODS[a].name}和${GOODS[b].name}，居然都是真的。`; }
          return `你买到了${GOODS[a].name}。另一件一出摊子就化成了一把树叶。`;
        } },
      { label: "揭穿它", detail: "打一场精英战（假狐商）。赢了拿走它的摊子。",
        apply: (r) => { r.eventFight = { enemy: "fake-fox", kind: "elite", hpMul: r.floor === 2 ? 0.8 : 1, dmgAdd: r.floor === 2 ? 0 : 3 }; return "你一刀挑开摊布，底下是九条白尾巴。它不笑了。"; } },
      leave,
    ],
  },
  cart: {
    id: "cart", title: "翻倒的货车", sprite: "event-cart",
    text: "一辆货车翻在路边，货撒了一地。车主坐在旁边发呆，腿上有伤。",
    options: [
      { label: "翻找车上的货", detail: "花时间（灯油 -12），得到 3 件货。车主不会拦你。",
        apply: (r) => { r.oil = Math.max(0, r.oil - 12); const got = [randomGood(r), randomGood(r), randomGood(r)]; for (const g of got) addGood(r, g); return `你挑走了${got.map((g) => GOODS[g].name).join("、")}。车主没有抬头。`; } },
      { label: "帮他把车扶起来", detail: "失去 4 气血，车主谢你 15 石和一瓶金疮药。",
        apply: (r) => { hurt(r, 4); r.gold += 15; r.stats.goldEarned += 15; addGood(r, "salve"); return "你扛起车辕，车主连声道谢，塞给你 15 石和一瓶药。"; } },
      leave,
    ],
  },
  hurthunter: {
    id: "hurthunter", title: "受伤的斩妖人", sprite: "event-hunter",
    text: "一位同行靠墙坐着，剑横在膝上，伤得不轻。他说自己守了这层三天，再走不动了。",
    options: [
      { label: "给他一瓶金疮药", detail: "他把随身的法宝送给你。", locked: (r) => (bag.count(r.bag, "salve") ? null : "你没有金疮药"),
        apply: (r) => { bag.removeOne(r.bag, "salve"); const id = randomRelic(r); if (!id) return "他谢过你，可身上已经什么都没有了。"; gainRelic(r, id); return `他把「${RELICS[id].name}」塞进你手里：${RELICS[id].text}`; } },
      { label: "分他 10 石", detail: "他教你两招：随机升级牌组里的 2 张牌。", locked: (r) => (r.gold < 10 ? "石不够" : null),
        apply: (r) => {
          r.gold -= 10;
          const cards = shuffle(r.rng, r.deck.filter((c) => !c.up)).slice(0, 2);
          for (const c of cards) c.up = true;
          return cards.length ? `他比划了两下，你的「${cards.map((c) => c.id === "strike" ? "斩" : c.id === "defend" ? "架" : "招式").join("」「")}」更利落了。` : "你的招式他已经教不了了。";
        } },
      leave,
    ],
  },
  oilshrine: {
    id: "oilshrine", title: "灯神龛", sprite: "event-shrine",
    text: "墙里嵌着一座小小的灯神龛，供桌上的灯还亮着。镇上的人说，给灯神上供，灯就不会灭。",
    options: [
      { label: "供 2 份灯灰", detail: "灯油上限 +20，并添满灯油。", locked: (r) => (bag.count(r.bag, "ash") >= 2 ? null : "灯灰不够 2 份"),
        apply: (r) => { bag.removeOne(r.bag, "ash"); bag.removeOne(r.bag, "ash"); r.maxOil += 20; r.oil = r.maxOil; return `灯神龛的灯亮了一下。你的灯更大了（上限 ${r.maxOil}），也添满了。`; } },
      { label: "供 10 石", detail: "灯油 +40。", locked: (r) => (r.gold < 10 ? "石不够" : null),
        apply: (r) => { r.gold -= 10; const a = Math.min(40, r.maxOil - r.oil); r.oil += a; return `灯油 +${a}。`; } },
      leave,
    ],
  },
  mirrorpool: {
    id: "mirrorpool", title: "照影池", sprite: "event-pool",
    text: "地上一洼水，平得像镜子。水里的你也拿着剑——它比你慢半拍。",
    options: [
      { label: "照一照", detail: "失去 5 气血，复制牌组里的 1 张牌。", apply: (r) => { hurt(r, 5); r.cardPick = { mode: "copy", source: "event" }; return "选一张牌，水里的你会学会它。"; } },
      { label: "洗把脸", detail: "回复 6 气血。", apply: (r) => { const a = Math.min(6, r.maxHp - r.hp); r.hp += a; return `池水很凉。回复 ${a} 气血。`; } },
      leave,
    ],
  },
};

export const EVENT_IDS = Object.keys(EVENTS);

/** A random trade good that fits the floor you're on. */
function randomGood(r: RunState): GoodId {
  const pools: Record<number, GoodId[]> = {
    1: ["ash", "ash", "fang", "silk", "shell", "redpaper"],
    2: ["ash", "fang", "silk", "shell", "knot", "fur", "inkdust", "pearl"],
    3: ["ash", "shell", "knot", "wick", "rubbing", "shard", "feather", "inkdust"],
  };
  return pick(r.rng, pools[r.floor]);
}

/** Jump to a floor tile you haven't seen, at least 5 steps away. */
function teleport(r: RunState): boolean {
  const d = r.dungeon;
  const dist = distances(d, r.pos);
  const free = (x: number, y: number) => !d.tiles[y * d.w + x] && !d.entities.some((e) => e.x === x && e.y === y && !e.done);
  let options: { x: number; y: number }[] = [];
  for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (free(x, y) && dist[y * d.w + x] >= 5 && !d.seen[y * d.w + x]) options.push({ x, y });
  if (!options.length) for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) if (free(x, y) && dist[y * d.w + x] >= 5) options.push({ x, y });
  if (!options.length) return false;
  const to = options[int(r.rng, 0, options.length - 1)];
  r.pos = { ...r.pos, x: to.x, y: to.y };
  reveal(d, to.x, to.y);
  r.warp++;
  return true;
}

/** Options for the event currently open (stable for that event). */
export function eventOptions(run: RunState, id: string, seed: number): EventOption[] {
  const ev = EVENTS[id];
  return typeof ev.options === "function" ? ev.options(run, makeRng(seed)) : ev.options;
}
