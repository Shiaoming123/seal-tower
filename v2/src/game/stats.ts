// Playtest counters (GAME-001): small tallies of the choices the playtest plan asks about, and the
// plain-text record a tester can copy from the result screen. Counters are optional on RunStats so
// saves from before they existed still load.
import { STARTER_GEAR } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { GOODS } from "../data/goods";
import type { RunState } from "./types";

type Count = "elitesFought" | "elitesSkipped" | "soldValue" | "refines" | "cracks" | "pouchStash" | "sews" | "ordersDone" | "leftBehind";

export function bump(run: RunState, k: Count, n = 1) {
  run.stats[k] = (run.stats[k] ?? 0) + n;
}

/** Leaving a floor alive (stairs, going home, the final win): count elites left unfought and the 气血 you left with. */
export function noteFloorEnd(run: RunState) {
  bump(run, "elitesSkipped", run.dungeon.entities.filter((e) => e.kind === "elite" && !e.done).length);
  (run.stats.hpAtFloorEnd ??= []).push(run.hp);
}

const OUTCOME = { win: "通关", dead: "倒下", retreat: "中途回镇" } as const;

/** The text a tester copies and sends back. `carried` comes from settle(); `runNo` is this player's run count. */
export function playtestRecord(run: RunState, carried: number, runNo: number, now = Date.now()): string {
  const s = run.stats;
  const mins = s.startedAt ? Math.max(1, Math.round((now - s.startedAt) / 60000)) : null;
  const end = run.outcome === "dead"
    ? `倒在第 ${run.floor} 层${s.killedBy ? `（${ENEMIES[s.killedBy]?.name ?? s.killedBy}）` : ""}`
    : `${OUTCOME[run.outcome ?? "retreat"]}，到达第 ${run.floor} 层`;
  return [
    "斩妖塔试玩记录 v1",
    `本机第 ${runNo} 局 · 签号 ${run.seed} · 兵器 ${GOODS[STARTER_GEAR[run.weapon]]?.name ?? run.weapon} · 难度 ${run.difficulty}`,
    `结局：${end}`,
    `回合 ${s.turns}，步数 ${s.steps}${mins ? `，用时约 ${mins} 分钟` : ""}`,
    `每层离开时气血：${s.hpAtFloorEnd?.length ? s.hpAtFloorEnd.join(" / ") : "—"}（上限 ${run.maxHp}）`,
    `精英：打了 ${s.elitesFought ?? 0}，没打就离开 ${s.elitesSkipped ?? 0}`,
    `在狐市卖出 ${s.goodsSold} 件，得 ${s.soldValue ?? 0} 石；带回镇上折库银 ${carried} 石`,
    `上楼或回镇时留下 ${s.leftBehind ?? 0} 件货`,
    `委托完成 ${s.ordersDone ?? 0} · 淬炼 ${s.refines ?? 0} · 磕坏 ${s.cracks ?? 0} · 放进侧袋 ${s.pouchStash ?? 0} 次 · 缝衬布 ${s.sews ?? 0} 次`,
    `取材成功 ${s.harvests}，打倒 ${s.kills} 只妖`,
  ].join("\n");
}
