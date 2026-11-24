import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS, REFINES, TAGS, TAG_IDS, kindLabel, stackMax, townPrice, townPriceLabel } from "../data/goods";
import * as bag from "../game/bag";
import { POUCH_SLOTS, canExpand, discard, pouchFits, sellPending, sewPiece, autoPackPending, fromPouch, moveItem, packPending, pendingToPouch, pouchFull, sellItem, sellPouch, sellPrice, toPouch, unpack, useItem } from "../game/inventory";
import type { GoodId, PlacedGood, RunState } from "../game/types";
import { ART } from "../render/assets";
import { ConceptTip, GoodInfo, Term, cardText } from "./parts";
import { previewFor } from "../game/combat";
import type { TermId } from "../data/glossary";
import { commit, overlay, say, useRun } from "./store";

type Held = { from: "bag"; uid: number; id: GoodId; rot: number } | { from: "pending" | "pouch"; index: number; id: GoodId; rot: number };

/** Is the pointer over the side pouch? */
const overPouch = (e: PointerEvent) => !!document.elementFromPoint(e.clientX, e.clientY)?.closest(".pouch");

const CELL = 64;

/** Pointer position in stage pixels (the stage is CSS-scaled, and fixed children follow its transform). */
function stagePoint(e: PointerEvent) {
  const st = document.querySelector(".stage") as HTMLElement;
  const r = st.getBoundingClientRect();
  const k = st.offsetWidth / r.width;
  return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k };
}

/**
 * The shaped inventory. Drag to move, R / right-click / the button to rotate.
 * Tapping an item selects it; the details panel has a fixed height so the page never jumps.
 */
/** `details`: "panel" shows the fixed details panel beside the grid; "popover" shows it as a small card next to the
 *  tapped item (screens with no room for the panel, like the fight reward). */
