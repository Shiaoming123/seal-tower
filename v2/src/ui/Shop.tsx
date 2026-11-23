import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { RELICS } from "../data/relics";
import { previewFor } from "../game/combat";
import * as bag from "../game/bag";
import * as R from "../game/run";
import { ART } from "../render/assets";
import { BagGrid } from "./Bag";
import { Art, CardView, GoodChip } from "./parts";
import { commit, say, useRun } from "./store";

const LINES = [
  "货架上的都能拿，石头放下就行。你行囊里的东西，我也收。",
  "今天高价收的东西写在牌子上了，有就拿来。",
  "兵器放进行囊才算数——放不下的，买了也是白买。",
];

export function Shop() {
  const run = useRun();
  const s = run.shop!;
  const preview = previewFor(run, null);
  const [line, setLine] = useState(LINES[run.floor - 1] ?? LINES[0]);
  const [pose, setPose] = useState<"feixiao" | "feixiao-settle">("feixiao");
  const settlePose = () => { setPose("feixiao-settle"); setTimeout(() => setPose("feixiao"), 1400); };
  const prog = R.orderProgress(run);
  const buy = (ok: boolean | string | null, what: string) => {
    if (ok === true || ok === null) { sfx.coin(); setLine(`${what}归你了。`); settlePose(); commit(); }
    else say(typeof ok === "string" ? ok : "石不够");
  };
  return (
    <div class="shop" style={{ backgroundImage: `linear-gradient(rgba(10,5,4,0.55), rgba(10,5,4,0.85)), url(${ART.market})` }}>
      <div class="shop-keeper">
        <img src={ART[pose]} alt="绯绡" draggable={false} />
        <div class="speech">{line}</div>
      </div>
      <div class="shop-table">
        <div class="shop-row">
          <h3>技法 <small>学了就进牌组</small></h3>
          <div class="wares">
            {s.cards.map((w, i) => (
              <div class={`ware ${w.sold ? "sold" : ""}`}>
                <CardView id={w.id} up={false} preview={preview} small onClick={() => !w.sold && buy(R.buyCard(run, i), `「${CARDS[w.id].name}」`)} />
                <span class={`tag-price ${run.gold < w.price ? "poor" : ""}`}>{w.sold ? "已售" : `${w.price} 石`}</span>
              </div>
            ))}
          </div>
        </div>
        <div class="shop-row">
          <h3>装备与杂货 <small>要放进行囊</small></h3>
          <div class="wares items">
            {[...s.gear.map((w, i) => ({ w, i, list: "gear" as const })), ...s.consumables.map((w, i) => ({ w, i, list: "consumables" as const }))].map(({ w, i, list }) => {
              const g = GOODS[w.id];
              const size = bag.sizeOf(w.id, 0);
              return (
                <button type="button" class={`ware item-ware ${w.sold ? "sold" : ""}`} onClick={() => !w.sold && buy(R.buyItem(run, list, i), g.name)}
                  title={g.text}>
                  <img src={ART[g.icon]} alt="" draggable={false} />
                  <b>{g.name}</b>
                  <span class="shape">{size.w}×{size.h}</span>
                  <span class="desc">{g.cards ? `牌：${g.cards.map((c) => CARDS[c].name).join("、")}` : ""}{g.passive ? ` ${g.passive}` : ""}{g.use ? g.use.label : ""}</span>
                  <span class={`tag-price ${run.gold < w.price ? "poor" : ""}`}>{w.sold ? "已售" : `${w.price} 石`}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div class="shop-row">
          <h3>法宝 <small>不占格子</small></h3>
          <div class="wares items">
            {s.relics.map((w, i) => (
              <button type="button" class={`ware item-ware ${w.sold ? "sold" : ""}`} onClick={() => !w.sold && buy(R.buyRelic(run, i), RELICS[w.id].name)}>
                <Art id={RELICS[w.id].icon} />
                <b>{RELICS[w.id].name}</b>
                <span class="desc">{RELICS[w.id].text}</span>
                <span class={`tag-price ${run.gold < w.price ? "poor" : ""}`}>{w.sold ? "已售" : `${w.price} 石`}</span>
              </button>
            ))}
            <button type="button" class={`ware item-ware service ${s.removed ? "sold" : ""}`} onClick={() => !s.removed && (R.startRemove(run) ? commit() : say("石不够"))}>
              <Art id="grit" />
              <b>删一张牌</b>
              <span class="desc">把不想要的牌从牌组里去掉。</span>
              <span class={`tag-price ${run.gold < s.removePrice ? "poor" : ""}`}>{s.removed ? "已用" : `${s.removePrice} 石`}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="shop-sell panel">
        <h3>卖货 <small>点行囊里的货直接卖出（装备不在这里卖）</small></h3>
        <p class="wanted">今天高价收：<GoodChip id={s.wanted} /> 价格翻倍</p>
        <BagGrid mode="sell" cell={44} />
        <div class="order-box">
          <b>委托 · {prog.order.client}</b>
          {run.orderDone ? <span class="done">已交付</span> : prog.order.onReturn ? <span>回镇时自动交付</span> : (
            <>
              <span>{prog.parts.map((p) => `${GOODS[p.id].name} ${Math.min(p.have, p.need)}/${p.need}`).join("，")}</span>
              <button type="button" class="btn small primary" disabled={!prog.ready} onClick={() => { const r = R.deliverOrder(run); if (r) { sfx.coin(); setLine(r); commit(); } }}>
                {prog.ready ? `交货 · ${prog.order.rewardText}` : "货还不够"}
              </button>
            </>
          )}
        </div>
        <button type="button" class="btn big leave" onClick={() => { sfx.click(); run.at = null; run.screen = "explore"; commit(); }}>离开狐市</button>
      </div>
    </div>
  );
}
