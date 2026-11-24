import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { RELICS } from "../data/relics";
import { previewFor } from "../game/combat";
import * as bag from "../game/bag";
import * as R from "../game/run";
import { sellPrice } from "../game/inventory";
import type { GoodId } from "../game/types";
import { ART } from "../render/assets";
import { BagGrid } from "./Bag";
import { Art, CardView, GoodChip, GoodInfo, relicIcon } from "./parts";
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
  const buy = (ok: boolean | string | null, what: string) => {
    if (ok === true || ok === null) { sfx.coin(); setLine(`${what}归你了。`); settlePose(); commit(); }
    else say(typeof ok === "string" ? ok : "石不够");
  };
  // Buying takes two taps: the first marks the ware ("再点一下买下"), the second pays. Tapping elsewhere clears it.
  const [armed, setArmed] = useState<string | null>(null);
  const tap = (key: string, act: () => void) => {
    if (armed !== key) { sfx.click(); setArmed(key); return; }
    setArmed(null); act();
  };
  const arm = (key: string) => (armed === key ? "armed" : "");
  // Look before you buy: hovering a ware (mouse) or the first tap shows its full details above it.
  const [hovered, setHovered] = useState<string | null>(null);
  const look = (key: string) => ({
    onPointerEnter: (e: PointerEvent) => { if (e.pointerType === "mouse") setHovered(key); },
    onPointerLeave: () => setHovered((h) => (h === key ? null : h)),
  });
  const showing = (key: string) => armed === key || hovered === key;
  return (
    <div class="shop" onPointerDown={(e) => { if (armed && !(e.target as HTMLElement).closest(".ware")) setArmed(null); }} style={{ backgroundImage: `linear-gradient(rgba(10,5,4,0.55), rgba(10,5,4,0.85)), url(${ART.market})` }}>
      <div class="shop-keeper">
        <img src={ART[pose]} alt="绯绡" draggable={false} />
        <MarketBoard />
        <div class="speech">{line}</div>
      </div>
      <div class="shop-table">
        <div class="shop-row">
          <h3>技法 <small>学了就进牌组</small></h3>
          <div class="wares">
            {s.cards.map((w, i) => (
              <div class={`ware ${w.sold ? "sold" : ""} ${arm(`card${i}`)}`}>
                <CardView id={w.id} up={false} preview={preview} small onClick={() => !w.sold && tap(`card${i}`, () => buy(R.buyCard(run, i), `「${CARDS[w.id].name}」`))} />
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
                <button type="button" class={`ware item-ware ${w.sold ? "sold" : ""} ${arm(`${list}${i}`)}`} onClick={() => !w.sold && tap(`${list}${i}`, () => buy(R.buyItem(run, list, i), g.name))}
                  {...look(`${list}${i}`)}>
                  {showing(`${list}${i}`) && !w.sold && <div class="ware-info"><GoodInfo id={w.id} price={`${w.price} 石`} note={`占 ${size.w}×${size.h} 格`} /></div>}
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
              <button type="button" class={`ware item-ware ${w.sold ? "sold" : ""} ${arm(`relic${i}`)}`} onClick={() => !w.sold && tap(`relic${i}`, () => buy(R.buyRelic(run, i), RELICS[w.id].name))}
                {...look(`relic${i}`)}>
                {showing(`relic${i}`) && !w.sold && <div class="ware-info"><div class="good-info"><div class="gi-head"><Art id={relicIcon(w.id)} /><div><b>{RELICS[w.id].name}</b><span>法宝 · 不占格子 · {w.price} 石</span></div></div><p>{RELICS[w.id].text}</p></div></div>}
                <Art id={relicIcon(w.id)} />
                <b>{RELICS[w.id].name}</b>
                <span class="desc">{RELICS[w.id].text}</span>
                <span class={`tag-price ${run.gold < w.price ? "poor" : ""}`}>{w.sold ? "已售" : `${w.price} 石`}</span>
              </button>
            ))}
            <button type="button" class={`ware item-ware service ${arm("oil")}`} onClick={() => tap("oil", () => buy(R.buyOil(run), "灯油"))} title="每买一次贵 2 石">
              <Art id="lamp" />
              <b>灯油 +{s.oil.amount}</b>
              <span class="desc">每走一步烧 1 点。你现在有 {run.oil} / {run.maxOil}。</span>
              <span class={`tag-price ${run.gold < R.oilCost(run) ? "poor" : ""}`}>{R.oilCost(run)} 石</span>
            </button>
            <button type="button" class={`ware item-ware service ${s.removed ? "sold" : ""} ${arm("remove")}`} onClick={() => !s.removed && tap("remove", () => (R.startRemove(run) ? commit() : say("石不够")))}>
              <Art id="grit" />
              <b>删一张牌</b>
              <span class="desc">把不想要的牌从牌组里去掉。</span>
              <span class={`tag-price ${run.gold < s.removePrice ? "poor" : ""}`}>{s.removed ? "已用" : `${s.removePrice} 石`}</span>
            </button>
          </div>
        </div>
      </div>
      <div class="shop-sell panel">
        <h3>卖货 <small>点一下看价，再点一下卖出。绯绡压价收货，大约是带回镇上折库银的六成（随行情浮动）；同一种卖得越多越便宜。装备半价回收</small></h3>
        <p class="wanted">今天高价收：<GoodChip id={s.wanted} /> 价格翻倍</p>
        <BagGrid mode="sell" cell={44} />
        {run.orders.map((_, i) => {
          const prog = R.orderProgress(run, i);
          return (
            <div class="order-box">
              <b>委托 · {prog.order.client}{prog.ord.level ? ` · 交情 ${prog.ord.level}` : ""}</b>
              {prog.ord.done ? <span class="done">已交付</span> : prog.order.onReturn ? <span>回镇时自动交付</span> : (
                <>
                  <span>{prog.parts.map((p) => `${GOODS[p.id].name} ${Math.min(p.have, p.need)}/${p.need}`).join("，")}</span>
                  <button type="button" class="btn small primary" disabled={!prog.ready} onClick={() => { const r = R.deliverOrder(run, i); if (r) { sfx.coin(); setLine(r); commit(); } }}>
                    {prog.ready ? `交货 · ${R.orderRewardText(prog.ord)}` : "货还不够"}
                  </button>
                </>
              )}
            </div>
          );
        })}
        <button type="button" class="btn big leave" onClick={() => { sfx.click(); run.at = null; run.screen = "explore"; commit(); }}>离开狐市</button>
      </div>
    </div>
  );
}

/** 行情牌: what this shop pays for each good right now, and the next floor's prices if a 道友 told you. */
function MarketBoard() {
  const run = useRun();
  const held = new Set(run.bag.items.map((i) => i.id));
  const goods = R.TRADE_GOODS.filter((g) => g !== "clasp-broken");
  return (
    <div class="market-board">
      <h4>行情牌{run.rumor && run.floor < 3 ? <small> · 括号里是上一层的价</small> : null}</h4>
      <ul>
        {goods.map((g: GoodId) => {
          const now = sellPrice(run, g);
          const up = run.rumor && run.floor < 3 ? sellPrice(run, g, (run.floor + 1) as 2 | 3, 0) : null;
          return (
            <li class={`${held.has(g) ? "held" : ""} ${run.shop?.wanted === g ? "wanted" : ""}`}>
              <img src={ART[GOODS[g].icon]} alt="" />
              <span>{GOODS[g].name}</span>
              <b>{now}</b>
              {up !== null && <em class={up > now ? "up" : up < now ? "down" : ""}>({up})</em>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