export function BagGrid({ mode, cell = CELL, details = "panel" }: { mode: "manage" | "sell"; cell?: number; details?: "panel" | "popover" }) {
  const run = useRun();
  const b = run.bag;
  const gridRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const [confirmSell, setConfirmSell] = useState<number | null>(null);
  // Confirming a pile sale remembers the slot *and* the good: handing in an order shifts the pile, and a second tap
  // must never sell a different good that slid into the same slot (REVIEW-001).
  const [pileSell, setPileSell] = useState<string | null>(null);
  /** Sewing a 扩囊衬布 on: the lining item's uid while the expander is open. */
  const [sewing, setSewing] = useState<number | null>(null);

  const cellAt = (cx: number, cy: number) => {
    const r = gridRef.current!.getBoundingClientRect();
    const x = Math.floor(((cx - r.left) / r.width) * b.w), y = Math.floor(((cy - r.top) / r.height) * b.h);
    return x >= 0 && y >= 0 && x < b.w && y < b.h ? { x, y } : null;
  };

  // Place the held item so the cell under the pointer is its first cell.
  const drop = (h: Held, at: { x: number; y: number } | null) => {
    if (!at) return false;
    const ok = h.from === "bag" ? moveItem(run, h.uid, at.x, at.y, h.rot)
      : h.from === "pouch" ? fromPouch(run, h.index, { x: at.x, y: at.y, rot: h.rot })
      : packPending(run, h.index, at.x, at.y, h.rot);
    if (ok) { sfx.click(); commit(); }
    return ok;
  };

  useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => { moved.current = true; setGhost(stagePoint(e)); setHover(cellAt(e.clientX, e.clientY)); };
    const onUp = (e: PointerEvent) => {
      const at = cellAt(e.clientX, e.clientY);
      if (moved.current && held.from !== "pouch" && overPouch(e)) {
        // Dropped on the side pouch.
        const ok = run.combat ? false : held.from === "bag" ? toPouch(run, held.uid) : pendingToPouch(run, held.index);
        if (ok) { sfx.click(); setSelected(null); commit(); }
        else say(run.combat ? "打架的时候腾不出手整理侧袋" : !pouchFits(held.id) ? "侧袋只放一格大的东西" : `侧袋只有 ${POUCH_SLOTS} 格，已经满了`);
      }
      else if (moved.current && !drop(held, at) && at) say("放不下：换个位置或先旋转");
      setHeld(null); setHover(null); setGhost(null);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "r" || e.key === "R") setHeld((h) => (h ? { ...h, rot: (h.rot + 1) % 4 } : h)); };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); window.removeEventListener("keydown", onKey); };
  }, [held]);

  const startDrag = (h: Held, e: PointerEvent) => {
    e.preventDefault();
    moved.current = false;
    setHeld(h);
    setGhost(stagePoint(e));
    // A quick tap can release before the drag listeners below are attached; don't leave the item stuck in hand.
    window.addEventListener("pointerup", () => { if (!moved.current) { setHeld(null); setHover(null); setGhost(null); } }, { once: true });
    if (h.from === "bag") setSelected(h.uid);
  };

  const sel = run.bag.items.find((it) => it.uid === selected) ?? null;
  // Popover details: next to the grid, level with the tapped item; a tap anywhere else closes it.
  const popRef = useRef<HTMLDivElement>(null);
  const popAt = (it: PlacedGood) => ({ left: `${b.w * cell + 12}px`, top: `${Math.max(0, Math.min(it.y, b.h - 2)) * cell}px`, "--below": `${(it.y + bag.sizeOf(it.id, it.rot).h) * cell + 8}px` } as never);
  useEffect(() => {
    if (details !== "popover" || selected === null) return;
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement;
      if (!popRef.current?.contains(t) && !t.closest(".bag-grid .item")) setSelected(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [details, selected]);
  // Items lit up by the selected accessory (or the accessories boosting the selected item).
  const linked = new Set(sel ? bag.neighbours(b, sel).filter((o) => GOODS[sel.id].aura || GOODS[o.id].aura).map((o) => o.uid) : []);
  const preview = held && hover ? { cells: bag.shapeOf(held.id, held.rot).map(([x, y]) => [x + hover.x, y + hover.y] as [number, number]), ok: bag.fits(b, held.id, hover.x, hover.y, held.rot, held.from === "bag" ? held.uid : -1) } : null;
  // Gold cells: where an accessory's boost reaches — for the one being dragged (at the drop spot) or the one selected.
  // Gear and accessories that will be refined (淬炼) after the next won fight.
  const refines = bag.pendingRefines(b);
  const refining = new Set(refines.flatMap((r) => [r.gear.uid, r.with.uid]));
  const reach = held && GOODS[held.id].aura ? (preview ? bag.auraCells(b, preview.cells) : [])
    : !held && sel && GOODS[sel.id].aura ? bag.auraCells(b, bag.footprint(sel)) : [];

  const rotateSelected = () => {
    if (!sel) return;
    for (const rot of [1, 2, 3].map((d) => (sel.rot + d) % 4)) {
      if (moveItem(run, sel.uid, sel.x, sel.y, rot)) { commit(); return; }
      const spot = bag.findSpot({ ...b, items: b.items.filter((i) => i.uid !== sel.uid) }, sel.id);
      if (spot && bag.fits(b, sel.id, spot.x, spot.y, rot, sel.uid)) { moveItem(run, sel.uid, spot.x, spot.y, rot); commit(); return; }
    }
    say("这里转不开，先挪一挪别的东西");
  };

  if (sewing !== null && run.bag.items.some((i) => i.uid === sewing)) {
    return <div class={`bag-wrap mode-${mode}`}><BagExpander run={run} uid={sewing} onDone={() => { setSewing(null); setSelected(null); }} /></div>;
  }

  return (
    <div class={`bag-wrap mode-${mode}`}>
      {mode === "sell" && (() => {
        // Selling: the good picked by the first tap is described here, above the grid (the panel is too narrow
        // and scrolls, so a popover beside the item would be cut off).
        const it = run.bag.items.find((x) => x.uid === confirmSell);
        // A fixed-height slot, so picking a good never pushes the grid down under your finger (REVIEW-001).
        return <div class="sell-slot">{it
          ? <div class="sell-info"><GoodInfo id={it.id} price={`卖 ${sellPrice(run, it.id, run.floor, run.shop?.sold[it.id] ?? 0, it.uid)} 石`} note="再点一下这件货卖出，点别的货换一件看" /></div>
          : <p class="sell-hint muted">点一件货看说明和卖价，再点一下卖出。</p>}</div>;
      })()}
      <div class={`bag-grid ${b.holes?.length ? "irregular" : ""}`} ref={gridRef} style={{ width: `${b.w * cell}px`, height: `${b.h * cell}px`, "--cell": `${cell}px` } as never}
        onContextMenu={(e) => { e.preventDefault(); if (held) setHeld({ ...held, rot: (held.rot + 1) % 4 }); else rotateSelected(); }}>
        {Array.from({ length: b.w * b.h }, (_, i) => bag.usable(b, i % b.w, Math.floor(i / b.w)) && <div class="cell" style={{ left: `${(i % b.w) * cell}px`, top: `${Math.floor(i / b.w) * cell}px` }} />)}
        {reach.map(([x, y]) => <div class="cell reach" style={{ left: `${x * cell}px`, top: `${y * cell}px` }} />)}
        {preview && preview.cells.map(([x, y]) => <div class={`cell preview ${preview.ok ? "ok" : "bad"}`} style={{ left: `${x * cell}px`, top: `${y * cell}px` }} />)}
        {b.items.map((it) => {
          const size = bag.sizeOf(it.id, it.rot);
          const g = GOODS[it.id];
          const isHeld = held?.from === "bag" && held.uid === it.uid;
          return (
            <div class={`item kind-${g.kind} ${selected === it.uid ? "selected" : ""} ${isHeld ? "held" : ""} ${g.dim ? "dim" : ""} ${linked.has(it.uid) ? "linked" : ""} ${g.aura ? "aura" : ""} ${g.base ? "fine" : ""} ${refining.has(it.uid) ? "refining" : ""}`}
              style={{ left: `${it.x * cell}px`, top: `${it.y * cell}px`, width: `${size.w * cell}px`, height: `${size.h * cell}px` }}
              onPointerDown={(e) => startDrag({ from: "bag", uid: it.uid, id: it.id, rot: it.rot }, e as unknown as PointerEvent)}
              onClick={() => {
                if (moved.current) return;
                if (mode === "sell") {
                  // Every sale takes two taps: the first shows the price, the second sells.
                  if (confirmSell !== it.uid) {
                    sfx.click();
                    setConfirmSell(it.uid);
                    say(`再点一次，${sellPrice(run, it.id, run.floor, run.shop?.sold[it.id] ?? 0, it.uid)} 石卖掉${g.name}${g.kind === "gear" ? "（它的牌也会离开牌组）" : ""}`, 3000);
                    return;
                  }
                  const p = sellItem(run, it.uid); sfx.coin(); say(`卖出${g.name}，得 ${p} 石`); setSelected(null); setConfirmSell(null); commit();
                }
                else setSelected(it.uid);
              }}>
              {bag.footprint(it).map(([x, y]) => <span class="foot" style={{ left: `${(x - it.x) * cell}px`, top: `${(y - it.y) * cell}px` }} />)}
              <img src={ART[g.icon]} alt={g.name} draggable={false} class="item-img"
                style={{ width: `${(it.rot % 2 ? size.h : size.w) * cell}px`, height: `${(it.rot % 2 ? size.w : size.h) * cell}px`, transform: `translate(-50%, -50%) rotate(${it.rot * 90 + (g.tilt?.[0] ?? 0)}deg) scale(${g.tilt?.[1] ?? 1})` }} />
              {mode === "sell" && <span class={`price ${confirmSell === it.uid ? "confirm" : ""}`}>{confirmSell === it.uid ? `卖?${sellPrice(run, it.id, run.floor, run.shop?.sold[it.id] ?? 0, it.uid)}` : sellPrice(run, it.id, run.floor, run.shop?.sold[it.id] ?? 0, it.uid)}</span>}
              {mode !== "sell" && <AuraBadge run={run} uid={it.uid} />}
              {bag.qty(it) > 1 && <span class="stack-n">×{bag.qty(it)}</span>}
              {g.base && <span class="fine-badge">精</span>}
              {refining.has(it.uid) && GOODS[it.id].cards && <span class="refine-badge">战后淬炼</span>}
            </div>
          );
        })}
      </div>
      {held && ghost && (
        <div class="drag-ghost" style={{ left: `${ghost.x}px`, top: `${ghost.y}px` }}>
          <img src={ART[GOODS[held.id].icon]} alt="" />
          <span class="keys-only">R 旋转</span>
        </div>
      )}
      {mode === "manage" && details === "panel" && <ItemDetails run={run} uid={sel?.uid ?? null} onRotate={rotateSelected} onDone={() => setSelected(null)} onSew={setSewing} />}
      {mode === "manage" && details === "popover" && sel && (
        <div class="item-pop" ref={popRef} style={popAt(sel)}>
          <button type="button" class="pop-close" aria-label="收起" onClick={() => setSelected(null)}>×</button>
          <ItemDetails run={run} uid={sel.uid} onRotate={rotateSelected} onDone={() => setSelected(null)} onSew={setSewing} />
        </div>
      )}
      <div class="bag-side">
        {mode !== "sell" && <TagSets run={run} />}
        {(mode !== "sell" || run.pouch.length > 0) && <Pouch run={run} mode={mode} held={held} onDrag={(index, e) => startDrag({ from: "pouch", index, id: run.pouch[index], rot: 0 }, e)} />}
      </div>
      {run.pending.length > 0 && (
        <div class="pending">
          <h4><Term id="pile" /> · {run.pending.length} 件 <small>{mode === "sell" ? "点一下看价，再点一下卖掉。" : "这一层一直跟着你，不生效也不会被偷。上楼或回镇前装进行囊，装不下的会留下。"}</small></h4>
          <div class="pending-list">
            {run.pending.map((id, index) => (
              <div class={`pending-item ${held?.from === "pending" && held.index === index ? "held" : ""} ${mode === "sell" && pileSell === `${index}:${id}` ? "confirm" : ""}`} title={GOODS[id].text}
                onPointerDown={(e) => { if (mode !== "sell") startDrag({ from: "pending", index, id, rot: 0 }, e as unknown as PointerEvent); }}
                onClick={() => {
                  // Outside selling a tap used to do nothing, so new players never learned the pile can be dragged (REVIEW-002).
                  if (mode !== "sell") { sfx.click(); say(`${GOODS[id].name}（${kindLabel(id)}）：${GOODS[id].text} 按住拖进行囊或侧袋就装上了。`, 4500); return; }
                  if (pileSell !== `${index}:${id}`) { sfx.click(); setPileSell(`${index}:${id}`); say(`再点一次，${sellPrice(run, id)} 石卖掉${GOODS[id].name}`, 3000); return; }
                  const p = sellPending(run, index); sfx.coin(); say(`卖出${GOODS[id].name}，得 ${p} 石`); setPileSell(null); commit();
                }}>
                <img src={ART[GOODS[id].icon]} alt="" draggable={false} />
                <span>{GOODS[id].name}</span>
                <small>{mode === "sell" ? `${pileSell === `${index}:${id}` ? "卖?" : ""}${sellPrice(run, id)} 石` : `${bag.sizeOf(id, 0).w}×${bag.sizeOf(id, 0).h}`}</small>
              </div>
            ))}
          </div>
          <button type="button" class="btn small" onClick={() => {
            const before = run.pending.length; autoPackPending(run); const packed = before - run.pending.length;
            sfx.click(); commit();
            // A full bag used to make this button silently do nothing (REVIEW-002).
            say(packed === 0 ? "行囊没有合适的空位，一件也装不下。丢掉或卖掉点东西，或者换个摆法。"
              : run.pending.length ? `装进 ${packed} 件，还有 ${run.pending.length} 件装不下。` : `${packed} 件都装进去了。`, 3000);
          }}>自动装</button>
        </div>
      )}
    </div>
  );
}

/** Throw a good away: two taps, one at a time off a stack. */
function DiscardButton({ run, uid, onDone }: { run: RunState; uid: number; onDone: () => void }) {
  const [sure, setSure] = useState(false);
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it) return null;
  const n = bag.qty(it);
  return (
    <button type="button" class={`btn small ${sure ? "danger" : "ghost"}`} onClick={() => {
      if (!sure) { sfx.click(); setSure(true); return; }
      discard(run, uid); sfx.drain(); setSure(false); if (n <= 1) onDone(); commit();
    }}>{sure ? `再点一下丢掉${n > 1 ? "一个" : ""}` : "丢掉"}</button>
  );
}

