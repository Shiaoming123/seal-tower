import { describe, expect, it } from "vitest";
import { CARDS } from "../src/data/cards";
import { ENEMIES } from "../src/data/enemies";
import { EVENTS } from "../src/data/events";
import * as bag from "../src/game/bag";
import { endTurn, incomingDamage, playCard, startCombat } from "../src/game/combat";
import { distances, findPath, generate, idx, revealAll } from "../src/game/dungeon";
import { addGood, fromPouch, sellPouch, sewPiece, toPouch, useItem } from "../src/game/inventory";
import { climb, createRun, winCombat } from "../src/game/run";
import { FLOOR_SPAWNS } from "../src/data/enemies";
import { hearing } from "../src/game/dungeon";
import { makeRng } from "../src/game/rng";
import type { Entity, FloorNo, RunState } from "../src/game/types";

const fightWith = (run: RunState, enemy: string, kind: Entity["kind"] = "fight") => {
  const e: Entity = { id: 99, kind, x: run.pos.x, y: run.pos.y, enemy, done: false };
  run.dungeon.entities.push(e);
  run.at = 99;
  return startCombat(run, e, kind as "fight");
};
const handOf = (run: RunState, ids: string[]) => { run.combat!.hand = ids.map((id, i) => ({ uid: 500 + i, id, up: false })); };

describe("bag", () => {
  it("rotates shapes and respects bounds", () => {
    const b = { w: 2, h: 2, items: [] };
    expect(bag.shapeOf("fang", 0)).toEqual([[0, 0], [0, 1]]);
    expect(bag.shapeOf("fang", 1)).toEqual([[1, 0], [0, 0]]);
    expect(bag.fits(b, "copper", 0, 0, 0)).toBe(true);
    expect(bag.fits(b, "copper", 1, 0, 0)).toBe(false);
  });
  it("overflows into the pending pile instead of failing", () => {
    const run = createRun(1, "sword", "lamp");
    // 5×4 bag, the sword takes 3 cells
    for (let i = 0; i < 20; i++) addGood(run, "ash");
    expect(run.bag.items.length).toBe(18);
    expect(run.pending.length).toBe(3);
  });
});

describe("dungeon", () => {
  for (const floor of [1, 2, 3] as FloorNo[]) {
    it(`floor ${floor}: every entity is reachable and the guardian is far away`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const d = generate(floor, makeRng(seed));
        const dist = distances(d, d.start);
        const guardian = d.entities.find((e) => e.kind === "guardian")!;
        for (const e of d.entities) expect(dist[idx(d, e.x, e.y)]).toBeGreaterThan(0);
        const kinds = d.entities.map((e) => e.kind);
        for (const k of ["guardian", "rest", "shop", "elite", "chest", "event", "fight"]) expect(kinds).toContain(k);
        expect(dist[idx(d, guardian.x, guardian.y)]).toBeGreaterThanOrEqual(0.8 * Math.max(...d.entities.map((e) => dist[idx(d, e.x, e.y)])));
        revealAll(d);
        expect(findPath(d, d.start, guardian, true)).not.toBeNull();
      }
    });
  }
});

describe("combat", () => {
  it("deals damage and applies block", () => {
    const run = createRun(2, "shield", "lamp");
    const c = fightWith(run, "louse");
    const hp = c.enemy.hp;
    handOf(run, ["strike", "defend"]);
    playCard(run, 0);
    expect(c.enemy.hp).toBe(hp - 6);
    playCard(run, 0);
    expect(c.block).toBe(5);
  });

  it("rat steals the most valuable good only when damage gets through", () => {
    const run = createRun(3, "sword", "lamp");
    addGood(run, "ash"); addGood(run, "clasp");
    const c = fightWith(run, "rat");
    expect(c.enemy.intent.steal).toBe(true);
    handOf(run, []);
    c.block = 0;
    endTurn(run);
    expect(c.stolen).toEqual(["clasp"]);
    expect(bag.count(run.bag, "clasp")).toBe(0);
  });

  it("full block protects the cargo", () => {
    const run = createRun(3, "sword", "lamp");
    addGood(run, "clasp");
    const c = fightWith(run, "rat");
    handOf(run, ["defend", "defend"]);
    playCard(run, 0); playCard(run, 0);
    expect(c.block).toBeGreaterThanOrEqual(incomingDamage(run, c));
    endTurn(run);
    expect(c.stolen).toEqual([]);
    expect(bag.count(run.bag, "clasp")).toBe(1);
  });

  it("dealing the threshold during a charge interrupts it", () => {
    const run = createRun(4, "sword", "lamp");
    const c = fightWith(run, "moth-queen", "guardian");
    // second move of the queen is the charge
    handOf(run, []); endTurn(run);
    expect(c.enemy.intent.charge?.threshold).toBe(12);
    handOf(run, ["strike", "strike", "strike"]);
    playCard(run, 0); playCard(run, 0);
    const hp = run.hp;
    endTurn(run);
    // interrupted: the enemy lost its turn and the 20-damage blaze never comes
    expect(run.hp).toBe(hp);
    expect(c.enemy.intent.key).not.toBe("blaze");
    expect(c.enemy.queued).toBeNull();
  });

  it("big single hits break a fox's clasp, small hits keep it", () => {
    const run = createRun(5, "sword", "lamp");
    const c = fightWith(run, "mirror-fox", "elite");
    handOf(run, ["strike"]);
    playCard(run, 0);
    expect(c.enemy.partIntact).toBe(true);
    c.status.str = 5;
    handOf(run, ["strike"]);
    playCard(run, 0);
    expect(c.enemy.partIntact).toBe(false);
  });

  it("lamp cards burn goods and refuse to play without them", () => {
    const run = createRun(6, "lamp", "lamp");
    const c = fightWith(run, "moth");
    const ash = bag.count(run.bag, "ash");
    handOf(run, ["dust"]);
    expect(playCard(run, 0).ok).toBe(true);
    expect(bag.count(run.bag, "ash")).toBe(ash - 1);
    run.bag.items = [];
    handOf(run, ["dust"]);
    const res = playCard(run, 0);
    expect(res.ok).toBe(false);
    expect(res.reason).toContain("灯灰");
    expect(c.hand.length).toBe(1);
  });

  it("winning gives gold, goods and three card choices", () => {
    const run = createRun(7, "sword", "lamp");
    const c = fightWith(run, "moth");
    c.enemy.hp = 1;
    handOf(run, ["strike"]);
    playCard(run, 0);
    expect(c.over).toBe("win");
    winCombat(run);
    expect(run.reward!.cards!.length).toBe(3);
    expect(run.reward!.goods).toContain("ash");
  });
});

