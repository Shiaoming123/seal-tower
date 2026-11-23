import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS, KIND_LABEL } from "../data/goods";
import * as bag from "../game/bag";
import { MAX_BAG_ROWS, autoPackPending, moveItem, packPending, sellItem, sellPrice, unpack, useItem } from "../game/inventory";
import type { GoodId, RunState } from "../game/types";
import { ART } from "../render/assets";
import { commit, overlay, say, useRun } from "./store";

type Held = { from: "bag"; uid: number; id: GoodId; rot: number } | { from: "pending"; index: number; id: GoodId; rot: number };

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
export function BagGrid({ mode, cell = CELL }: { mode: "manage" | "sell"; cell?: number }) {
  const run = useRun();
  const b = run.bag;
  const gridRef = useRef<HTMLDivElement>(null);
  const [held, setHeld] = useState<Held | null>(null);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const moved = useRef(false);

  const cellAt = (cx: number, cy: number) => {
    const r = gridRef.current!.getBoundingClientRect();
    const x = Math.floor(((cx - r.left) / r.width) * b.w), y = Math.floor(((cy - r.top) / r.height) * b.h);
    return x >= 0 && y >= 0 && x < b.w && y < b.h ? { x, y } : null;
  };

  // Place the held item so the cell under the pointer is its first cell.
  const drop = (h: Held, at: { x: number; y: number } | null) => {
    if (!at) return false;
    const ok = h.from === "bag" ? moveItem(run, h.uid, at.x, at.y, h.rot) : packPending(run, h.index, at.x, at.y, h.rot);
    if (ok) { sfx.click(); commit(); }
    return ok;
  };

  useEffect(() => {
    if (!held) return;
    const onMove = (e: PointerEvent) => { moved.current = true; setGhost(stagePoint(e)); setHover(cellAt(e.clientX, e.clientY)); };
    const onUp = (e: PointerEvent) => {
      const at = cellAt(e.clientX, e.clientY);
      if (moved.current && !drop(held, at) && at) say("放不下：换个位置或先旋转（R）");
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
    if (h.from === "bag") setSelected(h.uid);
  };

  const sel = run.bag.items.find((it) => it.uid === selected) ?? null;
  const preview = held && hover ? { cells: bag.shapeOf(held.id, held.rot).map(([x, y]) => [x + hover.x, y + hover.y]), ok: bag.fits(b, held.id, hover.x, hover.y, held.rot, held.from === "bag" ? held.uid : -1) } : null;

  const rotateSelected = () => {
    if (!sel) return;
    for (const rot of [1, 2, 3].map((d) => (sel.rot + d) % 4)) {
      if (moveItem(run, sel.uid, sel.x, sel.y, rot)) { commit(); return; }
      const spot = bag.findSpot({ ...b, items: b.items.filter((i) => i.uid !== sel.uid) }, sel.id);
      if (spot && bag.fits(b, sel.id, spot.x, spot.y, rot, sel.uid)) { moveItem(run, sel.uid, spot.x, spot.y, rot); commit(); return; }
    }
    say("这里转不开，先挪一挪别的东西");
  };

  return (
    <div class={`bag-wrap mode-${mode}`}>
      <div class="bag-grid" ref={gridRef} style={{ width: `${b.w * cell}px`, height: `${b.h * cell}px`, "--cell": `${cell}px` } as never}
        onContextMenu={(e) => { e.preventDefault(); if (held) setHeld({ ...held, rot: (held.rot + 1) % 4 }); else rotateSelected(); }}>
        {Array.from({ length: b.w * b.h }, (_, i) => <div class="cell" style={{ left: `${(i % b.w) * cell}px`, top: `${Math.floor(i / b.w) * cell}px` }} />)}
        {preview && preview.cells.map(([x, y]) => <div class={`cell preview ${preview.ok ? "ok" : "bad"}`} style={{ left: `${x * cell}px`, top: `${y * cell}px` }} />)}
        {b.items.map((it) => {
          const size = bag.sizeOf(it.id, it.rot);
          const g = GOODS[it.id];
          const isHeld = held?.from === "bag" && held.uid === it.uid;
          return (
            <div class={`item kind-${g.kind} ${selected === it.uid ? "selected" : ""} ${isHeld ? "held" : ""} ${g.dim ? "dim" : ""}`}
              style={{ left: `${it.x * cell}px`, top: `${it.y * cell}px`, width: `${size.w * cell}px`, height: `${size.h * cell}px` }}
              onPointerDown={(e) => startDrag({ from: "bag", uid: it.uid, id: it.id, rot: it.rot }, e as unknown as PointerEvent)}
              onClick={() => {
                if (moved.current) return;
                if (mode === "sell" && g.kind !== "gear") { const p = sellItem(run, it.uid); sfx.coin(); say(`卖出${g.name}，得 ${p} 石`); setSelected(null); commit(); }
                else setSelected(it.uid);
              }}>
              {bag.footprint(it).map(([x, y]) => <span class="foot" style={{ left: `${(x - it.x) * cell}px`, top: `${(y - it.y) * cell}px` }} />)}
              <img src={ART[g.icon]} alt={g.name} draggable={false} class="item-img"
                style={{ width: `${(it.rot % 2 ? size.h : size.w) * cell}px`, height: `${(it.rot % 2 ? size.w : size.h) * cell}px`, transform: `translate(-50%, -50%) rotate(${it.rot * 90 + (g.tilt?.[0] ?? 0)}deg) scale(${g.tilt?.[1] ?? 1})` }} />
              {mode === "sell" && g.kind !== "gear" && <span class="price">{sellPrice(run, it.id)}</span>}
            </div>
          );
        })}
      </div>
      {held && ghost && (
        <div class="drag-ghost" style={{ left: `${ghost.x}px`, top: `${ghost.y}px` }}>
          <img src={ART[GOODS[held.id].icon]} alt="" />
          <span>R 旋转</span>
        </div>
      )}
      {mode === "manage" && <ItemDetails run={run} uid={sel?.uid ?? null} onRotate={rotateSelected} onDone={() => setSelected(null)} />}
      {run.pending.length > 0 && (
        <div class="pending">
          <h4>没装下的东西 · {run.pending.length} 件 <small>拖进格子，或点「自动装」。离开时没装的会留在原地。</small></h4>
          <div class="pending-list">
            {run.pending.map((id, index) => (
              <div class={`pending-item ${held?.from === "pending" && held.index === index ? "held" : ""}`} title={GOODS[id].text}
                onPointerDown={(e) => startDrag({ from: "pending", index, id, rot: 0 }, e as unknown as PointerEvent)}>
                <img src={ART[GOODS[id].icon]} alt="" draggable={false} />
                <span>{GOODS[id].name}</span>
                <small>{bag.sizeOf(id, 0).w}×{bag.sizeOf(id, 0).h}</small>
              </div>
            ))}
          </div>
          <button type="button" class="btn small" onClick={() => { autoPackPending(run); sfx.click(); commit(); }}>自动装</button>
        </div>
      )}
    </div>
  );
}

function ItemDetails({ run, uid, onRotate, onDone }: { run: RunState; uid: number | null; onRotate: () => void; onDone: () => void }) {
  const it = run.bag.items.find((i) => i.uid === uid);
  if (!it) return <div class="item-details empty"><p>点一件东西看详情。拖动可以挪位置，右键或 R 旋转。</p></div>;
  const g = GOODS[it.id];
  const inCombat = run.screen === "combat";
  const canUse = g.use && (g.use.inCombat || !inCombat) && !(g.use.bagRow && run.bag.h >= MAX_BAG_ROWS);
  return (
    <div class="item-details">
      <div class="det-head"><img src={ART[g.icon]} alt="" /><div><b>{g.name}</b><span>{KIND_LABEL[g.kind]} · 售价 {g.price} 石</span></div></div>
      <p class="det-text">{g.text}</p>
      {g.passive && <p class="det-passive">带在身上：{g.passive}</p>}
      {g.cards && <p class="det-cards">牌组多出：{g.cards.map((c) => `「${CARDS[c].name}」`).join("")}</p>}
      <div class="row">
        {canUse && <button type="button" class="btn small primary" onClick={() => { const r = useItem(run, it.uid); if (r) { sfx.coin(); say(r); onDone(); commit(); } }}>{g.use!.label}</button>}
        <button type="button" class="btn small" onClick={onRotate}>旋转</button>
        <button type="button" class="btn small ghost" onClick={() => { unpack(run, it.uid); onDone(); commit(); }}>拿出来</button>
      </div>
    </div>
  );
}

export function BagOverlay() {
  const run = useRun();
  return (
    <div class="overlay" onClick={(e) => { if (e.target === e.currentTarget) overlay.value = null; }}>
      <div class="overlay-box bag-box">
        <header><h2>行囊 <small>{run.bag.w}×{run.bag.h} 格 · 货值 {bag.value(run.bag)} 石</small></h2>
          <button type="button" class="btn small" onClick={() => (overlay.value = null)}>关闭 <kbd>Esc</kbd></button></header>
        <p class="muted">装备（青框）放在行囊里，它的牌就会进入牌组。货物（金框）可以卖、交委托，或被某些牌烧掉。</p>
        <BagGrid mode="manage" />
      </div>
    </div>
  );
}