/** Card text outside a fight (no live numbers). */
const cardPreview = previewFor({ bag: { w: 1, h: 1, items: [] }, gold: 0, relics: [], combat: null } as never, null);

function ItemDetails({ run, uid, onRotate, onDone, onSew }: { run: RunState; uid: number | null; onRotate: () => void; onDone: () => void; onSew: (uid: number) => void }) {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it) return <div class="item-details empty"><p>点一件东西看详情。拖动可以挪位置<span class="keys-only">，右键或 R 旋转</span>。</p></div>;
  const g = GOODS[it.id];
  const inCombat = run.screen === "combat";
  const canUse = g.use && (g.use.inCombat || !inCombat) && !(g.use.bagRow && !canExpand(run));
  return (
    <div class="item-details">
      <div class="det-head"><img src={ART[g.icon]} alt="" /><div><b>{g.name}{bag.qty(it) > 1 ? ` ×${bag.qty(it)}` : ""}</b><span>{kindLabel(it.id)} · {townPriceLabel(it.id)}{stackMax(it.id) > 1 ? ` · 一格叠 ${stackMax(it.id)} 个` : ""}</span></div></div>
      <p class="det-text">{g.text}</p>
      {g.passive && <p class="det-passive">带在身上：{g.passive}</p>}
      {g.cards && (
        <div class="det-cards">
          <span class="det-label">放进行囊，牌组多出：</span>
          {(() => {
            // Same numbers as the deck shows: neighbours' bonus and the refined item's own bonus included (REVIEW-001).
            const dmg = bag.auraOn(run.bag, it, "dmg") + (g.selfBonus?.dmg ?? 0), blk = bag.auraOn(run.bag, it, "blk") + (g.selfBonus?.blk ?? 0);
            const bonus = dmg || blk ? { dmg, blk } : undefined;
            return g.cards.map((c) => { const def = CARDS[c]; return <span class="det-card"><b>「{def.name}{g.cardsUp ? "+" : ""}」</b>{cardText(def, !!g.cardsUp, bonus, cardPreview)}</span>; });
          })()}
        </div>
      )}
      {g.aura && <p class="det-aura"><Term id="aura" />：{g.aura.text}。现在挨着：{bag.neighbours(run.bag, it).map((o) => GOODS[o.id].name).join("、") || "什么也没有"}</p>}
      {(!g.aura || g.cards) && <AuraLine run={run} uid={it.uid} />}
      <RefineLine run={run} uid={it.uid} />
      {g.tags && g.tags.map((t) => {
        const n = bag.tagCounts(run.bag)[t];
        return <p class="det-tags">「{TAGS[t].name}」<Term id="set" />：现在 {n} 件　{TAGS[t].at[0]} 件：{TAGS[t].text[0]}；{TAGS[t].at[1]} 件：{TAGS[t].text[1]}</p>;
      })}
      {g.fragile && <p class="det-tags"><Term id="fragile" />：挨打时可能磕坏成「{GOODS[g.fragile].name}」。贴着镇货符、或这回合打过「护货」就不会坏；放在侧袋里也会坏。</p>}
      <div class="row">
        {canUse && <button type="button" class="btn small primary" onClick={() => {
          if (g.use!.bagRow) { onSew(it.uid); return; }
          const r = useItem(run, it.uid); if (r) { sfx.coin(); say(r); onDone(); commit(); }
        }}>{g.use!.label}</button>}
        {g.use?.bagRow && !canExpand(run) && <span class="muted">行囊已经到最大了</span>}
        <button type="button" class="btn small" onClick={onRotate}>旋转</button>
        {!inCombat && <button type="button" class="btn small" disabled={pouchFull(run) || !pouchFits(it.id)} title={!pouchFits(it.id) ? "侧袋只放一格大的东西" : undefined} onClick={() => { if (toPouch(run, it.uid)) { sfx.click(); onDone(); commit(); } }}>{pouchFits(it.id) ? "放进侧袋" : "太大，进不了侧袋"}</button>}
        <button type="button" class="btn small ghost" onClick={() => { unpack(run, it.uid); onDone(); commit(); }}>放回货堆</button>
        {!inCombat && <DiscardButton key={it.uid} run={run} uid={it.uid} onDone={onDone} />}
      </div>
    </div>
  );
}