describe("data", () => {
  it("every card renders text for both versions", () => {
    for (const def of Object.values(CARDS)) for (const v of def.v) {
      const t = def.text(v, { dmg: (n) => n, ash: 2, gold: 10, block: 3, attacks: 1, inCombat: true, burn: 3, goods: 4 });
      expect(t).not.toMatch(/undefined|NaN/);
    }
  });
  it("every enemy move used by its AI exists", () => {
    for (const def of Object.values(ENEMIES)) {
      const e = { history: [] as string[] } as never as Parameters<typeof def.ai>[0];
      for (let i = 0; i < 12; i++) { const k = def.ai(e, makeRng(i)); expect(def.moves[k], `${def.id}.${k}`).toBeTruthy(); e.history.push(k); }
      for (const m of Object.values(def.moves)) if (m.charge) expect(def.moves[m.charge.then]).toBeTruthy();
    }
  });
  it("every event has at least one option that is always available", () => {
    for (const ev of Object.values(EVENTS)) {
      const run = createRun(1, "sword", "lamp");
      const opts = typeof ev.options === "function" ? ev.options(run, makeRng(1)) : ev.options;
      expect(opts.some((o) => !o.locked), ev.id).toBe(true);
    }
  });
});

describe("gear", () => {
  it("weapons in the bag add their cards to the fight deck", async () => {
    const { combatDeck } = await import("../src/game/combat");
    const run = createRun(8, "sword", "lamp");
    expect(combatDeck(run).map((c) => c.id)).toEqual(expect.arrayContaining(["unison", "twin"]));
    run.bag.items = run.bag.items.filter((i) => i.id !== "sword");
    expect(combatDeck(run).map((c) => c.id)).not.toContain("unison");
  });
  it("thieves never take gear", () => {
    const run = createRun(9, "sword", "lamp");
    expect(bag.mostValuable(run.bag)).toBeNull();
  });
});

describe("harvest", () => {
  it("rat that steals runs away next turn unless killed, and killing it recovers the goods", () => {
    const run = createRun(3, "sword", "lamp");
    addGood(run, "clasp");
    const c = fightWith(run, "rat");
    handOf(run, []);
    endTurn(run);
    expect(c.stolen).toEqual(["clasp"]);
    expect(c.enemy.intent.flee).toBe(true);
    // kill it before it escapes
    c.enemy.hp = 1;
    handOf(run, ["strike"]);
    playCard(run, 0);
    winCombat(run);
    expect(run.reward!.goods).toContain("clasp");
  });
  it("a rat left alive escapes with the goods", () => {
    const run = createRun(3, "sword", "lamp");
    addGood(run, "clasp");
    const c = fightWith(run, "rat");
    handOf(run, []); endTurn(run);
    handOf(run, []); endTurn(run);
    expect(c.over).toBe("fled");
  });
  it("moth gives a wick only if one attack was fully blocked", () => {
    const run = createRun(11, "sword", "lamp");
    const c = fightWith(run, "moth");
    c.block = 50;
    handOf(run, []); endTurn(run);
    expect(c.fullBlocks).toBe(1);
    c.enemy.hp = 1; handOf(run, ["strike"]); playCard(run, 0);
    winCombat(run);
    expect(run.reward!.goods).toContain("wick");
  });
  it("louse killed during its curl turn cracks its shell", () => {
    const run = createRun(12, "sword", "lamp");
    const c = fightWith(run, "louse");
    expect(c.enemy.intent.key).toBe("curl");
    c.enemy.hp = 1; c.enemy.block = 0; handOf(run, ["strike"]); playCard(run, 0);
    winCombat(run);
    expect(run.reward!.note).toContain("没能取到");
  });
});

