// GAME-007: the goods reveal. When an event hands out several goods at once (翻货袋, 妖窝, 翻倒的货车), they come
// face down and turn over one by one, cheapest first, with a sound for each value tier and a gold build-up before
// a rare one — the small thrill of a draw. Tap anywhere to turn them all over at once.
import { useEffect, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { GOODS, townPrice, townPriceLabel } from "../data/goods";
import type { GoodId } from "../game/types";
import { ART } from "../render/assets";
import { goodTier } from "./parts";

const STEP = 650; // ms between turns
const BUILD = 450; // a rare pack glows this long before it turns

export function GoodsReveal({ goods, onDone }: { goods: GoodId[]; onDone: () => void }) {
  const order = [...goods].sort((a, b) => GOODS[a].price - GOODS[b].price);
  const calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [shown, setShown] = useState(calm ? order.length : 0);
  const [building, setBuilding] = useState(false);
  const done = shown >= order.length;

  useEffect(() => {
    if (done) return;
    const next = order[shown];
    const rare = goodTier(next) === "rare";
    let t2 = 0;
    const t1 = window.setTimeout(() => {
      if (rare) { setBuilding(true); sfx.harvest(); }
      t2 = window.setTimeout(() => {
        setBuilding(false);
        const tier = goodTier(next);
        if (tier === "rare") { sfx.win(); sfx.coin(); } else if (tier === "good") sfx.harvest(); else sfx.card();
        setShown((n) => n + 1);
      }, rare ? BUILD : 0);
    }, shown === 0 ? 350 : STEP);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [shown]);

  const skip = () => { if (!done) { sfx.card(); setBuilding(false); setShown(order.length); } };
  const total = order.reduce((s, g) => s + townPrice(g), 0);
  return (
    <div class="reveal" onClick={skip}>
      <h3 class="reveal-title">{done ? "翻出来的货" : "翻货……"}</h3>
      <div class="reveal-row">
        {order.map((g, i) => {
          const open = i < shown;
          const tier = goodTier(g);
          return (
            <div class={`reveal-card tier-${tier} ${open ? "open" : ""} ${!open && i === shown ? (building ? "building" : "next") : ""}`}>
              <div class="reveal-inner">
                <div class="reveal-back"><span>货</span></div>
                <div class="reveal-face">
                  {tier === "rare" && <span class="reveal-rays" />}
                  <img src={ART[GOODS[g].icon]} alt="" draggable={false} />
                  <b>{GOODS[g].name}</b>
                  <small>{townPriceLabel(g)}</small>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {done
        ? <button type="button" class="btn big primary" onClick={(e) => { e.stopPropagation(); sfx.click(); onDone(); }}>收下（带回镇共值 {total} 石）</button>
        : <p class="muted reveal-hint">点一下全部翻开</p>}
    </div>
  );
}
