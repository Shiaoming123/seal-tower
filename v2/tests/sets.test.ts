// Set bonuses (刃/盾/灯/钱/妖材): how much each tier is worth. Loads the starting bag with the items for a tier,
// then plays the same seeds twice: once as is, once one tier lower with the items' own cards and passives kept.
// Tier 1 is compared with the tag taken off every listed item (tier 0); tier 2 with it taken off the last item
// only (back to tier 1). So each row is what that one tier adds.
// Refining is switched off so accessories aren't used up mid-run. Only runs when asked:
//   REPORT=1 SEEDS=200 npx vitest run tests/sets.test.ts   → docs/sim/sets.md
import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { GOODS, REFINES, TAGS } from "../src/data/goods";
import * as bag from "../src/game/bag";
import { addGood } from "../src/game/inventory";
import { createRun, settle } from "../src/game/run";
import type { TagId } from "../src/data/goods";
import type { GoodId, WeaponId } from "../src/game/types";
import { playRun } from "./bot";

const SEEDS = Number(process.env.SEEDS ?? 200);
const WEAPON: WeaponId = "sword";

const TIERS: { tag: TagId; level: 1 | 2; items: GoodId[] }[] = [
  { tag: "blade", level: 1, items: ["ironsword"] },
  { tag: "blade", level: 2, items: ["ironsword", "hook", "whetstone"] },
  { tag: "guard", level: 1, items: ["shield", "amulet"] },
  { tag: "guard", level: 2, items: ["shield", "amulet", "mirror"] },
  { tag: "lamp", level: 1, items: ["lamp", "oilpot"] },
  { tag: "lamp", level: 2, items: ["lamp", "oilpot", "wick", "wick"] },
  { tag: "coin", level: 1, items: ["purse", "luckybag"] },
  { tag: "coin", level: 2, items: ["purse", "luckybag", "abacus"] },
  { tag: "material", level: 1, items: ["redpaper", "fur", "inkdust"] },
  { tag: "material", level: 2, items: ["redpaper", "fur", "inkdust", "token", "shard", "rubbing"] },
];

function play(items: GoodId[], seed: number) {
  const run = createRun(seed * 7919, WEAPON, "lamp");
  run.bag.w = Math.max(run.bag.w, 6); run.bag.h = Math.max(run.bag.h, 5); // room for the extra items in every tier
  for (const id of items) if (!addGood(run, id)) return null;
  const res = playRun(run, { keep: items });
  // Carried home: coin plus the town value of the bag, 0 if you died (settle() works that out).
  return { win: res.outcome === "win", carried: settle(run).carried };
}

describe.skipIf(!process.env.REPORT)("set bonus report", () => {
  it("writes docs/sim/sets.md", () => {
    const refines = REFINES.splice(0);
    const base = { win: 0, n: 0 };
    for (let s = 1; s <= SEEDS; s++) { const r = play([], s)!; base.n++; if (r.win) base.win++; }
    const rows: string[] = [];
    for (const t of TIERS) {
      const on = { win: 0, n: 0, carried: 0 }, off = { win: 0, n: 0, carried: 0 };
      let onlyOn = 0, onlyOff = 0, pairs = 0;
      const strip = t.level === 1 ? t.items : t.items.slice(-1);
      const check = createRun(1, WEAPON, "lamp");
      check.bag.w = 6; check.bag.h = 5;
      for (const id of t.items) addGood(check, id);
      const reached = bag.tagLevel(check.bag, t.tag);
      for (let s = 1; s <= SEEDS; s++) {
        const a = play(t.items, s);
        if (a) { on.n++; on.carried += a.carried; if (a.win) on.win++; }
        const saved = strip.map((id) => GOODS[id].tags);
        for (const id of strip) GOODS[id].tags = (GOODS[id].tags ?? []).filter((x) => x !== t.tag);
        const b = play(t.items, s);
        strip.forEach((id, i) => (GOODS[id].tags = saved[i]));
        if (b) { off.n++; off.carried += b.carried; if (b.win) off.win++; }
        if (a && b) { pairs++; if (a.win && !b.win) onlyOn++; if (b.win && !a.win) onlyOff++; }
      }
      const pct = (o: { win: number; n: number }) => (o.n ? (100 * o.win) / o.n : 0);
      // Paired seeds: standard error of the difference from the discordant pairs.
      const se = pairs ? (100 * Math.sqrt(Math.max(0, onlyOn + onlyOff - (onlyOn - onlyOff) ** 2 / pairs))) / pairs : 0;
      rows.push(`| ${TAGS[t.tag].name} ${t.level} 档 | ${TAGS[t.tag].text[t.level - 1]} | ${t.items.map((id) => GOODS[id].name).join("、")} | ${reached === t.level ? "是" : `否（${reached}）`} | ${pct(off).toFixed(0)}% | ${pct(on).toFixed(0)}% | ${(pct(on) - pct(off)) >= 0 ? "+" : ""}${(pct(on) - pct(off)).toFixed(1)} ±${se.toFixed(1)} | ${Math.round(off.carried / off.n)} → ${Math.round(on.carried / on.n)} |`);
    }
    REFINES.push(...refines);
    const lines = [
      "# 套装各档值多少", "",
      `由 \`tests/sets.test.ts\` 生成：照影剑开局，行囊放大到 6×5，每档 ${SEEDS} 个种子 × 两遍。「低一档」那遍物品、牌和被动都在，只是套装少一档：第 1 档对照去掉全部标签，第 2 档对照只去掉最后一件的标签。淬炼关闭。机器人规则见 \`tests/bot.ts\`，放进去的物品不卖。± 是同一批种子成对比较的标准误，差值小于两倍标准误就分不出来。「平均带回镇上」是活着回镇时身上的石加行囊货物的库银价，倒下算 0，箭头左边是低一档。`,
      "", `不加物品的基线胜率：${((100 * base.win) / base.n).toFixed(0)}%。`, "",
      "| 档 | 效果 | 放进去的物品 | 达到这档 | 低一档 | 这一档生效 | 这一档带来的胜率 | 平均带回镇上（石） |",
      "| --- | --- | --- | --- | --- | --- | --- | --- |", ...rows,
    ];
    writeFileSync("docs/sim/sets.md", lines.join("\n") + "\n");
  }, 1_800_000);
});