describe("market", () => {
  it("each sale of the same good lowers its price at that shop", async () => {
    const { sellItem, sellPrice } = await import("../src/game/inventory");
    const run = createRun(21, "sword", "lamp");
    run.shop = { cards: [], relics: [], gear: [], consumables: [], removePrice: 0, removed: false, oil: { amount: 25, price: 6, bought: 0 }, wanted: run.markets[1].wanted, sold: {} };
    addGood(run, "shell"); addGood(run, "shell");
    const p1 = sellPrice(run, "shell");
    sellItem(run, run.bag.items.find((i) => i.id === "shell")!.uid);
    expect(sellPrice(run, "shell")).toBe(Math.max(1, p1 - 1));
  });
  it("the fox market pays under town value, and dear goods drop a fifth per sale", async () => {
    const { sellItem, sellPrice } = await import("../src/game/inventory");
    const { townValue } = await import("../src/game/run");
    const run = createRun(21, "sword", "lamp");
    run.omen = "calm"; run.markets[1].mult.tail = 1; run.markets[1].wanted = "silk";
    run.shop = { cards: [], relics: [], gear: [], consumables: [], removePrice: 0, removed: false, oil: { amount: 25, price: 6, bought: 0 }, wanted: "silk", sold: {} };
    addGood(run, "tail"); addGood(run, "tail");
    expect(sellPrice(run, "tail")).toBe(11); // 14 × 0.75
    expect(sellPrice(run, "tail")).toBeLessThan(townValue("tail"));
    sellItem(run, run.bag.items.find((i) => i.id === "tail")!.uid);
    expect(sellPrice(run, "tail")).toBe(9); // 11 − 20% of 11
  });
  it("guardians use their floor's hp and damage modifiers", () => {
    const run = createRun(24, "sword", "lamp");
    const g = run.dungeon.entities.find((e) => e.kind === "guardian")!;
    const spawn = FLOOR_SPAWNS[1].guardian.find((s) => s.id === g.enemy)!;
    expect(g.hpMul).toBe(spawn.hp);
    expect(g.dmgAdd).toBe(spawn.dmg);
  });
  it("taking the stairs heals 40% of missing 气血", () => {
    const run = createRun(23, "sword", "lamp");
    run.hp = run.maxHp - 20;
    climb(run);
    expect(run.hp).toBe(run.maxHp - 12);
  });
  it("markets are fixed per run so a rumour about the next floor is true", () => {
    const a = createRun(22, "sword", "lamp"), b = createRun(22, "sword", "lamp");
    expect(a.markets).toEqual(b.markets);
  });
});

describe("lamp oil", () => {
  it("each step burns oil; with the lamp out enemies hit 3 harder and you only see next to you", async () => {
    const { arrive, DARK_DAMAGE } = await import("../src/game/run");
    const { enemyHitDamage } = await import("../src/game/combat");
    const run = createRun(31, "sword", "lamp");
    const before = run.oil;
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][run.pos.dir];
    arrive(run, run.pos.x + dx, run.pos.y + dy, run.pos.dir, true);
    expect(run.oil).toBe(before - 1);
    run.oil = 0;
    const lit = fightWith(createRun(32, "sword", "lamp"), "moth");
    const darkRun = createRun(32, "sword", "lamp");
    darkRun.oil = 0;
    const dark = fightWith(darkRun, "moth");
    expect(enemyHitDamage(darkRun, dark, { key: "x", name: "x", dmg: 6 })).toBe(enemyHitDamage(darkRun, lit, { key: "x", name: "x", dmg: 6 }) + DARK_DAMAGE);
  });
  it("ash can be burned for oil from the bag", async () => {
    const { useItem } = await import("../src/game/inventory");
    const run = createRun(33, "sword", "lamp");
    run.oil = 10;
    addGood(run, "ash");
    expect(useItem(run, run.bag.items.find((i) => i.id === "ash")!.uid)).toContain("灯油");
    expect(run.oil).toBe(18);
  });
});

describe("long game", () => {
  it("regulars get their client's gift at the start", () => {
    const run = createRun(41, "sword", "herbs", 0, true);
    expect(bag.count(run.bag, "salve")).toBe(1);
  });
  it("achievements are checked against the finished run", async () => {
    const { ACHIEVEMENTS } = await import("../src/data/achievements");
    const run = createRun(42, "sword", "lamp");
    run.floor = 2;
    run.flags.push("clasp");
    const profile = { renown: 0, runs: 1, wins: 0, bestFloor: 0, ordersDone: [], seenTips: [], achievements: [], treasury: 0, upgrades: {}, favor: {}, codex: [], daily: null, sound: true };
    const got = ACHIEVEMENTS.filter((a) => a.check(run, profile)).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(["floor2", "clasp"]));
    expect(got).not.toContain("win");
  });
});

