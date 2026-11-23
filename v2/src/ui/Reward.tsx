import { sfx } from "../audio/sfx";
import { RELICS } from "../data/relics";
import { previewFor } from "../game/combat";
import * as R from "../game/run";
import { BagGrid } from "./Bag";
import { Art, CardView, GoodChip, countGoods, relicIcon } from "./parts";
import { useRef } from "preact/hooks";
import { useView } from "./Explore";
import { commit, useRun } from "./store";

export function Reward() {
  const run = useRun();
  const rw = run.reward!;
  const preview = previewFor(run, null);
  const title = rw.from === "chest" ? "打开宝箱" : rw.from === "guardian" ? "守关妖倒下了" : rw.from === "elite" ? "精英妖倒下了" : "妖倒下了";
  const pending = run.pending.length;
  const bg = useRef<HTMLDivElement>(null);
  useView(bg, run, { hideAll: true, dim: 0.65 });
  return (
    <div class="reward">
      <div class="reward-bg" ref={bg} />
      <div class="reward-left panel">
        <h2>{title}</h2>
        {rw.gold > 0 && <p class="gain">+{rw.gold} 石</p>}
        {rw.note && <p class="note">{rw.note}</p>}
        {rw.goods.length > 0 && (
          <div class="gain-goods"><span>掉落：</span>{countGoods(rw.goods).map(([id, n]) => <GoodChip id={id} n={n} />)}</div>
        )}
        {rw.relic && (
          <div class="relic-offer">
            <Art id={relicIcon(rw.relic)} class="relic-big" />
            <div><b>法宝 · {RELICS[rw.relic].name}</b><p>{RELICS[rw.relic].text}</p></div>
            <button type="button" class="btn primary" onClick={() => { sfx.coin(); R.takeRewardRelic(run, rw.relic!); commit(); }}>拿走</button>
          </div>
        )}
        {rw.relicChoices && (
          <div class="relic-choices">
            <h3>选一件法宝</h3>
            {rw.relicChoices.map((id) => (
              <button type="button" class="relic-choice" onClick={() => { sfx.coin(); R.takeRewardRelic(run, id); commit(); }}>
                <Art id={relicIcon(id)} /><b>{RELICS[id].name}</b><span>{RELICS[id].text}</span>
              </button>
            ))}
          </div>
        )}
        <h3 class="bag-title">行囊 {pending > 0 && <span class="alert-text">· {pending} 件没装下，拖进格子或先挪一挪</span>}</h3>
        <BagGrid mode="manage" cell={48} />
      </div>
      <div class="reward-right">
        {rw.cards && (
          <div class="card-offer panel">
            <h3>学一招（加入牌组）</h3>
            <div class="card-row">
              {rw.cards.map((id) => <CardView id={id} up={false} preview={preview} onClick={() => { sfx.card(); R.takeRewardCard(run, id); commit(); }} />)}
            </div>
            <button type="button" class="btn ghost" onClick={() => { R.takeRewardCard(run, null); commit(); }}>不学（牌组少一点更容易抽到好牌）</button>
          </div>
        )}
        <button type="button" class="btn big primary continue" onClick={() => { sfx.click(); R.closeReward(run); commit(); }}>
          {run.outcome === "win" ? "回镇结算" : "继续"}{pending ? `（${pending} 件没装的留在这里）` : ""}
        </button>
      </div>
    </div>
  );
}
