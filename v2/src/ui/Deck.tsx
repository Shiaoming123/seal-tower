import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { combatDeck, previewFor } from "../game/combat";
import * as R from "../game/run";
import { CardView, upgradeDiff } from "./parts";
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
  // Two taps, like every other choice (UI-008): the first picks the card, the second (or the button) applies it.
  const [chosen, setChosen] = useState<number | null>(null);
  const apply = (uid: number) => { sfx.click(); R.applyCardPick(run, uid); setChosen(null); commit(); };
  const chosenCard = options.find((c) => c.uid === chosen);
  return (
    <div class="overlay">
      <div class="overlay-box deck-box">
        <header>
          <h2>{upgrade ? "选一张牌升级" : `选一张牌移除${pick.price ? `（${pick.price} 石）` : ""}`}</h2>
          <button type="button" class="btn small ghost" onClick={() => { R.applyCardPick(run, null); commit(); }}>{pick.source === "shop" ? "算了" : "不选了"}</button>
        </header>
        <p class="muted">{upgrade ? "下面显示的是升级后的样子，牌下写着升级改了什么。点一张选中，再点一次确认。装备带来的牌不能在这里改。" : "牌组越精，关键牌越容易抽到。点一张选中，再点一次确认。装备带来的牌不能在这里移除。"}</p>
        {chosenCard && (
          <div class="row pick-confirm">
            <button type="button" class="btn primary" onClick={() => apply(chosenCard.uid)}>{upgrade ? "升级" : "移除"}「{CARDS[chosenCard.id].name}」</button>
          </div>
        )}
        <div class="card-grid">
          {options.map((c) => {
            const diff = upgrade ? upgradeDiff(c.id) : [];
            return (
              <div class="pick-slot">
                <CardView id={c.id} up={upgrade ? true : c.up} preview={preview} small selected={chosen === c.uid}
                  onClick={() => (chosen === c.uid ? apply(c.uid) : (sfx.click(), setChosen(c.uid)))} />
                {upgrade && <span class={`up-diff ${diff.length ? "" : "none"}`}>{diff.length ? diff.join(" · ") : "数值不变"}</span>}
              </div>
            );
          })}
          {!options.length && <p>没有可以选的牌。</p>}
        </div>
      </div>
    </div>
  );
}