describe("new monsters", () => {
  const setIntent = (c: ReturnType<typeof fightWith>, key: string) => {
    const m = ENEMIES[c.enemy.id].moves[key];
    c.enemy.intent = { key, ...m };
  };
  it("thorn stele hurts you for every hit you land", () => {
    const run = createRun(51, "sword", "lamp");
    const c = fightWith(run, "thorn-stele");
    const hp = run.hp; c.block = 0;
    handOf(run, ["twin"]); playCard(run, 0);
    expect(run.hp).toBe(hp - 4);
  });
  it("bronze puppet caps every hit at 8", () => {
    const run = createRun(52, "sword", "lamp");
    const c = fightWith(run, "bronze-puppet");
    c.status.str = 20; c.enemy.block = 0;
    const hp = c.enemy.hp;
    handOf(run, ["strike"]); playCard(run, 0);
    expect(hp - c.enemy.hp).toBe(8);
  });
  it("water ghost takes half damage while diving", () => {
    const run = createRun(53, "shield", "lamp");
    const c = fightWith(run, "water-ghost");
    setIntent(c, "sink"); c.enemy.block = 0;
    const hp = c.enemy.hp;
    handOf(run, ["strike"]); playCard(run, 0);
    expect(hp - c.enemy.hp).toBe(3);
  });
  it("paper doll takes double fire damage, but a fire finish burns the red paper", () => {
    const run = createRun(54, "lamp", "lamp");
    const c = fightWith(run, "paper-doll");
    c.enemy.block = 0; c.enemy.hp = 30;
    handOf(run, ["dust"]); playCard(run, 0);
    expect(30 - c.enemy.hp).toBe(16);
    c.enemy.hp = 1; handOf(run, ["dust"]); playCard(run, 0);
    winCombat(run);
    expect(run.reward!.goods).not.toContain("redpaper");
  });
  it("ink moth's ink makes you draw one fewer card", () => {
    const run = createRun(55, "sword", "lamp");
    const c = fightWith(run, "ink-moth");
    setIntent(c, "ink"); c.block = 0;
    endTurn(run);
    expect(c.hand.length).toBe(4);
    expect(c.blinded).toBe(1);
  });
  it("fire rat eats ash, lantern spirit drinks oil, fake fox collects coin — only when damage gets through", () => {
    const r1 = createRun(56, "sword", "lamp"); addGood(r1, "ash"); addGood(r1, "ash");
    const c1 = fightWith(r1, "fire-rat"); setIntent(c1, "gnaw"); c1.block = 0; endTurn(r1);
    expect(bag.count(r1.bag, "ash")).toBe(0);
    const r2 = createRun(57, "sword", "lamp"); const oil = r2.oil;
    const c2 = fightWith(r2, "lantern-spirit"); setIntent(c2, "sip"); c2.block = 0; endTurn(r2);
    expect(r2.oil).toBe(oil - 10);
    const r3 = createRun(58, "sword", "lamp"); r3.gold = 30;
    const c3 = fightWith(r3, "fake-fox", "elite"); setIntent(c3, "collect"); c3.block = 99; endTurn(r3);
    expect(r3.gold).toBe(30);
  });
  it("hitting the fallen hunter in its stance costs you and its token", () => {
    const run = createRun(59, "sword", "lamp");
    const c = fightWith(run, "fallen", "elite");
    expect(c.enemy.intent.counter).toBe(4);
    const hp = run.hp; c.block = 0;
    handOf(run, ["strike"]); playCard(run, 0);
    expect(run.hp).toBe(hp - 4);
    expect(ENEMIES.fallen.harvest!.got(c)).toBe(false);
  });
});

describe("new events", () => {
  it("scavenging deeply turns the event into a fight", async () => {
    const R = await import("../src/game/run");
    const run = createRun(61, "sword", "lamp");
    const e: Entity = { id: 77, kind: "event", x: run.pos.x, y: run.pos.y, event: "scavenge", done: false };
    run.dungeon.entities.push(e);
    R.openEntity(run, e);
    R.chooseEvent(run, 1);
    expect(run.eventFight).not.toBeNull();
    R.closeEvent(run);
    expect(run.screen).toBe("combat");
    expect(e.kind).toBe("fight");
  });
  it("the teleport array moves you somewhere new", async () => {
    const R = await import("../src/game/run");
    const run = createRun(62, "sword", "lamp");
    const e: Entity = { id: 78, kind: "event", x: run.pos.x, y: run.pos.y, event: "portal", done: false };
    run.dungeon.entities.push(e);
    R.openEntity(run, e);
    const from = { ...run.pos };
    R.chooseEvent(run, 0);
    expect(run.pos).not.toEqual(from);
    expect(run.warp).toBe(1);
  });
  it("the reflecting pool copies a card", async () => {
    const R = await import("../src/game/run");
    const run = createRun(63, "sword", "lamp");
    run.cardPick = { mode: "copy", source: "event" };
    const n = run.deck.length;
    R.applyCardPick(run, run.deck[0].uid);
    expect(run.deck.length).toBe(n + 1);
  });
});