/** Which bag ideas are in play right now, in the order a new player should meet them. */
function bagConcepts(run: RunState): TermId[] {
  const items = run.bag.items, ids: TermId[] = ["gear"];
  const tags = bag.tagCounts(run.bag);
  if (Object.values(tags).some((n) => n >= 1)) ids.push("set");
  if (items.some((it) => GOODS[it.id].aura)) ids.push("aura");
  if (bag.pendingRefines(run.bag).length || items.some((it) => REFINES.some((r) => r.gear === it.id || r.with === it.id))) ids.push("refine");
  if (items.some((it) => GOODS[it.id].fragile) || run.pouch.some((id) => GOODS[id].fragile)) ids.push("fragile");
  if (run.pending.length) ids.push("pile");
  if (items.some((it) => bag.qty(it) > 1)) ids.push("stack");
  if (run.pouch.length) ids.push("pouch");
  return ids;
}

export function BagOverlay() {
  const run = useRun();
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) overlay.value = null; }}>
      <div class="overlay-box bag-box">
        <header><h2>行囊 <small>{bag.cellCount(run.bag)} 格 · 带回镇约值 {run.bag.items.reduce((s, x) => s + townPrice(x.id) * bag.qty(x), 0) + run.pouch.reduce((s, id) => s + townPrice(id), 0)} 石</small></h2>
          <button type="button" class="btn small" onClick={() => (overlay.value = null)}>关闭 <kbd>Esc</kbd></button></header>
        <p class="muted">行囊就是你的牌组：<Term id="gear">装备（青框）</Term>放进来，它的牌就进牌组；<Term id="aura">配件</Term>挨着装备，牌变强；同标签的东西凑够数是<Term id="set">套装</Term>。<Term id="goods">货物（金框）</Term>可以卖、交委托，或被某些牌烧掉。配件是紫框，用品（药、衬布）是绿框，淬炼过的装备发金光。</p>
        <ConceptTip ids={bagConcepts(run)} />
        {/* Tall bags (after sewing on pieces) use slightly smaller cells so the overlay still fits. */}
        <BagGrid mode="manage" cell={run.bag.h > 6 ? 56 : 64} />
      </div>
    </div>
  );
}

