import { useEffect, useState } from "preact/hooks";
import { ORDERS } from "../data/orders";
import { ACHIEVEMENTS } from "../data/achievements";
import { MAX_FAVOR } from "../data/town";
import * as R from "../game/run";
import { playtestRecord } from "../game/stats";
import { ART } from "../render/assets";
import { clearRun, commit, page, playtest, profileSig, runSig, today, useRun } from "./store";

export function Result() {
  const run = useRun();
  // Settle once: renown, orders and newly earned achievements.
  const [settled] = useState(() => {
    const base = R.settle(run);
    if (base.carried >= 150) R.flag(run, "loaded");
    const p = profileSig.value;
    const ordersDone = [...new Set([...p.ordersDone, ...base.delivered])];
    const favor = { ...p.favor };
    for (const id of base.delivered) favor[id] = Math.min(MAX_FAVOR, (favor[id] ?? 0) + 1);
    const next = { ...p, ordersDone, favor };
    const fresh = ACHIEVEMENTS.filter((a) => !p.achievements.includes(a.id) && a.check(run, next));
    return { ...base, ordersDone, favor, fresh, renown: base.renown + fresh.reduce((s, a) => s + a.renown, 0) };
  });
  useEffect(() => {
    const p = profileSig.value;
    profileSig.value = {
      ...p, renown: p.renown + settled.renown, wins: p.wins + (run.outcome === "win" ? 1 : 0),
      bestFloor: Math.max(p.bestFloor, R.floorsCleared(run)), ordersDone: settled.ordersDone,
      favor: settled.favor, treasury: p.treasury + settled.carried,
      daily: run.flags.includes("daily") ? bestDaily(p.daily, R.floorsCleared(run), run.outcome === "win") : p.daily,
      achievements: [...p.achievements, ...settled.fresh.map((a) => a.id)],
    };
    clearRun();
    commit();
  }, []);
  const title = run.outcome === "win" ? "镇塔钟又响了" : run.outcome === "dead" ? "倒在了塔里" : "带着货回到镇上";
  const sub = run.outcome === "win"
    ? "负钟君倒下，塔里的妖散了大半。镇上的灯会一盏盏重新亮起来。"
    : run.outcome === "dead" ? "道友把你拖了出来。货丢了，但塔还在，下次换个打法。" : "活着回来就有下一趟。";
  const s = run.stats;
  const [record] = useState(() => playtestRecord(run, settled.carried, profileSig.value.runs));
  return (
    <div class={`result outcome-${run.outcome}`} style={{ backgroundImage: `linear-gradient(rgba(10,5,4,0.5), rgba(10,5,4,0.85)), url(${ART["last-market"]})` }}>
      <div class="result-art"><img src={ART[run.outcome === "dead" ? "hunter-guard" : "hero"]} alt="" /></div>
      <div class="result-box panel">
        <div class="result-scroll">
        <h1>{title}</h1>
        <p>{sub}</p>
        <ul class="stats">
          <li>到达 <b>第 {run.floor} 层</b>，打通 {R.floorsCleared(run)} 层</li>
          <li>打倒 <b>{s.kills}</b> 只妖，共 {s.turns} 回合</li>
          <li>赚到 <b>{s.goldEarned}</b> 石，卖出 {s.goodsSold} 件货，战斗里烧掉 {s.goodsUsed} 件</li>
          <li>取材成功 <b>{s.harvests}</b> 次，走了 {s.steps} 步</li>
          {run.orders.map((o) => <li>委托「{ORDERS[o.id].title}」：{o.done ? `已完成，${ORDERS[o.id].client}的交情 +1` : "没完成"}</li>)}
        </ul>
        <h3>{settled.carried ? `带回镇灯铺 ${settled.carried} 石` : "什么也没带回来"}</h3>
        <ul class="carried">{settled.carriedLines.map((l) => <li>{l}</li>)}</ul>
        <p class="muted">库银现在是 {profileSig.value.treasury} 石，可以在镇灯铺营建。</p>
        <h3>声望 +{settled.renown}</h3>
        <ul class="renown">
          {settled.lines.map((l) => <li>{l}</li>)}
          {settled.fresh.map((a) => <li class="ach">新成就「{a.name}」：{a.text} +{a.renown}</li>)}
          {!settled.lines.length && !settled.fresh.length && <li>这趟没挣到声望。</li>}
        </ul>
        <p class="muted">总声望 {profileSig.value.renown}。声望到 4 解锁「算盘」兵器；到 3、7、12 解锁更难的签。</p>
        </div>
        {/* Outside the scrolling list: after a win the list (achievements, renown) can be taller than the stage. */}
        <div class="row result-actions">
          <button type="button" class="btn big primary" onClick={() => { runSig.value = null; page.value = "town"; commit(); }}>再进一趟</button>
          <button type="button" class="btn" onClick={() => { runSig.value = null; page.value = "title"; commit(); }}>回标题</button>
        </div>
        <p class="seed">本趟签号 {run.seed}（网址加 ?seed= 可重走同一座塔）</p>
        {playtest && <PlaytestRecord text={record} />}
      </div>
    </div>
  );
}

/** Playtest mode: the run record to copy and send back, with a select-all box if the clipboard is blocked. */
function PlaytestRecord({ text }: { text: string }) {
  const [state, setState] = useState<"" | "ok" | "manual">("");
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setState("ok"); } catch { setState("manual"); }
  };
  return (
    <div class="playtest-record">
      <button type="button" class="btn" onClick={copy}>{state === "ok" ? "已复制，发给我们就行" : "复制本局试玩记录"}</button>
      {state === "manual" && <textarea readOnly rows={9} value={text} onFocus={(e) => (e.target as HTMLTextAreaElement).select()} />}
    </div>
  );
}

/** Keep today's best 每日签 result. */
function bestDaily(prev: { date: string; floor: number; win: boolean } | null, floor: number, win: boolean) {
  const date = today();
  if (!prev || prev.date !== date) return { date, floor, win };
  return { date, floor: Math.max(prev.floor, floor), win: prev.win || win };
}