describe("town economy", () => {
  it("coming home alive banks coin and goods; dying loses them", async () => {
    const R = await import("../src/game/run");
    const run = createRun(71, "sword", "lamp");
    run.gold = 40; addGood(run, "clasp");
    run.outcome = "retreat";
    const alive = R.settle(run);
    expect(alive.carried).toBe(40 + 10 + R.townValue("sword"));
    const run2 = createRun(71, "sword", "lamp");
    run2.gold = 40; run2.outcome = "dead";
    expect(R.settle(run2).carried).toBe(0);
  });
  it("favour makes orders bigger and better paid", async () => {
    const R = await import("../src/game/run");
    const base = { id: "lamp", level: 0, done: false }, close = { id: "lamp", level: 4, done: false };
    expect(R.orderNeeds(close).ash).toBe(R.orderNeeds(base).ash! + 2);
    expect(R.orderReward(close).gold).toBeGreaterThan(R.orderReward(base).gold);
  });
  it("town upgrades change the start of a run", () => {
    const run = createRun(72, "sword", ["lamp", "herbs"], 0, { upgrades: { ledger: 2, oil: 1, bagsmith: 1, medicine: 1, school: 1 } });
    expect(run.gold).toBe(50);
    expect(run.maxOil).toBe(135);
    expect(run.bag.h).toBe(5);
    expect(bag.count(run.bag, "salve")).toBe(1);
    expect(run.screen).toBe("reward");
    expect(run.orders.length).toBe(2);
  });
});

describe("combos", () => {
  it("a whetstone next to a weapon raises that weapon's attack cards", async () => {
    const { combatDeck } = await import("../src/game/combat");
    const run = createRun(81, "sword", "lamp");
    const sword = run.bag.items.find((i) => i.id === "sword")!;
    run.bag.items.push({ uid: 999, id: "whetstone", x: sword.x + 1, y: sword.y, rot: 0 });
    const unison = combatDeck(run).find((c) => c.id === "unison")!;
    expect(unison.bonus?.dmg).toBe(2);
    const c = fightWith(run, "louse");
    c.enemy.block = 0;
    const hp = c.enemy.hp;
    c.hand = [{ ...unison }];
    playCard(run, 0);
    expect(hp - c.enemy.hp).toBe(6 + 2 + 2 + 1); // base + whetstone + sword passive + 刃 pair (sword and whetstone)
  });
  it("a ward charm keeps its neighbours from being stolen", () => {
    const run = createRun(82, "sword", "lamp");
    run.bag.items = [{ uid: 1, id: "clasp", x: 0, y: 0, rot: 0 }, { uid: 2, id: "wardcharm", x: 1, y: 0, rot: 0 }, { uid: 3, id: "ash", x: 4, y: 3, rot: 0 }];
    expect(bag.mostValuable(run.bag)!.id).toBe("ash");
  });
  it("burn ticks through block before the enemy acts, and 烧尽 scales with it", () => {
    const run = createRun(83, "lamp", "lamp");
    const c = fightWith(run, "louse");
    handOf(run, ["ignite"]); playCard(run, 0);
    const hp = c.enemy.hp;
    c.enemy.block = 50;
    handOf(run, []); endTurn(run);
    expect(hp - c.enemy.hp).toBe(5);
    expect(c.enemy.status.burn).toBe(4);
  });
  it("剑气纵横 adds damage to every later attack", () => {
    const run = createRun(84, "shield", "lamp");
    const c = fightWith(run, "louse");
    c.enemy.block = 0;
    handOf(run, ["swordqi", "strike"]); playCard(run, 0);
    const hp = c.enemy.hp;
    playCard(run, 0);
    expect(hp - c.enemy.hp).toBe(6 + 2);
  });
});

describe("round four", () => {
  it("every floor has an omen, and market day raises sale prices", async () => {
    const { OMEN } = await import("../src/data/omens");
    const { sellPrice } = await import("../src/game/inventory");
    const run = createRun(91, "sword", "lamp");
    expect(OMEN[run.omen]).toBeTruthy();
    run.omen = "calm";
    const calm = sellPrice(run, "shell");
    run.omen = "market";
    expect(sellPrice(run, "shell")).toBeGreaterThan(calm);
  });
  it("floors 1 and 2 roll between two guardians", () => {
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) seen.add(generate(1, makeRng(s)).entities.find((e) => e.kind === "guardian")!.enemy!);
    expect([...seen].sort()).toEqual(["moth-queen", "paper-matron"]);
  });
  it("meeting things records them for the codex", () => {
    const run = createRun(92, "sword", "clasp");
    fightWith(run, "ink-moth");
    expect(run.discovered).toEqual(expect.arrayContaining(["e:ink-moth", "g:sword", "c:feixiao"]));
  });
  it("paper matron rebuilds herself at half health", () => {
    const run = createRun(93, "sword", "lamp");
    const c = fightWith(run, "paper-matron", "guardian");
    c.enemy.block = 0; c.enemy.hp = 31;
    handOf(run, ["strike"]); playCard(run, 0);
    expect(c.enemy.phase).toBe(2);
    expect(c.enemy.hp).toBeGreaterThan(31 - 8);
  });
});