/** Small corner badge on items that are being boosted by a neighbouring accessory. */
function AuraBadge({ run, uid }: { run: RunState; uid: number }) {
  const it = run.bag.items.find((i) => i.uid === uid)!;
  const g = GOODS[it.id];
  const bits: string[] = [];
  if (g.cards) {
    const d = bag.auraOn(run.bag, it, "dmg"), b = bag.auraOn(run.bag, it, "blk");
    if (d) bits.push(`攻+${d}`);
    if (b) bits.push(`挡+${b}`);
  }
  if (g.kind === "goods") {
    const s = bag.auraOn(run.bag, it, "sell");
    if (s) bits.push(`价+${s}`);
    if (bag.auraOn(run.bag, it, "ward")) bits.push("护");
    if (it.id === "ash" && bag.auraOn(run.bag, it, "ash")) bits.push("×2");
  }
  return bits.length ? <span class="aura-badge">{bits.join(" ")}</span> : null;
}

function AuraLine({ run, uid }: { run: RunState; uid: number }) {
  const it = run.bag.items.find((i) => i.uid === uid)!;
  const from = bag.neighbours(run.bag, it).filter((o) => GOODS[o.id].aura);
  if (!from.length) return null;
  return <p class="det-aura">受到加成：{from.map((o) => `${GOODS[o.id].name}（${GOODS[o.id].aura!.text}）`).join("；")}</p>;
}

