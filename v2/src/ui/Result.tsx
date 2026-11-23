import { useEffect, useState } from "preact/hooks";
import { ORDERS } from "../data/orders";
import * as R from "../game/run";
import { ART } from "../render/assets";
import { clearRun, commit, page, profileSig, runSig, useRun } from "./store";

export function Result() {
  const run = useRun();
  const [settled] = useState(() => R.settle(run));
  useEffect(() => {
    const p = profileSig.value;
    const ordersDone = run.orderDone && !p.ordersDone.includes(run.order) ? [...p.ordersDone, run.order] : p.ordersDone;
    profileSig.value = {
      ...p, renown: p.renown + settled.renown, wins: p.wins + (run.outcome === "win" ? 1 : 0),
      bestFloor: Math.max(p.bestFloor, R.floorsCleared(run)), ordersDone,
    };
    clearRun();
    commit();
  }, []);
  const title = run.outcome === "win" ? "镇塔钟又响了" : run.outcome === "dead" ? "倒在了塔里" : "带着货回到镇上";
  const sub = run.outcome === "win"
    ? "负钟君倒下，塔里的妖散了大半。镇上的灯会一盏盏重新亮起来。"
    : run.outcome === "dead" ? "道友把你拖了出来。货丢了，但塔还在，下次换个打法。" : "活着回来就有下一趟。";
  const s = run.stats;
  return (
    <div class={`result outcome-${run.outcome}`} style={{ backgroundImage: `linear-gradient(rgba(10,5,4,0.5), rgba(10,5,4,0.85)), url(${ART["last-market"]})` }}>
      <div class="result-art"><img src={ART[run.outcome === "dead" ? "hunter-guard" : "hero"]} alt="" /></div>
      <div class="result-box panel">
        <h1>{title}</h1>
        <p>{sub}</p>
        <ul class="stats">
          <li>到达 <b>第 {run.floor} 层</b>，打通 {R.floorsCleared(run)} 层</li>
          <li>打倒 <b>{s.kills}</b> 只妖，共 {s.turns} 回合</li>
          <li>赚到 <b>{s.goldEarned}</b> 石，卖出 {s.goodsSold} 件货，战斗里烧掉 {s.goodsUsed} 件</li>
          <li>委托「{ORDERS[run.order].title}」：{run.orderDone ? "已完成" : "没完成"}</li>
        </ul>
        <h3>声望 +{settled.renown}</h3>
        <ul class="renown">{settled.lines.map((l) => <li>{l}</li>)}{!settled.lines.length && <li>这趟没挣到声望。</li>}</ul>
        <p class="muted">总声望 {profileSig.value.renown}。声望到 3、7、12 会解锁更难的签。</p>
        <div class="row">
          <button type="button" class="btn big primary" onClick={() => { runSig.value = null; page.value = "town"; commit(); }}>再进一趟</button>
          <button type="button" class="btn" onClick={() => { runSig.value = null; page.value = "title"; commit(); }}>回标题</button>
        </div>
        <p class="seed">本趟签号 {run.seed}（网址加 ?seed= 可重走同一座塔）</p>
      </div>
    </div>
  );
}