describe("UI-001 navigation helpers", () => {
  it("newlySighted reports only entities that just came into view", async () => {
    const { sightedIds, newlySighted, reveal } = await import("../src/game/dungeon");
    const d = generate(1, makeRng(101));
    d.seen.fill(false);
    reveal(d, d.start.x, d.start.y);
    const before = sightedIds(d);
    expect(newlySighted(d, before)).toEqual([]);
    d.seen.fill(true);
    const fresh = newlySighted(d, before);
    expect(fresh.length).toBe(d.entities.filter((e) => !e.done && e.kind !== "stairs").length - before.size);
    expect(fresh.every((e) => !before.has(e.id))).toBe(true);
  });
});

describe("bag sets and side pouch (GAME-003A)", () => {
  const uidOf = (run: RunState, id: string) => run.bag.items.find((i) => i.id === id)!.uid;

  it("counts tags anywhere in the bag and turns sets on at their thresholds", () => {
    const run = createRun(21, "sword", "lamp");
    expect(bag.tagCounts(run.bag).blade).toBe(1);
    expect(bag.tagLevel(run.bag, "blade")).toBe(0);
    addGood(run, "ironsword");
    expect(bag.tagLevel(run.bag, "blade")).toBe(1);
    addGood(run, "hook"); addGood(run, "whetstone");
    expect(bag.tagCounts(run.bag).blade).toBe(4);
    expect(bag.tagLevel(run.bag, "blade")).toBe(2);
  });

  it("a 刃 pair adds 1 damage to hits", () => {
    const run = createRun(22, "shield", "lamp");
    addGood(run, "ironsword"); addGood(run, "hook");
    const c = fightWith(run, "louse");
    const hp = c.enemy.hp;
    handOf(run, ["defend"]);
    run.combat!.hand = [{ uid: 900, id: "strike", up: false }];
    playCard(run, 0);
    expect(c.enemy.hp).toBe(hp - 7);
  });

  it("a 盾 pair gives block at the start of every fight", () => {
    const run = createRun(23, "shield", "lamp");
    expect(fightWith(run, "louse").block).toBe(0);
    const run2 = createRun(23, "shield", "lamp");
    addGood(run2, "amulet");
    expect(fightWith(run2, "louse").block).toBe(4);
  });

  it("items in the side pouch give no cards, boosts or tags", async () => {
    const { combatDeck } = await import("../src/game/combat");
    const run = createRun(24, "sword", "lamp");
    addGood(run, "ironsword");
    expect(bag.tagLevel(run.bag, "blade")).toBe(1);
    expect(toPouch(run, uidOf(run, "ironsword"))).toBe(true);
    expect(run.pouch).toEqual(["ironsword"]);
    expect(bag.tagLevel(run.bag, "blade")).toBe(0);
    expect(combatDeck(run).map((c) => c.id)).not.toContain("gap");
    expect(fromPouch(run, 0)).toBe(true);
    expect(run.pouch).toEqual([]);
    expect(combatDeck(run).map((c) => c.id)).toContain("gap");
  });

  it("thieves can't reach the side pouch, and it can't be used mid-fight", () => {
    const run = createRun(25, "sword", "lamp");
    addGood(run, "clasp");
    toPouch(run, uidOf(run, "clasp"));
    const c = fightWith(run, "rat");
    handOf(run, []);
    c.block = 0;
    endTurn(run);
    expect(c.stolen).toEqual([]);
    expect(run.pouch).toEqual(["clasp"]);
    expect(fromPouch(run, 0)).toBe(false);
  });

  it("the pouch holds three things and its goods can be sold", () => {
    const run = createRun(26, "sword", "lamp");
    for (const g of ["fang", "silk", "shell", "knot"] as const) addGood(run, g);
    for (const g of ["fang", "silk", "shell", "knot"]) toPouch(run, uidOf(run, g));
    expect(run.pouch).toEqual(["fang", "silk", "shell"]);
    const gold = run.gold;
    const p = sellPouch(run, 0);
    expect(p).toBeGreaterThan(0);
    expect(run.gold).toBe(gold + p);
    expect(run.pouch).toEqual(["silk", "shell"]);
  });

  it("an accessory reaches the 8 cells around it, clipped to the bag", () => {
    expect(bag.auraCells({ w: 5, h: 4 }, [[0, 0]]).length).toBe(3);
    expect(bag.auraCells({ w: 5, h: 4 }, [[2, 1]]).length).toBe(8);
    expect(bag.auraCells({ w: 5, h: 4 }, [[2, 1], [2, 2]]).length).toBe(10);
  });
});

