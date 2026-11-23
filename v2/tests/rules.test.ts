import { describe, expect, it } from "vitest";
import { CARDS } from "../src/data/cards";
import { ENEMIES } from "../src/data/enemies";
import { EVENTS } from "../src/data/events";
import * as bag from "../src/game/bag";
import { endTurn, playCard, startCombat } from "../src/game/combat";
import { distances, findPath, generate, idx, revealAll } from "../src/game/dungeon";
import { addGood } from "../src/game/inventory";
import { createRun, winCombat } from "../src/game/run";
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
    handOf(run, ["defend"]);
    playCard(run, 0);
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
      const t = def.text(v, { dmg: (n) => n, ash: 2, gold: 10, block: 3, attacks: 1, inCombat: true });
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
    for (const ev of Object.values(EVENTS)) expect(ev.options.some((o) => !o.locked)).toBe(true);
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
    const profile = { renown: 0, runs: 1, wins: 0, bestFloor: 0, ordersDone: [], seenTips: [], achievements: [], sound: true };
    const got = ACHIEVEMENTS.filter((a) => a.check(run, profile)).map((a) => a.id);
    expect(got).toEqual(expect.arrayContaining(["floor2", "clasp"]));
    expect(got).not.toContain("win");
  });
});
