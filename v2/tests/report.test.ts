// Balance report: plays many runs with the simple bot and writes what happened, monster by monster and
// floor by floor. Only runs when asked:  REPORT=1 SEEDS=300 npx vitest run tests/report.test.ts
// Output: docs/sim/report.md (and report-nosell.md with SELL=0 for comparison).
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import { CARDS } from "../src/data/cards";
import { ENEMIES } from "../src/data/enemies";
import { createRun } from "../src/game/run";
import type { WeaponId } from "../src/game/types";
import { newStats, playRun, type SimStats } from "./bot";

const SEEDS = Number(process.env.SEEDS ?? 200);
const SELL = process.env.SELL !== "0";
const WEAPONS: WeaponId[] = ["sword", "shield", "lamp", "abacus"];
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "–");
const avg = (a: number, b: number, d = 1) => (b ? (a / b).toFixed(d) : "–");
const KIND: Record<string, string> = { fight: "普通", elite: "精英", guardian: "守关" };
/** Stats keys are `floor:enemyId:kind`. */
const name = (k: string) => { const [f, id, kind] = k.split(":"); return id ? `${ENEMIES[id]?.name ?? id}（${f} 层${kind === "fight" ? "" : KIND[kind]}）` : k; };

describe.skipIf(!process.env.REPORT)("balance report", () => {
  it("writes docs/sim/report.md", () => {
    const all = newStats();
    const lines: string[] = [];
    const outcome: Record<string, { win: number; died: number[]; killer: Record<string, number> }> = {};
    for (const w of WEAPONS) {
      const o = (outcome[w] = { win: 0, died: [0, 0, 0, 0], killer: {} as Record<string, number> });
      for (let seed = 1; seed <= SEEDS; seed++) {
        const st: SimStats = all;
        const before = JSON.stringify(Object.fromEntries(Object.entries(st.enemies).map(([k, v]) => [k, v.losses])));
        const res = playRun(createRun(seed * 7919, w, "lamp"), { stats: st, sell: SELL });
        if (res.outcome === "win") o.win++;
        else {
          o.died[res.floor]++;
          // Who killed us: the monster whose loss count just went up.
          const prev = JSON.parse(before) as Record<string, number>;
          const k = Object.entries(st.enemies).find(([id, v]) => v.losses > (prev[id] ?? 0))?.[0] ?? "(不是战斗)";
          o.killer[k] = (o.killer[k] ?? 0) + 1;
        }
      }
    }
    const runs = SEEDS * WEAPONS.length;
    lines.push(`# 模拟报告${SELL ? "" : "（机器人不卖货）"}`, "", `由 \`tests/report.test.ts\` 生成：每把起手兵器 ${SEEDS} 局，共 ${runs} 局。机器人规则见 \`tests/bot.ts\`：打所有妖（守关最后），${SELL ? "在狐市卖掉委托不需要的货，" : "不卖货，"}钱多于 30 石就买牌，灯油低于 70 就补。它不会整理行囊，也不会挑路线，所以数字反映「普通玩家随手打」的下限。`, "");
    lines.push("## 结局", "", "| 兵器 | 胜率 | 死在第 1 / 2 / 3 层 | 最常见的致死原因 |", "| --- | --- | --- | --- |");
    for (const w of WEAPONS) {
      const o = outcome[w];
      const top = Object.entries(o.killer).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, n]) => `${name(k)} ${n}`).join("、");
      lines.push(`| ${w} | ${pct(o.win, SEEDS)} | ${o.died.slice(1).join(" / ")} | ${top} |`);
    }
    lines.push("", "## 每只妖", "", "掉血 = 这一场打完你少了多少气血（含被打死那场）。致死率 = 打这只妖时死掉的比例。", "", "| 层 | 妖 | 类型 | 遭遇 | 平均回合 | 平均掉血 | 致死率 |", "| --- | --- | --- | --- | --- | --- | --- |");
    const rows = Object.entries(all.enemies).map(([k, e]) => ({ floor: Number(k.split(":")[0]), id: k.split(":")[1], e }));
    rows.sort((a, b) => a.floor - b.floor || b.e.hpLost / b.e.n - a.e.hpLost / a.e.n);
    for (const { floor, id, e } of rows) {
      lines.push(`| ${floor} | ${ENEMIES[id].name} | ${KIND[e.kind] ?? e.kind} | ${e.n} | ${avg(e.turns, e.n)} | ${avg(e.hpLost, e.n)} | ${pct(e.losses, e.n)} |`);
    }
    lines.push("", "### 每层普通妖合计", "", "| 层 | 遭遇 | 平均掉血 | 致死率 |", "| --- | --- | --- | --- |");
    for (const f of [1, 2, 3]) {
      const n = rows.filter((r) => r.floor === f && r.e.kind === "fight");
      const sum = (k: "n" | "hpLost" | "losses") => n.reduce((a, r) => a + r.e[k], 0);
      lines.push(`| ${f} | ${sum("n")} | ${avg(sum("hpLost"), sum("n"))} | ${pct(sum("losses"), sum("n"))} |`);
    }
    lines.push("", "## 每层收支（平均每局到达这一层时）", "", "| 层 | 到达 | 战斗得石 | 卖货得石 | 委托得石 | 买牌 | 买灯油 | 买药等 | 灯油耗尽 | 离开时气血 | 离开时石 | 装不下丢掉的货 | 离开时行囊占用 |", "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const f of [1, 2, 3]) {
      const s = all.floors[f], n = s.reached;
      lines.push(`| ${f} | ${n} | ${avg(s.fightGold, n, 0)} | ${avg(s.saleGold, n, 0)} | ${avg(s.orderGold, n, 0)} | ${avg(s.spentCards, n, 0)} | ${avg(s.spentOil, n, 0)} | ${avg(s.spentOther, n, 0)} | ${pct(s.oilOut, n)} | ${avg(s.hpAtEnd, n, 0)} | ${avg(s.goldAtEnd, n, 0)} | ${avg(s.lostGoods, n, 1)} | ${pct(s.fillAtEnd, n)} |`);
    }
    lines.push("", "## 卡牌被选率（奖励三选一里出现时被机器人选中的比例）", "", "| 牌 | 出现 | 被选 | 选中率 |", "| --- | --- | --- | --- |");
    for (const [id, n] of Object.entries(all.offered).sort((a, b) => (all.picked[b[0]] ?? 0) / b[1] - (all.picked[a[0]] ?? 0) / a[1])) {
      lines.push(`| ${CARDS[id].name} | ${n} | ${all.picked[id] ?? 0} | ${pct(all.picked[id] ?? 0, n)} |`);
    }
    lines.push("", "## 行囊机制", "", `淬炼发生 ${all.refines} 次（平均每局 ${avg(all.refines, runs, 2)}），易碎货磕坏 ${all.cracks} 件（平均每局 ${avg(all.cracks, runs, 2)}）。机器人不会主动摆配件，淬炼都是偶然挨着。`, "");
    mkdirSync("docs/sim", { recursive: true });
    writeFileSync(`docs/sim/report${SELL ? "" : "-nosell"}.md`, lines.join("\n").trimEnd() + "\n");
  }, 600_000);
});
