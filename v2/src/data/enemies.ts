import type { CombatState, EnemyState, GoodId, Intent } from "../game/types";
import type { RngState } from "../game/rng";
import { next } from "../game/rng";

export interface EnemyDef {
  id: string;
  name: string;
  sprite: string;
  /** Second sprite used after a phase change. */
  sprite2?: string;
  /** Pose shown while lunging at the player. */
  spriteAttack?: string;
  /** Pose shown while its intent is a guard stance. */
  spriteStance?: string;
  hp: [number, number];
  gold: [number, number];
  drops: { good: GoodId; chance: number }[];
  /** A fragile part: one hit of `threshold`+ damage breaks it. */
  part?: { label: string; good: GoodId; broken: GoodId; threshold: number };
  moves: Record<string, Omit<Intent, "key">>;
  /** Choose the next move key. `e.history` holds earlier keys, newest last. */
  ai: (e: EnemyState, r: RngState) => string;
  /** One line shown before and during the fight: what it does, in plain words. */
  blurb: string;
  /** Extra loot for fighting a certain way. `state` drives the live label, `got` is checked on the kill. */
  harvest?: {
    label: string;
    text: string;
    good: GoodId | "stolen";
    state: (c: CombatState) => "done" | "open" | "risk" | "failed";
    got: (c: CombatState) => boolean;
  };
  /** Steals then runs: kill it before it gets away to get the goods back. */
  stealFlees?: boolean;
  /** No single hit can deal more than this. */
  maxHit?: number;
  /** Cards with this tag deal double damage to it. */
  weakTo?: "fire";
  /** Thorns it starts the fight with. */
  thorns?: number;
  /** Extra damage per hit depending on the run (e.g. your lamp oil). */
  dmgMod?: (oil: number) => number;
  /** Only shows up through events. */
  eventOnly?: boolean;
  phase2?: { at: number; sprite: string; str: number; text: string; ai: (e: EnemyState, r: RngState) => string };
  scale?: number;
}

const cycle = (keys: string[]) => (e: EnemyState) => keys[e.history.length % keys.length];
const last = (e: EnemyState) => e.history[e.history.length - 1];

