import { GOODS } from "../data/goods";
import { combatDeck, previewFor } from "../game/combat";
import * as R from "../game/run";
import { CardView } from "./parts";
import { commit, overlay, useRun } from "./store";

export function DeckOverlay() {
  const run = useRun();
  const deck = combatDeck(run);
  const preview = previewFor(run, null);
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) overlay.value = null; }}>
      <div class="overlay-box deck-box">
        <header><h2>牌组 <small>共 {deck.length} 张，其中 {deck.filter((c) => c.from).length} 张来自行囊里的装备</small></h2>
          <button type="button" class="btn small" onClick={() => (overlay.value = null)}>关闭 <kbd>Esc</kbd></button></header>
        <div class="card-grid">
          {deck.map((c) => (
            <CardView id={c.id} up={c.up} bonus={c.bonus} preview={preview} small extra={c.from ? <span class="from">来自{GOODS[c.from].name}</span> : undefined} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardPicker() {
  const run = useRun();
  const pick = run.cardPick!;
  const preview = previewFor(run, null);
  const upgrade = pick.mode === "upgrade";
  const options = run.deck.filter((c) => !upgrade || !c.up);
  return (
    <div class="overlay">
      <div class="overlay-box deck-box">
        <header>
          <h2>{upgrade ? "选一张牌升级" : `选一张牌移除${pick.price ? `（${pick.price} 石）` : ""}`}</h2>
          <button type="button" class="btn small ghost" onClick={() => { R.applyCardPick(run, null); commit(); }}>{pick.source === "shop" ? "算了" : "不选了"}</button>
        </header>
        <p class="muted">{upgrade ? "下面显示的是升级后的样子。装备带来的牌不能在这里改。" : "牌组越精，关键牌越容易抽到。装备带来的牌不能在这里移除。"}</p>
        <div class="card-grid">
          {options.map((c) => (
            <CardView id={c.id} up={upgrade ? true : c.up} preview={preview} small onClick={() => { R.applyCardPick(run, c.uid); commit(); }} />
          ))}
          {!options.length && <p>没有可以选的牌。</p>}
        </div>
      </div>
    </div>
  );
}