describe("free-form bag and fragile goods (GAME-003C)", () => {
  const fresh = () => ({ w: 5, h: 4, items: [] as RunState["bag"]["items"] });

  it("items can't go into holes", () => {
    const b = { ...fresh(), holes: [0] };
    expect(bag.usable(b, 0, 0)).toBe(false);
    expect(bag.fits(b, "ash", 0, 0, 0)).toBe(false);
    expect(bag.fits(b, "ash", 1, 0, 0)).toBe(true);
    expect(bag.findSpot(b, "ash")).toEqual({ x: 1, y: 0, rot: 0 });
    expect(bag.cellCount(b)).toBe(19);
  });

  it("a piece sewn to the right grows the bag and leaves holes where nothing was added", () => {
    const b = fresh();
    const cells = bag.pieceCells("square", 0, 5, 1);
    expect(bag.expandProblem(b, cells)).toBeNull();
    expect(bag.expand(b, cells)).toBe(true);
    expect([b.w, b.h]).toEqual([7, 4]);
    expect(bag.cellCount(b)).toBe(24);
    expect(bag.usable(b, 5, 0)).toBe(false);
    expect(bag.usable(b, 6, 2)).toBe(true);
  });

  it("growing left or up shifts the items so they stay put relative to the bag", () => {
    const b = fresh();
    b.items.push({ uid: 1, id: "ash", x: 0, y: 0, rot: 0 });
    expect(bag.expand(b, bag.pieceCells("line", 0, 0, -1))).toBe(true);
    expect([b.w, b.h]).toEqual([5, 5]);
    expect(b.items[0]).toMatchObject({ x: 0, y: 1 });
    expect(bag.usable(b, 4, 0)).toBe(false);
    expect(bag.expand(b, bag.pieceCells("ell", 0, -1, 1))).toBe(false); // its last cell would cover (0, 3)
    expect(bag.expand(b, bag.pieceCells("ell", 0, -2, 1))).toBe(true);
    expect(b.w).toBe(7);
    expect(b.items[0]).toMatchObject({ x: 2, y: 1 });
  });

  it("refuses pieces that overlap, float free or make the bag too big", () => {
    const b = fresh();
    expect(bag.expandProblem(b, bag.pieceCells("line", 0, 1, 0))).toMatch(/盖住/);
    expect(bag.expandProblem(b, bag.pieceCells("line", 0, 0, 6))).toMatch(/贴着/);
    expect(bag.expandProblem(b, bag.pieceCells("line", 0, 5, 0))).toMatch(/最大/);
  });

  it("the lining sews four cells on (auto placement when no spot is chosen)", () => {
    const run = createRun(31, "sword", "lamp");
    addGood(run, "lining");
    const before = bag.cellCount(run.bag);
    const uid = run.bag.items.find((i) => i.id === "lining")!.uid;
    expect(useItem(run, uid)).toMatch(/多了 4 格/);
    expect(bag.cellCount(run.bag)).toBe(before + 4);
    expect(run.bag.items.some((i) => i.id === "lining")).toBe(false);
  });

  it("a chosen spot is used as given, and a bad one leaves the lining in the bag", () => {
    const run = createRun(32, "sword", "lamp");
    addGood(run, "lining");
    const uid = run.bag.items.find((i) => i.id === "lining")!.uid;
    expect(sewPiece(run, uid, bag.pieceCells("line", 0, 1, 0))).toBeNull();
    expect(run.bag.items.some((i) => i.uid === uid)).toBe(true);
    expect(sewPiece(run, uid, bag.pieceCells("line", 1, 5, 0))).toMatch(/多了 4 格/);
    expect([run.bag.w, run.bag.h]).toEqual([6, 4]);
  });

  it("fragile goods may crack when a hit gets through, but not under 护货", () => {
    const hit = (ward: boolean) => {
      const run = createRun(34, "sword", "lamp");
      for (let i = 0; i < 8; i++) addGood(run, "pearl");
      const c = fightWith(run, "louse");
      handOf(run, []);
      c.block = 0;
      if (ward) c.status.ward = 1;
      // Make sure the louse attacks this turn.
      c.enemy.intent = { key: "bite", name: "咬", dmg: 5 };
      endTurn(run);
      return bag.count(run.bag, "pearl-cracked");
    };
    expect(hit(false)).toBeGreaterThan(0);
    expect(hit(true)).toBe(0);
  });

  it("orders only take intact goods", async () => {
    const { orderProgress } = await import("../src/game/run");
    const run = createRun(34, "sword", "lamp");
    run.orders = [{ id: "clasp", level: 0, done: false }];
    addGood(run, "clasp-broken");
    expect(orderProgress(run).ready).toBe(false);
    addGood(run, "clasp");
    expect(orderProgress(run).ready).toBe(true);
  });
});