/** Set progress: 「刃 2/4」 for every tag you carry at least one of. Lit when a set is on. */
function TagSets({ run }: { run: RunState }) {
  const counts = bag.tagCounts(run.bag);
  const shown = TAG_IDS.filter((t) => counts[t] > 0);
  if (!shown.length) return <div class="tag-sets empty"><span><Term id="set" />：带同一类的东西凑够数量会生效（刃、盾、灯、钱、妖材）</span></div>;
  return (
    <div class="tag-sets">
      {shown.map((t) => {
        const d = TAGS[t], n = counts[t], lv = bag.tagLevel(run.bag, t);
        const next = lv < 2 ? d.at[lv] : d.at[1];
        return (
          <span class={`tag-set lv${lv}`} title={`${d.at[0]} 件：${d.text[0]}\n${d.at[1]} 件：${d.text[1]}`}>
            <b>{d.name}</b> {lv === 2 ? `${n} · 已满` : `${n}/${next}`}
            <small>{lv === 0 ? `再 ${d.at[0] - n} 件：${d.text[0]}` : lv === 1 ? `已生效：${d.text[0]}；再 ${d.at[1] - n} 件：${d.text[1]}` : `都已生效：${d.text[0]}；${d.text[1]}`}</small>
          </span>
        );
      })}
    </div>
  );
}