export const ENEMIES: Record<string, EnemyDef> = {
  moth: {
    id: "moth", name: "纸灯蛾", sprite: "moth", hp: [15, 18], gold: [6, 9],
    drops: [{ good: "ash", chance: 1 }, { good: "silk", chance: 0.5 }],
    moves: { swoop: { name: "扑火", dmg: 6 }, dust: { name: "撒鳞粉", dmg: 3, apply: { status: "weak", n: 1 } } },
    ai: (e, r) => (last(e) === "swoop" ? "dust" : last(e) === "dust" ? "swoop" : next(r) < 0.5 ? "swoop" : "dust"),
    blurb: "偷灯油的纸蛾。撒的鳞粉会让你虚弱（伤害 -25%）。",
    harvest: { label: "灯芯", good: "wick", text: "完整挡下它一次攻击，再击倒它",
      state: (c) => (c.fullBlocks > 0 ? "done" : "open"), got: (c) => c.fullBlocks > 0 },
  },
  rat: {
    id: "rat", name: "灯鼠", sprite: "rat", spriteAttack: "rat-swipe", stealFlees: true, hp: [13, 16], gold: [7, 10],
    drops: [{ good: "fang", chance: 0.7 }, { good: "ash", chance: 0.5 }],
    moves: {
      grab: { name: "掀货筐", dmg: 5, steal: true }, bite: { name: "啃咬", dmg: 3, hits: 2 },
      flee: { name: "钻洞逃跑", flee: true, text: "叼着货往洞里钻。这回合不打死它，它就带着货跑了。" },
    },
    ai: cycle(["grab", "bite", "bite"]),
    blurb: "专抢货的鼠妖。掀货筐时只要有伤害打穿格挡，就会叼走你行囊里最值钱的一件货，下回合钻洞逃跑。",
    harvest: { label: "追回货物", good: "stolen", text: "被抢了也别慌：在它钻进洞之前打死它，货就能拿回来",
      state: (c) => (c.stolen.length ? "risk" : "open"), got: (c) => c.stolen.length > 0 },
  },
  louse: {
    id: "louse", name: "书虱", sprite: "louse", hp: [20, 24], gold: [7, 11], scale: 1.1,
    drops: [{ good: "shell", chance: 0.8 }],
    moves: { curl: { name: "缩壳", block: 7, dmg: 3 }, chew: { name: "啃书", dmg: 9 } },
    ai: cycle(["curl", "chew"]),
    blurb: "皮厚的长虫。缩壳回合格挡很高，留着大招等它啃书时再打。",
    harvest: { label: "完整墨壳", good: "shell", text: "别在它「缩壳」的回合打死它，壳会裂",
      state: (c) => (c.enemy.intent.key === "curl" ? "risk" : "open"), got: (c) => c.enemy.intent.key !== "curl" },
  },
  "mirror-fox": {
    id: "mirror-fox", name: "镜狐", sprite: "mirror-fox", hp: [38, 42], gold: [16, 22],
    drops: [{ good: "knot", chance: 0.4 }],
    part: { label: "颈扣", good: "clasp", broken: "clasp-broken", threshold: 10 },
    moves: {
      mirror: { name: "照镜", block: 6, str: 2 }, pounce: { name: "飞扑", dmg: 11 }, claw: { name: "抓挠", dmg: 4, hits: 2 },
    },
    ai: cycle(["mirror", "pounce", "claw"]),
    blurb: "颈下挂着铜扣。单次伤害到 10 点会把扣打碎；想要完整狐扣，就用多段的小伤害磨死它。",
  },
  "moth-queen": {
    id: "moth-queen", name: "灯蛾娘", sprite: "moth-queen", hp: [64, 64], gold: [30, 30], scale: 1.25,
    drops: [{ good: "wick", chance: 1 }, { good: "silk", chance: 1 }],
    moves: {
      flutter: { name: "扑翅", dmg: 5, hits: 2 }, ignite: { name: "焚翅", charge: { threshold: 12, then: "blaze" }, text: "正在点燃翅膀。本回合打出 12 点伤害可以打断它。" },
      blaze: { name: "烈焰", dmg: 20 }, call: { name: "召灯", block: 10, str: 1 }, dust: { name: "撒鳞粉", dmg: 4, apply: { status: "weak", n: 2 } },
    },
    ai: cycle(["flutter", "ignite", "call", "dust", "ignite", "flutter"]),
    blurb: "照影廊的守关妖。焚翅之后会放出 20 点烈焰——蓄力那回合打够伤害就能打断。",
    harvest: { label: "多一截灯芯", good: "wick", text: "至少打断一次「焚翅」",
      state: (c) => (c.interrupts > 0 ? "done" : "open"), got: (c) => c.interrupts > 0 },
  },
  warden: {
    id: "warden", name: "守门黑狐", sprite: "warden", hp: [72, 76], gold: [24, 30], scale: 1.2,
    drops: [{ good: "knot", chance: 1 }, { good: "knot", chance: 0.5 }],
    moves: {
      fang: { name: "獠牙", dmg: 13 }, howl: { name: "嚎叫", str: 3, block: 6 }, maul: { name: "撕咬", dmg: 6, hits: 2 }, gate: { name: "护门", block: 14, dmg: 5 },
    },
    ai: (e) => {
      const seq = ["howl", "fang", "maul", "gate", "fang", "maul"];
      return seq[e.history.length % seq.length];
    },
    blurb: "守桥的黑狐，力量会一层层叠上去。拖得越久，獠牙越疼。",
    harvest: { label: "完整狐毛结", good: "knot", text: "在它力量叠到 6 层之前打倒它",
      state: (c) => ((c.enemy.status.str ?? 0) >= 6 ? "failed" : "open"), got: (c) => (c.enemy.status.str ?? 0) < 6 },
  },
  "night-fox": {
    id: "night-fox", name: "夜市狐", sprite: "night-fox", hp: [108, 108], gold: [40, 40], scale: 1.3,
    drops: [{ good: "knot", chance: 1 }, { good: "wick", chance: 1 }],
    part: { label: "狐扣", good: "clasp", broken: "clasp-broken", threshold: 12 },
    moves: {
      wisp: { name: "狐火", dmg: 4, hits: 3 }, charm: { name: "迷魂", dmg: 6, apply: { status: "vuln", n: 2 } },
      coil: { name: "蓄尾", charge: { threshold: 16, then: "sweep" }, block: 8, text: "九条尾巴在收紧。本回合打出 16 点伤害可以打断它。" },
      sweep: { name: "九尾扫", dmg: 26 }, snatch: { name: "掀摊", dmg: 9, steal: true },
    },
    ai: cycle(["wisp", "snatch", "coil", "charm", "wisp", "coil"]),
    blurb: "桥驿夜市的主人。会掀摊抢货，蓄尾后的九尾扫有 26 点伤害。颈下的狐扣单次 12 伤会碎。",
  },
  bell: {
    id: "bell", name: "负钟君", sprite: "bell", sprite2: "bell-heavy", hp: [180, 180], gold: [0, 0], scale: 1.35,
    drops: [{ good: "copper", chance: 1 }],
    moves: {
      ring: { name: "摇铃", dmg: 7, apply: { status: "weak", n: 1 } }, shell: { name: "铜壳", block: 16, dmg: 4 },
      wind: { name: "蓄钟", charge: { threshold: 20, then: "drop" }, text: "钟在往上提。本回合打出 20 点伤害可以打断它。" },
      drop: { name: "钟落", dmg: 32 }, quake: { name: "铃震", dmg: 5, hits: 3 }, crack: { name: "碎铃", dmg: 11, steal: true },
    },
    ai: cycle(["ring", "shell", "wind", "quake", "ring", "wind"]),
    phase2: {
      at: 0.5, sprite: "bell-heavy", str: 3, text: "负钟君撞碎了外壳，露出里面的铜身。力量 +3，蓄钟更频繁。",
      ai: (e) => ["crack", "wind", "quake", "wind", "ring"][e.history.length % 5],
    },
    blurb: "塔顶的钟妖。蓄钟后的钟落有 32 点伤害；半血后会撞碎外壳，变得更凶。",
    harvest: { label: "多一片钟铜", good: "copper", text: "至少打断一次「蓄钟」",
      state: (c) => (c.interrupts > 0 ? "done" : "open"), got: (c) => c.interrupts > 0 },
  },

  // ================= new monsters (placeholder art until docs/美术需求.md is filled) =================
  "lantern-spirit": {
    id: "lantern-spirit", name: "引魂灯", sprite: "lantern-spirit", hp: [14, 17], gold: [6, 9],
    drops: [{ good: "ash", chance: 0.6 }],
    moves: {
      sip: { name: "吸灯油", dmg: 4, drainOil: 10, text: "" }, glare: { name: "照魂", dmg: 3, apply: { status: "weak", n: 1 } },
      flare: { name: "灯焰", dmg: 7 },
    },
    ai: cycle(["sip", "glare", "flare"]),
    blurb: "飘着的旧灯笼，专吸活人的灯油。被它咬中会少 10 点灯油。",
    harvest: { label: "灯芯", good: "wick", text: "一滴灯油都别让它吸到，再打倒它",
      state: (c) => (c.oilDrained > 0 ? "failed" : "open"), got: (c) => c.oilDrained === 0 },
  },
  "paper-doll": {
    id: "paper-doll", name: "纸人童", sprite: "paper-doll", hp: [20, 24], gold: [6, 9], weakTo: "fire",
    drops: [{ good: "ash", chance: 0.4 }],
    moves: { paste: { name: "糊纸", block: 6, dmg: 3 }, slice: { name: "纸刃", dmg: 4, hits: 2 } },
    ai: cycle(["slice", "paste"]),
    blurb: "纸扎铺丢掉的纸人，夜里自己走了进来。怕火：扬灰、灯火对它伤害翻倍。",
    harvest: { label: "红纸", good: "redpaper", text: "别用带火的牌打出最后一下，纸会烧掉",
      state: (c) => (c.lastTags.includes("fire") ? "risk" : "open"), got: (c) => !c.lastTags.includes("fire") },
  },
  "fire-rat": {
    id: "fire-rat", name: "火鼠", sprite: "fire-rat", spriteAttack: "rat-swipe", hp: [15, 18], gold: [7, 10],
    drops: [{ good: "fang", chance: 0.6 }, { good: "ash", chance: 0.3 }],
    moves: { gnaw: { name: "啃灰", dmg: 4, eatAsh: 2 }, scurry: { name: "窜咬", dmg: 3, hits: 3 } },
    ai: cycle(["gnaw", "scurry"]),
    blurb: "背上冒火星的鼠妖，饿了就啃灯灰。啃灰那下打穿格挡，会吃掉你 2 份灯灰。",
    harvest: { label: "火鼠毛", good: "fur", text: "一份灯灰都没被它吃掉，再打倒它",
      state: (c) => (c.ashEaten > 0 ? "failed" : "open"), got: (c) => c.ashEaten === 0 },
  },
  "ink-moth": {
    id: "ink-moth", name: "墨蛾", sprite: "ink-moth", hp: [16, 19], gold: [7, 10],
    drops: [{ good: "silk", chance: 0.4 }, { good: "ash", chance: 0.5 }],
    moves: {
      ink: { name: "吐墨", dmg: 3, apply: { status: "blind", n: 1 } }, dive: { name: "扑", dmg: 7 },
      dust: { name: "撒粉", dmg: 2, apply: { status: "vuln", n: 1 } },
    },
    ai: cycle(["ink", "dive", "dust", "dive"]),
    blurb: "吃墨长大的蛾子。吐墨糊住你的眼睛，下回合少抽一张牌。",
    harvest: { label: "墨粉", good: "inkdust", text: "别被它的墨糊到眼睛，再打倒它",
      state: (c) => (c.blinded > 0 ? "failed" : "open"), got: (c) => c.blinded === 0 },
  },
  "water-ghost": {
    id: "water-ghost", name: "水鬼", sprite: "water-ghost", hp: [26, 30], gold: [9, 13], scale: 1.1,
    drops: [{ good: "shell", chance: 0.3 }, { good: "ash", chance: 0.3 }],
    moves: {
      sink: { name: "潜水", dive: true, block: 4, text: "沉到桥下的水里。这回合你的攻击只有一半伤害，下回合它会扑出来。" },
      lunge: { name: "扑出水面", dmg: 13 }, drag: { name: "拖拽", dmg: 5, hits: 2 },
    },
    ai: (e) => (last(e) === "sink" ? "lunge" : last(e) === "lunge" ? "drag" : "sink"),
    blurb: "桥下的水鬼。潜水的回合打它只有一半伤害，不如先架好格挡等它扑出来。",
    harvest: { label: "水珠", good: "pearl", text: "在它浮出水面（不在潜水）的回合打倒它",
      state: (c) => (c.enemy.intent.dive ? "risk" : "open"), got: (c) => !c.enemy.intent.dive },
  },
  "stele-spirit": {
    id: "stele-spirit", name: "碑灵", sprite: "stele-spirit", hp: [34, 38], gold: [10, 14], scale: 1.1,
    drops: [{ good: "rubbing", chance: 0.3 }],
    moves: {
      raise: { name: "立碑", block: 16 }, press: { name: "镇压", dmg: 13 }, carve: { name: "刻符", str: 2, block: 6 },
    },
    ai: cycle(["raise", "press", "carve", "press"]),
    blurb: "活过来的石碑，一回合立起厚厚的碑面，一回合砸下来，越拖越重。",
    harvest: { label: "碑拓", good: "rubbing", text: "五个回合之内打倒它，字还没被它磨平",
      state: (c) => (c.turn > 5 ? "failed" : "open"), got: (c) => c.turn <= 5 },
  },
  fallen: {
    id: "fallen", name: "堕道者", sprite: "fallen", spriteAttack: "fallen-strike", spriteStance: "fallen-guard",
    hp: [70, 74], gold: [26, 32], scale: 1.2,
    drops: [{ good: "token", chance: 0.3 }],
    moves: {
      stance: { name: "起势", block: 10, counter: 4, text: "摆出架势。这回合你每打它一下，自己挨 4 点。" },
      cut: { name: "斩", dmg: 14 }, twin: { name: "连斩", dmg: 6, hits: 2 },
      gather: { name: "蓄刀", charge: { threshold: 18, then: "sever" }, text: "刀举过了头顶。本回合打出 18 点伤害可以打断它。" },
      sever: { name: "一刀两断", dmg: 26 },
    },
    ai: cycle(["stance", "cut", "twin", "gather", "stance", "twin"]),
    blurb: "走火入魔的斩妖人，用的是和你一样的剑法。起势的回合硬打会被反手划伤。",
    harvest: { label: "斩妖令", good: "token", text: "别在它起势的回合出手攻击",
      state: (c) => (c.guardHits > 0 ? "failed" : c.enemy.intent.counter ? "risk" : "open"), got: (c) => c.guardHits === 0 },
  },
  "thorn-stele": {
    id: "thorn-stele", name: "棘碑", sprite: "thorn-stele", hp: [40, 44], gold: [11, 15], thorns: 2, scale: 1.1,
    drops: [{ good: "rubbing", chance: 0.4 }],
    moves: {
      grow: { name: "生棘", thorns: 1, block: 8 }, smash: { name: "砸", dmg: 10 }, rain: { name: "棘雨", dmg: 3, hits: 3 },
    },
    ai: cycle(["smash", "grow", "rain", "smash"]),
    blurb: "缠满荆棘的石碑。你每打它一下，自己都要被扎（看它的「反震」层数）。少出几刀、刀刀要重。",
    harvest: { label: "碑拓", good: "rubbing", text: "用一下 12 点以上的重击打出最后一下",
      state: () => "open", got: (c) => c.lastHit >= 12 },
  },
  "bronze-puppet": {
    id: "bronze-puppet", name: "铜傀", sprite: "bronze-puppet", hp: [44, 48], gold: [11, 15], maxHit: 8, scale: 1.15,
    drops: [{ good: "shard", chance: 0.6 }],
    moves: {
      wind: { name: "上弦", charge: { threshold: 14, then: "hammer" }, block: 6, text: "背后的发条在转。本回合打出 14 点伤害可以打断它。" },
      hammer: { name: "重锤", dmg: 22 }, swing: { name: "抡臂", dmg: 7, hits: 2 },
    },
    ai: cycle(["swing", "wind", "swing"]),
    blurb: "钟楼的铜傀儡。铜身太硬，单次最多只吃 8 点伤害——用多段攻击。",
    harvest: { label: "铜片", good: "shard", text: "至少打断一次「上弦」",
      state: (c) => (c.interrupts > 0 ? "done" : "open"), got: (c) => c.interrupts > 0 },
  },
  "night-owl": {
    id: "night-owl", name: "夜枭", sprite: "night-owl", hp: [36, 40], gold: [10, 14], scale: 1.1,
    drops: [{ good: "feather", chance: 0.3 }],
    dmgMod: (oil) => (oil < 30 ? 3 : oil >= 60 ? -2 : 0),
    moves: { swoop: { name: "俯冲", dmg: 5, hits: 2 }, shriek: { name: "夜啼", dmg: 4, apply: { status: "vuln", n: 1 } }, talon: { name: "利爪", dmg: 11 } },
    ai: cycle(["swoop", "shriek", "talon"]),
    blurb: "怕光的夜枭。你灯油不少于 60 时它每下少打 2 点；少于 30 时多打 3 点。",
    harvest: { label: "枭羽", good: "feather", text: "灯油不少于 60 时打倒它",
      state: (c) => (c.oil >= 60 ? "open" : "failed"), got: (c) => c.oil >= 60 },
  },
  "fake-fox": {
    id: "fake-fox", name: "假狐商", sprite: "fake-fox", hp: [92, 96], gold: [36, 44], scale: 1.25, eventOnly: true,
    drops: [{ good: "knot", chance: 1 }, { good: "clasp-broken", chance: 0.5 }],
    moves: {
      charm: { name: "迷魂", dmg: 6, apply: { status: "weak", n: 2 } }, collect: { name: "收账", dmg: 9, stealGold: 12 },
      wisp: { name: "狐火", dmg: 4, hits: 3 },
      flip: { name: "掀摊", charge: { threshold: 16, then: "lash" }, block: 6, text: "摊子底下的尾巴全露出来了。本回合打出 16 点伤害可以打断它。" },
      lash: { name: "九尾抽", dmg: 24 },
    },
    ai: cycle(["charm", "collect", "flip", "wisp", "collect"]),
    blurb: "冒充绯绡摆摊的白狐。「收账」打穿格挡会抢走你 12 石。",
    harvest: { label: "白狐尾", good: "tail", text: "一个石头都别让它收走",
      state: (c) => (c.goldStolen > 0 ? "failed" : "open"), got: (c) => c.goldStolen === 0 },
  },
};