describe("refining (GAME-003B)", () => {
  const place = (run: RunState, id: string, x: number, y: number, rot = 0) => {
    run.bag.items.push({ uid: run.nextUid++, id: id as never, x, y, rot });
  };
  const clearBag = (run: RunState) => { run.bag.items = []; };

  it("gear next to its accessory is refined after a win, using the accessory up", async () => {
    const { combatDeck } = await import("../src/game/combat");
    const run = createRun(41, "sword", "lamp");
    clearBag(run);
    place(run, "ironsword", 0, 0);
    place(run, "whetstone", 1, 0);
    expect(bag.pendingRefines(run.bag).length).toBe(1);
    fightWith(run, "louse");
    winCombat(run);
    expect(run.bag.items.map((i) => i.id)).toContain("ironsword-fine");
    expect(run.bag.items.map((i) => i.id)).not.toContain("whetstone");
    expect(run.reward!.note).toMatch(/淬炼/);
    const strike = combatDeck(run).find((c) => c.from === "ironsword-fine" && c.id === "strike")!;
    expect(strike.up).toBe(true);
    expect(strike.bonus?.dmg).toBe(1);
  });

  it("apart, nothing is refined", () => {
    const run = createRun(42, "sword", "lamp");
    clearBag(run);
    place(run, "ironsword", 0, 0);
    place(run, "whetstone", 3, 0);
    fightWith(run, "louse");
    winCombat(run);
    expect(run.bag.items.map((i) => i.id)).toEqual(expect.arrayContaining(["ironsword", "whetstone"]));
  });

  it("refined gear keeps its base passive and adds its own", () => {
    const run = createRun(43, "sword", "lamp");
    clearBag(run);
    place(run, "shield-fine", 0, 0);
    const c = fightWith(run, "louse");
    handOf(run, []);
    c.block = 10;
    c.enemy.intent = { key: "wait", name: "等", block: 1 };
    endTurn(run);
    expect(c.block).toBe(4);
  });

  it("refined gear never drops or shows up in shops", async () => {
    const { GEAR_IDS } = await import("../src/data/goods");
    expect(GEAR_IDS.some((id) => id.endsWith("-fine"))).toBe(false);
  });
});

describe("playtest record (GAME-001)", () => {
  it("counts elites left unfought, 气血 at each floor's end, and what was sold", async () => {
    const { sellItem, toPouch } = await import("../src/game/inventory");
    const { playtestRecord } = await import("../src/game/stats");
    const run = createRun(31, "sword", "lamp");
    run.shop = { cards: [], relics: [], gear: [], consumables: [], removePrice: 0, removed: false, oil: { amount: 25, price: 6, bought: 0 }, wanted: run.markets[1].wanted, sold: {} };
    addGood(run, "shell"); addGood(run, "silk");
    const got = sellItem(run, run.bag.items.find((i) => i.id === "shell")!.uid);
    toPouch(run, run.bag.items.find((i) => i.id === "silk")!.uid);
    const elites = run.dungeon.entities.filter((e) => e.kind === "elite").length;
    run.hp = 40;
    climb(run);
    expect(run.stats.elitesSkipped).toBe(elites);
    expect(run.stats.hpAtFloorEnd).toEqual([40]);
    expect(run.stats.soldValue).toBe(got);
    expect(run.stats.pouchStash).toBe(1);
    run.outcome = "retreat";
    const text = playtestRecord(run, 12, 3);
    expect(text).toContain("本机第 3 局");
    expect(text).toContain(`没打就离开 ${elites}`);
    expect(text).toContain("带回镇上折库银 12 石");
  });
  it("old saves without the counters still make a record", async () => {
    const { playtestRecord } = await import("../src/game/stats");
    const run = createRun(32, "sword", "lamp");
    run.stats = { steps: 1, harvests: 0, kills: 0, goldEarned: 0, goodsSold: 0, goodsUsed: 0, damageTaken: 0, turns: 0 };
    run.outcome = "dead";
    expect(playtestRecord(run, 0, 1)).toContain("精英：打了 0，没打就离开 0");
  });
});

describe("hearing monsters (AUDIO-002)", () => {
  // #######
  // #..#..#
  // #..#..#
  // #.....#
  // #######
  const rows = ["#######", "#..#..#", "#..#..#", "#.....#", "#######"];
  const d = { w: 7, h: 5, tiles: rows.join("").split("").map((c) => (c === "#" ? 1 : 0)), entities: [], seen: [] } as unknown as Parameters<typeof hearing>[0];
  it("is clear in plain view", () => {
    expect(hearing(d, { x: 1, y: 3 }, { x: 5, y: 3 }, 8)).toEqual({ steps: 4, los: true, via: { x: 2, y: 3 } });
  });
  it("goes round a corner and arrives through the opening", () => {
    const h = hearing(d, { x: 2, y: 1 }, { x: 4, y: 3 }, 8)!;
    expect(h.los).toBe(false);
    expect(h.steps).toBe(4);
    expect(h.via).toEqual({ x: 2, y: 2 });
  });
  it("behind a wall the way round is long, and too far is silent", () => {
    const h = hearing(d, { x: 1, y: 1 }, { x: 4, y: 1 }, 8)!;
    expect(h.los).toBe(false);
    expect(h.steps).toBe(7);
    expect(hearing(d, { x: 1, y: 1 }, { x: 4, y: 1 }, 6)).toBeNull();
  });
});
