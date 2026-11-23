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
};

/** Which enemies show up on each floor, with tuning. */
export interface Spawn { id: string; hp: number; dmg: number }
export const FLOOR_SPAWNS: Record<1 | 2 | 3, { normal: Spawn[]; elite: Spawn[]; guardian: Spawn }> = {
  1: {
    normal: [{ id: "moth", hp: 1, dmg: 0 }, { id: "rat", hp: 1, dmg: 0 }, { id: "louse", hp: 1, dmg: 0 }],
    elite: [{ id: "mirror-fox", hp: 1, dmg: 0 }],
    guardian: { id: "moth-queen", hp: 1, dmg: 0 },
  },
  2: {
    normal: [{ id: "rat", hp: 2.1, dmg: 3 }, { id: "louse", hp: 1.8, dmg: 3 }, { id: "moth", hp: 2.1, dmg: 3 }, { id: "mirror-fox", hp: 0.95, dmg: 2 }],
    elite: [{ id: "warden", hp: 1, dmg: 0 }],
    guardian: { id: "night-fox", hp: 1, dmg: 0 },
  },
  3: {
    normal: [{ id: "mirror-fox", hp: 1.35, dmg: 5 }, { id: "louse", hp: 2.7, dmg: 6 }, { id: "rat", hp: 3.2, dmg: 6 }, { id: "warden", hp: 0.9, dmg: 2 }],
    elite: [{ id: "night-fox", hp: 1, dmg: 4 }, { id: "warden", hp: 1.5, dmg: 5 }],
    guardian: { id: "bell", hp: 1, dmg: 0 },
  },
};