/** Which enemies show up on each floor, with tuning. */
export interface Spawn { id: string; hp: number; dmg: number }
export const FLOOR_SPAWNS: Record<1 | 2 | 3, { normal: Spawn[]; elite: Spawn[]; guardian: Spawn }> = {
  1: {
    normal: [{ id: "moth", hp: 1, dmg: 0 }, { id: "rat", hp: 1, dmg: 0 }, { id: "louse", hp: 1, dmg: 0 },
      { id: "lantern-spirit", hp: 1, dmg: 0 }, { id: "paper-doll", hp: 1, dmg: 0 }],
    elite: [{ id: "mirror-fox", hp: 1, dmg: 0 }],
    guardian: { id: "moth-queen", hp: 1, dmg: 0 },
  },
  2: {
    normal: [{ id: "rat", hp: 2.1, dmg: 3 }, { id: "louse", hp: 1.8, dmg: 3 }, { id: "moth", hp: 2.1, dmg: 3 }, { id: "mirror-fox", hp: 0.95, dmg: 2 },
      { id: "fire-rat", hp: 2, dmg: 3 }, { id: "ink-moth", hp: 2, dmg: 3 }, { id: "water-ghost", hp: 1.6, dmg: 2 }, { id: "stele-spirit", hp: 1.1, dmg: 2 }],
    elite: [{ id: "warden", hp: 1, dmg: 0 }, { id: "fallen", hp: 1, dmg: 0 }],
    guardian: { id: "night-fox", hp: 1, dmg: 0 },
  },
  3: {
    normal: [{ id: "mirror-fox", hp: 1.35, dmg: 5 }, { id: "louse", hp: 2.7, dmg: 6 }, { id: "rat", hp: 3.2, dmg: 6 }, { id: "warden", hp: 0.9, dmg: 2 },
      { id: "thorn-stele", hp: 1.2, dmg: 3 }, { id: "bronze-puppet", hp: 1.2, dmg: 3 }, { id: "night-owl", hp: 1.3, dmg: 3 }, { id: "ink-moth", hp: 3, dmg: 6 }],
    elite: [{ id: "night-fox", hp: 1, dmg: 4 }, { id: "warden", hp: 1.5, dmg: 5 }, { id: "fallen", hp: 1.3, dmg: 4 }],
    guardian: { id: "bell", hp: 1, dmg: 0 },
  },
};