/**
 * 侧袋: three slots outside the bag. Things here don't count (no cards, boosts or set tags) but can't be
 * stolen. Drag items in and out, or use the buttons. Locked during a fight.
 */
function Pouch({ run, mode, held, onDrag }: { run: RunState; mode: "manage" | "sell"; held: Held | null; onDrag: (index: number, e: PointerEvent) => void }) {
  const locked = !!run.combat;
  const [confirm, setConfirm] = useState<string | null>(null); // slot and good, as for the pile
  const take = (i: number) => {
    if (locked) return;
    if (mode === "sell") {
      const id = run.pouch[i];
      if (confirm !== `${i}:${id}`) { sfx.click(); setConfirm(`${i}:${id}`); say(`再点一次，${sellPrice(run, id)} 石卖掉${GOODS[id].name}`, 3000); return; }
      const p = sellPouch(run, i); sfx.coin(); say(`卖出${GOODS[id].name}，得 ${p} 石`); setConfirm(null); commit(); return;
    }
    if (fromPouch(run, i)) { sfx.click(); commit(); }
    else say("行囊里没有放得下它的地方，先腾一腾");
  };
  return (
    <div class={`pouch ${locked ? "locked" : ""} ${held && held.from !== "pouch" ? "target" : ""}`}>
      <h4><Term id="pouch" /> <small>{locked ? "打完再整理" : mode === "sell" ? "点一下卖掉" : "只放一格大的东西。不生效，不会被抢，但挨打时易碎货照样会磕坏。点一下放回行囊"}</small></h4>
      <div class="pouch-slots">
        {Array.from({ length: POUCH_SLOTS }, (_, i) => {
          const id = run.pouch[i];
          if (!id) return <div class="pouch-slot empty" />;
          const g = GOODS[id];
          return (
            <div class={`pouch-slot kind-${g.kind} ${held?.from === "pouch" && held.index === i ? "held" : ""}`} title={`${g.name}：${g.text}`}
              onPointerDown={(e) => { if (!locked) onDrag(i, e as unknown as PointerEvent); }}
              onClick={() => take(i)}>
              <img src={ART[g.icon]} alt={g.name} draggable={false} />
              <span>{g.name}</span>
              {mode === "sell" && <span class={`price ${confirm === `${i}:${id}` ? "confirm" : ""}`}>{sellPrice(run, id)}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const SEW_CELL = 36;

/**
 * Sewing a 扩囊衬布 on: pick a 4-cell piece, rotate it, and put it anywhere on the bag's outside edge.
 * Hover (or tap) shows where it would go; click (or tap the same spot again) sews it on.
 */
function BagExpander({ run, uid, onDone }: { run: RunState; uid: number; onDone: () => void }) {
  const b = run.bag;
  const [shape, setShape] = useState<bag.ExpandShape>("line");
  const [rot, setRot] = useState(0);
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  // The area you can sew into: as far as the bag may grow in every direction.
  const x0 = b.w - bag.MAX_W, y0 = b.h - bag.MAX_H, rw = 2 * bag.MAX_W - b.w, rh = 2 * bag.MAX_H - b.h;
  const cells = at ? bag.pieceCells(shape, rot, at.x, at.y) : [];
  // The lining itself leaves the bag when sewn, so check against the bag without it.
  const without = { ...b, items: b.items.filter((i) => i.uid !== uid) };
  const problem = at ? bag.expandProblem(without, cells) : null;
  const sew = () => {
    if (!at || problem) return;
    const r = sewPiece(run, uid, cells);
    if (r) { sfx.coin(); say(r); commit(); onDone(); }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" || e.key === "R") setRot((r) => (r + 1) % 4);
      if (e.key === "Escape") { e.stopImmediatePropagation(); onDone(); }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const pos = (x: number, y: number) => ({ left: `${(x - x0) * SEW_CELL}px`, top: `${(y - y0) * SEW_CELL}px` });
  return (
    <div class="bag-expander">
      <div class="sew-head">
        <b>缝扩囊衬布</b>
        <span>选一块形状，拼到行囊外沿。行囊最大 {bag.MAX_W}×{bag.MAX_H}、{bag.MAX_CELLS} 格（现在 {bag.cellCount(b)} 格）。</span>
      </div>
      <div class="row sew-tools">
        {(Object.keys(bag.EXPAND_SHAPES) as bag.ExpandShape[]).map((k) => (
          <button type="button" class={`btn small ${shape === k ? "primary" : ""}`} onClick={() => setShape(k)}>{bag.EXPAND_SHAPES[k].name}</button>
        ))}
        <button type="button" class="btn small" onClick={() => setRot((r) => (r + 1) % 4)}>旋转 <kbd>R</kbd></button>
        <button type="button" class="btn small ghost" onClick={onDone}>先不缝</button>
      </div>
      <div class="sew-area" style={{ width: `${rw * SEW_CELL}px`, height: `${rh * SEW_CELL}px` }}
        onContextMenu={(e) => { e.preventDefault(); setRot((r) => (r + 1) % 4); }}>
        {Array.from({ length: rw * rh }, (_, i) => {
          const x = x0 + (i % rw), y = y0 + Math.floor(i / rw);
          const inBag = bag.usable(b, x, y);
          return <div class={`sew-cell ${inBag ? "in" : "out"}`} style={pos(x, y)}
            onPointerEnter={() => setAt({ x, y })}
            onClick={() => { if (at && at.x === x && at.y === y) sew(); else setAt({ x, y }); }} />;
        })}
        {b.items.filter((i) => i.uid !== uid).map((it) => {
          const size = bag.sizeOf(it.id, it.rot);
          const g = GOODS[it.id];
          // Same drawing as the bag: the picture is laid out unrotated, then turned inside the footprint.
          return (
            <div class="sew-item" style={{ ...pos(it.x, it.y), width: `${size.w * SEW_CELL}px`, height: `${size.h * SEW_CELL}px` }}>
              <img src={ART[g.icon]} alt="" draggable={false}
                style={{ width: `${(it.rot % 2 ? size.h : size.w) * SEW_CELL}px`, height: `${(it.rot % 2 ? size.w : size.h) * SEW_CELL}px`, transform: `translate(-50%, -50%) rotate(${it.rot * 90 + (g.tilt?.[0] ?? 0)}deg) scale(${g.tilt?.[1] ?? 1})` }} />
            </div>
          );
        })}
        {cells.map(([x, y]) => <div class={`sew-cell piece ${problem ? "bad" : "ok"}`} style={pos(x, y)} />)}
      </div>
      <p class={`sew-hint ${problem ? "bad" : ""}`}>{!at ? "把鼠标移到行囊外面看看能拼在哪；手机上点一下预览，再点一下缝上。" : problem ?? "可以缝在这里：点一下缝上。"}</p>
    </div>
  );
}

/** 淬炼 in plain words: what this item will become (or could become), and what it costs. */
function RefineLine({ run, uid }: { run: RunState; uid: number }) {
  const it = run.bag.items.find((i) => i.uid === uid)!;
  const r = bag.pendingRefines(run.bag).find((p) => p.gear.uid === uid || p.with.uid === uid);
  if (r) return <p class="det-refine">打赢下一场后淬炼：{GOODS[r.gear.id].name}和{GOODS[r.with.id].name}炼成{GOODS[r.into].name}（{GOODS[r.with.id].name}会用掉）。不想淬炼就把它们挪开。</p>;
  const recipe = REFINES.find((x) => x.gear === it.id || x.with === it.id);
  if (!recipe || GOODS[it.id].base) return null;
  const other = recipe.gear === it.id ? recipe.with : recipe.gear;
  return <p class="det-refine dim">和{GOODS[other].name}挨着放，打赢一场后能淬炼成{GOODS[recipe.into].name}。</p>;
}
