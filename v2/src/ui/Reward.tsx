import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { RELICS } from "../data/relics";
import { previewFor } from "../game/combat";
import * as R from "../game/run";
import { BagGrid } from "./Bag";
import { Art, CardView, LootSlot, countGoods, relicIcon } from "./parts";
import { useEffect, useRef, useState } from "preact/hooks";
import { useView } from "./Explore";
import { commit, useRun } from "./store";

export function Reward() {
  const run = useRun();
  const rw = run.reward!;
  const preview = previewFor(run, null);
  const title = rw.from === "chest" ? "打开宝箱" : rw.from === "guardian" ? "守关妖倒下了" : rw.from === "elite" ? "精英妖倒下了" : "妖倒下了";
  const pending = run.pending.length;
  const bg = useRef<HTMLDivElement>(null);
  // Choices take two taps: the first picks (and enlarges), the second — or the confirm button — takes it.
  const [pickCard, setPickCard] = useState<string | null>(null);
  const [pickRelic, setPickRelic] = useState<string | null>(null);
  // Leaving with a relic or a card offer still on the table takes two taps (REVIEW-001).
  const [leaveArmed, setLeaveArmed] = useState(false);
  const untaken = [rw.relic || rw.relicChoices ? "法宝" : "", rw.cards ? "新牌" : ""].filter(Boolean).join("和");
  const good = /取材成功|追回|淬炼/.test(rw.note);
  useEffect(() => { if (rw.note.includes("取材成功") || rw.note.includes("追回")) sfx.harvest(); }, []);
  useView(bg, run, { hideAll: true, dim: 0.65 });
  const learn = (id: string | null) => { if (id) sfx.card(); R.takeRewardCard(run, id); setPickCard(null); commit(); };
  const takeRelic = (id: string) => { sfx.coin(); R.takeRewardRelic(run, id); setPickRelic(null); commit(); };
  return (
    <div class={`reward from-${rw.from}`}>
      <div class="reward-bg" ref={bg} />
      <header class="reward-head">
        <h2 class="plaque">{title}</h2>
        <div class="loot-row">
          {rw.gold > 0 && (
            <div class="loot coin"><span class="loot-frame"><span class="coin-face">石</span></span><small>+{rw.gold} 石</small></div>
          )}
          {countGoods(rw.goods).map(([id, n]) => <LootSlot id={id} n={n} />)}
        </div>
        {rw.note && <p class={`ribbon ${good ? "ok" : "miss"}`}>{rw.note.trim()}</p>}
        {pending > 0 && <p class="pile-warn">装不下的 {pending} 件在货堆里：这一层一直跟着你，上楼或回镇前没装进行囊的会留下。</p>}
      </header>
      <section class="reward-bag panel">
        <h3 class="section-title">行囊 {pending > 0 && <span class="alert-text">· 货堆 {pending} 件</span>}</h3>
        <BagGrid mode="manage" cell={48} details="popover" />
      </section>
      <section class="reward-right">
        {rw.relic && (
          <div class="relic-offer panel">
            <Art id={relicIcon(rw.relic)} class="relic-big" />
            <div><b>法宝 · {RELICS[rw.relic].name}</b><p>{RELICS[rw.relic].text}</p></div>
            <button type="button" class="btn primary" onClick={() => takeRelic(rw.relic!)}>拿走</button>
          </div>
        )}
        {rw.relicChoices && (
          <div class="relic-choices panel">
            <h3 class="section-title">选一件法宝</h3>
            {rw.relicChoices.map((id) => (
              <button type="button" class={`relic-choice ${pickRelic === id ? "picked" : ""}`} onClick={() => (pickRelic === id ? takeRelic(id) : (sfx.click(), setPickRelic(id)))}>
                <Art id={relicIcon(id)} /><b>{RELICS[id].name}</b><span>{RELICS[id].text}</span>
              </button>
            ))}
            {pickRelic && <button type="button" class="btn primary confirm-pick" onClick={() => takeRelic(pickRelic)}>拿走「{RELICS[pickRelic].name}」</button>}
          </div>
        )}
        {rw.cards && (
          <div class="card-offer panel">
            <h3 class="section-title">学一招 <small>加入牌组</small></h3>
            <div class="card-row">
              {rw.cards.map((id) => (
                <CardView id={id} up={false} preview={preview} selected={pickCard === id}
                  onClick={() => (pickCard === id ? learn(id) : (sfx.click(), setPickCard(id)))} />
              ))}
            </div>
            <div class="row offer-actions">
              {pickCard
                ? <button type="button" class="btn primary confirm-pick" onClick={() => learn(pickCard)}>学「{CARDS[pickCard].name}」</button>
                : <span class="muted pick-hint">点一张牌看看，再点一次学会</span>}
              <button type="button" class="btn ghost" onClick={() => learn(null)}>不学</button>
            </div>
          </div>
        )}
        {leaveArmed && untaken && <p class="warn-line">{untaken}还没拿，离开就没了。</p>}
        <button type="button" class={`btn big continue ${leaveArmed && untaken ? "danger" : "primary"}`}
          onClick={() => {
            sfx.click();
            if (untaken && !leaveArmed) { setLeaveArmed(true); return; }
            R.closeReward(run); commit();
          }}>
          {leaveArmed && untaken ? "不要了，继续" : run.outcome === "win" ? `回镇结算${pending ? `（货堆 ${pending} 件会留下）` : ""}` : "继续"}
        </button>
      </section>
    </div>
  );
}
