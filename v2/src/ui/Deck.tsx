import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { combatDeck, previewFor } from "../game/combat";
import * as bag from "../game/bag";
import * as R from "../game/run";
import type { CombatState } from "../game/types";
import { CardView, Term, upgradeDiff } from "./parts";
import { type CombatPile, commit, overlay, useRun } from "./store";

export function DeckOverlay() {
  const run = useRun();
  const deck = combatDeck(run);
  const preview = previewFor(run, null);
  // Grouped by where each card comes from (REVIEW-001): the base deck, then every gear item in the bag with the
  // bonus its neighbours give. Moving a gear item out of the bag takes its whole group with it.
  const base = deck.filter((c) => !c.from);
  const gear = run.bag.items.filter((it) => GOODS[it.id].cards?.length);
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) overlay.value = null; }}>
      <div class="overlay-box deck-box">
        <header><h2>牌组 <small>共 {deck.length} 张，其中 {deck.length - base.length} 张来自行囊里的装备</small></h2>
          <button type="button" class="btn small" onClick={() => (overlay.value = null)}>关闭 <kbd>Esc</kbd></button></header>
        <p class="muted deck-note">牌组 = 基础牌 + 行囊里每件<Term id="gear" />带来的牌。装备拿出行囊，它那一组牌就不在了；<Term id="aura" />挨着装备，那一组牌会变强。</p>
        <section class="deck-group">
          <h3 class="deck-group-title">基础牌 <small>{base.length} 张 · 学牌、升级、移除都改这里</small></h3>
          <div class="card-grid">
            {base.map((c) => <CardView id={c.id} up={c.up} preview={preview} small />)}
          </div>
        </section>
        {gear.map((it) => {
          const g = GOODS[it.id];
          // Neighbours' bonus and the refined item's own bonus are named apart (REVIEW-001).
          const aDmg = bag.auraOn(run.bag, it, "dmg"), aBlk = bag.auraOn(run.bag, it, "blk");
          const sDmg = g.selfBonus?.dmg ?? 0, sBlk = g.selfBonus?.blk ?? 0;
          const b = aDmg + sDmg || aBlk + sBlk ? { dmg: aDmg + sDmg, blk: aBlk + sBlk } : undefined;
          const near = bag.neighbours(run.bag, it).filter((o) => GOODS[o.id].aura?.kind === "dmg" || GOODS[o.id].aura?.kind === "blk").map((o) => GOODS[o.id].name);
          const parts = [aDmg || aBlk ? `挨着${near.join("、")}：${[aDmg ? `伤害 +${aDmg}` : "", aBlk ? `格挡 +${aBlk}` : ""].filter(Boolean).join("、")}` : "",
            sDmg || sBlk ? `精炼自带：${[sDmg ? `伤害 +${sDmg}` : "", sBlk ? `格挡 +${sBlk}` : ""].filter(Boolean).join("、")}` : ""].filter(Boolean);
          const bonus = parts.join(" · ");
          return (
            <section class="deck-group gear">
              <h3 class="deck-group-title">来自{g.name} <small>{g.cards!.length} 张{g.cardsUp ? " · 已淬炼，牌是升级版" : ""}{bonus ? ` · ${bonus}` : ""}</small></h3>
              <div class="card-grid">
                {g.cards!.map((id) => <CardView id={id} up={!!g.cardsUp} bonus={b} preview={preview} small />)}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

export const PILE_LABELS = [
  ["draw", "抽牌堆"], ["discard", "弃牌堆"], ["exhaust", "消耗牌堆"],
] as const satisfies ReadonlyArray<readonly [CombatPile, string]>;

const PILE_NOTE: Record<CombatPile, string> = {
  draw: "按牌种排列，实际抽牌顺序隐藏。打出的心法这场一直生效，不回到任何牌堆。",
  discard: "抽牌堆用完后，弃牌会洗回抽牌堆。",
  exhaust: "这些牌本场战斗不会再抽到。",
};

export function PileOverlay({ combat, pile }: { combat: CombatState; pile: CombatPile }) {
  const run = useRun();
  const closeRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    closeRef.current?.focus();
    return () => {
      requestAnimationFrame(() => {
        if (!overlay.value) document.querySelector<HTMLButtonElement>(`[data-combat-pile="${pile}"]`)?.focus();
      });
    };
  }, []);
  const close = () => { sfx.click(); overlay.value = null; };
  const label = PILE_LABELS.find(([id]) => id === pile)![1];
  const cards = [...combat[pile]];
  if (pile === "draw") cards.sort((a, b) => a.id.localeCompare(b.id) || a.uid - b.uid);
  else cards.reverse();
  const preview = previewFor(run, combat);
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="overlay-box pile-box" role="dialog" aria-modal="true" aria-labelledby="pile-title">
        <header>
          <h2 id="pile-title">{label}</h2>
          <button ref={closeRef} type="button" class="btn small" onClick={close}>关闭 <kbd>Esc</kbd></button>
        </header>
        <div class="pile-switch" role="group" aria-label="切换牌堆">
          {PILE_LABELS.map(([id, name]) => (
            <button type="button" class={`btn small ${id === pile ? "primary" : ""}`} aria-pressed={id === pile}
              onClick={() => { sfx.click(); overlay.value = id; }}>{name} <b>{combat[id].length}</b></button>
          ))}
        </div>
        <p class="pile-note muted">{PILE_NOTE[pile]}</p>
        <div class="pile-scroll" key={pile}>
          {cards.length ? <div class="pile-card-grid">
            {cards.map(card => <CardView key={card.uid} id={card.id} up={card.up} bonus={card.bonus} preview={preview} readOnly />)}
          </div> : <p class="pile-empty">这个牌堆现在是空的。</p>}
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
  const copy = pick.mode === "copy";
  const options = run.deck.filter((c) => !upgrade || !c.up);
  // Two taps, like every other choice (UI-008): the first picks the card, the second (or the button) applies it.
  const [chosen, setChosen] = useState<number | null>(null);
  // An event pick was already paid for (blood, a good). Walking away must say so and take two taps (REVIEW-001).
  const [skipArmed, setSkipArmed] = useState(false);
  const paid = !!pick.paid;
  const apply = (uid: number) => { sfx.click(); R.applyCardPick(run, uid); setChosen(null); commit(); };
  const skip = () => {
    if (paid && !skipArmed) { sfx.click(); setSkipArmed(true); return; }
    R.applyCardPick(run, null); setSkipArmed(false); commit();
  };
  const chosenCard = options.find((c) => c.uid === chosen);
  const verb = upgrade ? "升级" : copy ? "复制" : "移除";
  const title = upgrade ? "选一张牌升级" : copy ? "选一张牌复制" : `选一张牌移除${pick.price ? `（${pick.price} 石）` : ""}`;
  const note = upgrade ? "下面显示的是升级后的样子，牌下写着升级改了什么。点一张选中，再点一次确认。装备带来的牌不能在这里改。"
    : copy ? "选中的牌会多一张一模一样的（升级过的照样是升级版）。点一张选中，再点一次确认。装备带来的牌不能在这里复制。"
    : "牌组越精，关键牌越容易抽到。点一张选中，再点一次确认。装备带来的牌不能在这里移除。";
  return (
    <div class="overlay">
      <div class="overlay-box deck-box">
        <header>
          <h2>{title}</h2>
          <button type="button" class={`btn small ${skipArmed ? "danger" : "ghost"}`} onClick={skip}>
            {pick.source === "shop" ? "算了" : skipArmed ? "确定不选（代价不退）" : "不选了"}
          </button>
        </header>
        <p class="muted">{note}</p>
        {skipArmed && <p class="warn-line">已经付过的代价不会退回。再点一次「确定不选」离开。</p>}
        {chosenCard && (
          <div class="row pick-confirm">
            <button type="button" class="btn primary" onClick={() => apply(chosenCard.uid)}>{verb}「{CARDS[chosenCard.id].name}」</button>
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
