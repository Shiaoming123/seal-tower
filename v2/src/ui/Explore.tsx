import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { ENEMIES } from "../data/enemies";
import { EVENTS } from "../data/events";
import { DIRS, DIR_NAMES, entityAt, findPath, isWall, newlySighted, sightedIds } from "../game/dungeon";
import * as R from "../game/run";
import type { Entity, RunState } from "../game/types";
import { type Billboard, Raycaster } from "../render/raycaster";
import { theme } from "../render/textures";
import { fx } from "../render/fx";
import { OMEN } from "../data/omens";
import { ART, artId } from "../render/assets";
import { commit, markTip, overlay, runSig, say, seenTip, useRun } from "./store";

// One renderer for the whole session; screens mount its canvas where they need it.
export const view = new Raycaster();
view.start();
(window as unknown as { __sealView: Raycaster }).__sealView = view;

const KIND_LABEL: Record<Entity["kind"], string> = {
  fight: "妖", elite: "精英妖", guardian: "守关妖", stairs: "上楼的梯子", shop: "绯绡的狐市", event: "", rest: "旧灯台（歇脚）", chest: "宝箱",
};

export function entityName(e: Entity): string {
  if (e.enemy && (e.kind === "fight" || e.kind === "elite" || e.kind === "guardian")) return `${ENEMIES[e.enemy].name}（${KIND_LABEL[e.kind]}）`;
  if (e.kind === "event") return EVENTS[e.event!].title;
  return KIND_LABEL[e.kind];
}

const EVENT_SCALE: Record<string, number> = {
  broker: 0.8, guide: 0.8, "event-hunter": 0.75, "fake-fox": 0.75, "event-peddler": 0.45, "event-cart": 0.6, portal: 0.8, "event-pool": 0.22, "event-shrine": 0.35, "event-den": 0.45,
};

/** Monsters that hover: they float above the floor and bob (moths, lanterns, owls). */
const FLYERS = new Set(["moth", "ink-moth", "moth-queen", "lantern-spirit", "night-owl"]);

/** How a monster stands in the world: its height in tiles and how high it floats. */
export function enemyStage(e: Entity) {
  const def = ENEMIES[e.enemy!];
  const scale = 0.58 * (def.scale ?? 1) * (e.kind === "elite" ? 1.1 : e.kind === "guardian" ? 1.15 : 1);
  return { scale, lift: FLYERS.has(def.id) ? 0.22 : 0 };
}

export const isFight = (e: Entity) => e.kind === "fight" || e.kind === "elite" || e.kind === "guardian";

export function billboards(run: RunState, opts: { shadowOnly?: number } = {}): Billboard[] {
  const out: Billboard[] = [];
  for (const e of run.dungeon.entities) {
    if (e.done && e.kind !== "shop") continue;
    let sprite = "", scale = 0.5, bob = false, lift = 0;
    if (e.enemy && e.kind !== "stairs") {
      sprite = ENEMIES[e.enemy].sprite;
      ({ scale, lift } = enemyStage(e));
      bob = true;
    } else if (e.kind === "shop") { sprite = "trader"; scale = 0.78; }
    else if (e.kind === "event") {
      const eventSprite = EVENTS[e.event!].sprite;
      sprite = artId(`map-${eventSprite}`, eventSprite);
      scale = EVENT_SCALE[eventSprite] ?? 0.5;
    }
    else if (e.kind === "rest") { sprite = "lamp"; scale = 0.55; }
    else if (e.kind === "chest") { sprite = "purse"; scale = 0.32; }
    else if (e.kind === "stairs") { sprite = "sign-turn"; scale = 0.55; }
    out.push({ x: e.x, y: e.y, sprite, scale, bob, lift, shadowOnly: e.id === opts.shadowOnly });
  }
  return out;
}

/** Mounts the shared 3D canvas into a container. */
export function useView(ref: { current: HTMLDivElement | null }, run: RunState, opts: { hideAll?: boolean; dim?: number; combatEntity?: number } = {}) {
  useEffect(() => {
    if (!ref.current) return;
    ref.current.appendChild(view.canvas);
    fx.mount(ref.current);
  }, []);
  useEffect(() => {
    view.dim = opts.dim ?? 0;
    view.lamp = run.oil <= 0 ? 0 : Math.min(1, 0.45 + run.oil / 50);
    fx.setMode({ floor: run.floor, omen: run.omen, combat: opts.combatEntity !== undefined });
    view.setScene(run.dungeon, theme(run.floor), opts.hideAll ? [] : billboards(run, { shadowOnly: opts.combatEntity }));
  });
}

function lookAhead(run: RunState): string {
  const d = run.dungeon;
  const [dx, dy] = DIRS[run.pos.dir];
  for (let i = 1; i <= 6; i++) {
    const x = run.pos.x + dx * i, y = run.pos.y + dy * i;
    if (isWall(d, x, y)) return i === 1 ? "前面是墙。" : `前面 ${i - 1} 格后是墙。`;
    const e = entityAt(d, x, y);
    if (e) {
      const h = e.enemy && ENEMIES[e.enemy].harvest;
      const part = e.enemy && ENEMIES[e.enemy].part;
      const tip = h ? ` 取材：${h.text}，可多拿${h.label}。` : part ? ` 取材：单次伤害别超过 ${part.threshold - 1}，${part.label}才不会碎。` : "";
      const engage = i === 1 && isFight(e) ? " 再往前一步就开战。" : "";
      return `前面 ${i} 格：${entityName(e)}。${engage}${tip}`;
    }
  }
  return "前面是一条长廊。";
}

export function Explore() {
  const run = useRun();
  const ref = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const queued = useRef<null | (() => void)>(null);
  const [walking, setWalking] = useState(false);
  /** Set to stop an auto-walk before its next step. */
  const cancelWalk = useRef(false);
  const [nudge, setNudge] = useState(0);
  const done = () => { busy.current = false; const q = queued.current; queued.current = null; if (q && runSig.value?.screen === "explore") q(); };
  // 签文输入门: while the floor's omen card is unread, movement waits until it's acknowledged.
  const showTip = !seenTip("move");
  const omenOpen = !run.omenSeen && !showTip;
  // Read live state, not this render's snapshot: a key pressed right after a re-render must still be gated.
  const omenOpenNow = () => !!runSig.value && !runSig.value.omenSeen && seenTip("move");
  const gate = (): boolean => {
    if (!omenOpenNow()) return false;
    setNudge((n) => n + 1);
    return true;
  };
  const closeOmen = () => { run.omenSeen = true; sfx.click(); commit(); };
  useView(ref, run);
  useLayoutEffect(() => { view.place(run.pos.x, run.pos.y, run.pos.dir); }, [run.floor, run.warp]);

  const stepTo = async (x: number, y: number, dir: number, deliberate: boolean) => {
    // Monsters are fought from the tile in front of them, like in a dungeon crawler: face it and the fight starts.
    const foe = entityAt(run.dungeon, x, y);
    if (foe && isFight(foe)) {
      if (run.pos.dir !== dir) { run.pos.dir = dir; await view.moveTo(run.pos.x, run.pos.y, dir, 120); }
      R.openEntity(run, foe);
      commit();
      return true;
    }
    sfx.step();
    await view.moveTo(x, y, dir);
    const opened = R.arrive(run, x, y, dir, deliberate);
    commit();
    return opened;
  };
  const turn = async (delta: number) => {
    if (gate()) return;
    if (walking) { cancelWalk.current = true; return; }
    if (busy.current) { queued.current = () => void turn(delta); return; }
    busy.current = true;
    // A slight roll into the turn makes the head-turn feel physical.
    const vp = ref.current;
    if (vp) { vp.classList.remove("tilt-l", "tilt-r"); void vp.offsetWidth; vp.classList.add(delta < 0 ? "tilt-l" : "tilt-r"); }
    const dir = (run.pos.dir + delta + 4) % 4;
    run.pos.dir = dir;
    await view.moveTo(run.pos.x, run.pos.y, dir, 150);
    commit();
    done();
  };
  const move = async (back = false) => {
    if (gate()) return;
    if (walking) { cancelWalk.current = true; return; }
    if (busy.current) { queued.current = () => void move(back); return; }
    const dir = run.pos.dir;
    const [dx, dy] = DIRS[back ? (dir + 2) % 4 : dir];
    const x = run.pos.x + dx, y = run.pos.y + dy;
    if (isWall(run.dungeon, x, y)) { sfx.bump(); view.bump(back ? (dir + 2) % 4 : dir); return; }
    busy.current = true;
    await stepTo(x, y, dir, true);
    done();
  };
  /** Click a minimap tile: walk there. Clicking again while walking re-targets; any move key stops. */
  const walkTo = async (tx: number, ty: number) => {
    if (gate()) return;
    if (busy.current) {
      if (walking) { cancelWalk.current = true; queued.current = () => void walkTo(tx, ty); }
      return;
    }
    const path = findPath(run.dungeon, run.pos, { x: tx, y: ty });
    if (!path || !path.length) { say("那里还走不过去：路没探明，或者被妖挡住了。"); return; }
    busy.current = true;
    cancelWalk.current = false;
    setWalking(true);
    let stopReason = "";
    for (let i = 0; i < path.length; i++) {
      if (cancelWalk.current) break;
      const p = path[i];
      const dir = DIRS.findIndex(([dx, dy]) => dx === p.x - run.pos.x && dy === p.y - run.pos.y);
      if (dir !== run.pos.dir) { run.pos.dir = dir; await view.moveTo(run.pos.x, run.pos.y, dir, 110); }
      const before = sightedIds(run.dungeon);
      const oilBefore = run.oil;
      if (await stepTo(p.x, p.y, dir, i === path.length - 1)) break;
      if (runSig.value?.screen !== "explore") break;
      const spotted = newlySighted(run.dungeon, before);
      if (spotted.length && i < path.length - 1) { stopReason = `发现了${spotted.map(entityName).join("、")}，先停下。`; break; }
      if (oilBefore > 0 && run.oil === 0) { stopReason = "灯灭了，先停下。"; break; }
    }
    if (stopReason) say(stopReason, 3000);
    cancelWalk.current = false;
    setWalking(false);
    done();
  };
  const stopWalk = () => { if (walking) { cancelWalk.current = true; sfx.click(); } };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay.value || run.cardPick) return;
      const k = e.key.toLowerCase();
      if (omenOpenNow() && (k === "enter" || k === " " || k === "escape")) { e.preventDefault(); closeOmen(); return; }
      if (k === "escape" || k === " ") { e.preventDefault(); stopWalk(); return; }
      if (k === "w" || k === "arrowup") { e.preventDefault(); void move(); }
      else if (k === "s" || k === "arrowdown") { e.preventDefault(); void move(true); }
      else if (k === "a" || k === "arrowleft" || k === "q") { e.preventDefault(); void turn(-1); }
      else if (k === "d" || k === "arrowright" || k === "e") { e.preventDefault(); void turn(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run, omenOpen, walking]);

  const here = entityAt(run.dungeon, run.pos.x, run.pos.y);
  const onStairs = here?.kind === "stairs";

  return (
    <div class="explore">
      <div class="viewport" ref={ref}>
        <div class="compass">面朝{DIR_NAMES[run.pos.dir]}</div>
        <FloorCard />
        {showTip && (
          <div class="tip">
            <p><b>W</b> 前进　<b>A</b> / <b>D</b> 转身　<b>S</b> 后退。也可以直接<b>点右边小地图上的格子</b>，会自动走过去。</p>
            <p>红点是妖，金点是狐市，绿点是灯台，紫点是事件。最远处的大红点是守关妖。</p>
            <button type="button" class="btn small" onClick={() => markTip("move")}>知道了</button>
          </div>
        )}
        {onStairs && <StairsPrompt />}
        {omenOpen && (
          <div class={`omen-card ${nudge ? "nudge" : ""}`} key={`omen-${nudge}`}>
            <span class="omen-tag">本层签文</span>
            {ART[`omen-${run.omen}`] && <img class="omen-art" src={ART[`omen-${run.omen}`]} alt="" />}
            <h3>{OMEN[run.omen].name}</h3>
            <p class="verse">{OMEN[run.omen].verse}</p>
            <p>{OMEN[run.omen].text}</p>
            <button type="button" class="btn small primary" onClick={closeOmen}>知道了 <kbd>Enter</kbd></button>
            {nudge > 0 && <p class="omen-hint">看完签文再出发：点「知道了」或按 Enter。</p>}
          </div>
        )}
        {run.oil <= 0 ? <div class="dark-warn">灯灭了：小地图不再自动探路，妖趁黑每下多打 {R.DARK_DAMAGE} 点。去狐市买灯油、在灯台添油，或在行囊里烧灯灰。</div>
          : run.oil <= 15 ? <div class="dark-warn soft">灯油只剩 {run.oil} 步了。</div> : null}
      </div>
      <aside class="side">
        <Minimap onPick={walkTo} />
        <div class="ahead">
          {walking ? <>自动行走中，看到妖或事件会自己停下。<button type="button" class="btn small stop-walk" onClick={stopWalk}>停下 <kbd>Esc</kbd></button></> : lookAhead(run)}
        </div>
        {run.bossIntel && <BossIntel />}
      </aside>
      <div class="pad">
        <button type="button" class="btn pad-btn" onClick={() => turn(-1)} aria-label="左转">↶ 左转</button>
        <button type="button" class="btn pad-btn primary" onClick={() => move()} aria-label="前进">↑ 前进</button>
        <button type="button" class="btn pad-btn" onClick={() => turn(1)} aria-label="右转">右转 ↷</button>
        <button type="button" class="btn pad-btn ghost" onClick={() => move(true)} aria-label="后退">↓ 后退</button>
      </div>
    </div>
  );
}

// Shown once each time you arrive on a floor: fade in from black with the floor's name.
let lastFloorCard = "";
function FloorCard() {
  const run = useRun();
  const key = `${run.seed}:${run.floor}`;
  const [show, setShow] = useState(() => lastFloorCard !== key);
  useEffect(() => {
    if (lastFloorCard === key) { setShow(false); return; }
    lastFloorCard = key;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2200);
    return () => clearTimeout(t);
  }, [key]);
  if (!show) return null;
  const names = ["", "照影廊", "桥驿", "钟楼"];
  return (
    <div class="floor-card" key={key}>
      <span class="floor-no">第{"一二三"[run.floor - 1]}层</span>
      <h2>{names[run.floor]}</h2>
    </div>
  );
}

function StairsPrompt() {
  const run = useRun();
  const top = run.floor === 3;
  return (
    <div class="stairs-prompt panel">
      <h3>{top ? "塔顶" : "守关妖倒下了"}</h3>
      <p>{top ? "负钟君已经倒下。" : `楼梯通往第 ${run.floor + 1} 层。上楼会回复一半已损失的气血。也可以现在带着货回镇上结算。`}</p>
      <div class="row">
        {!top && <button type="button" class="btn primary" onClick={() => { sfx.bell(); R.climb(run); view.place(run.pos.x, run.pos.y, run.pos.dir); commit(); }}>上楼</button>}
        <button type="button" class="btn" onClick={() => { R.goHome(run); commit(); }}>回镇结算</button>
      </div>
    </div>
  );
}

function BossIntel() {
  const run = useRun();
  const g = run.dungeon.entities.find((e) => e.kind === "guardian");
  if (!g) return null;
  const def = ENEMIES[g.enemy!];
  return (
    <div class="intel panel">
      <h4>道友说：{def.name}</h4>
      <p>{def.blurb}</p>
      <p class="muted">招式：{Object.values(def.moves).map((m) => m.name).join("、")}</p>
    </div>
  );
}

const COLORS: Record<Entity["kind"], string> = {
  fight: "#d9483b", elite: "#ff7a2f", guardian: "#ff3355", stairs: "#f4e3b0", shop: "#f2c14e", event: "#b48cf2", rest: "#6fd08c", chest: "#e8d27a",
};

function Minimap({ onPick }: { onPick: (x: number, y: number) => void }) {
  const run = useRun();
  const d = run.dungeon;
  const ref = useRef<HTMLCanvasElement>(null);
  const cell = Math.floor(Math.min(300 / d.w, 300 / d.h));
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d")!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < d.h; y++) for (let x = 0; x < d.w; x++) {
      const i = y * d.w + x;
      if (!d.seen[i]) continue;
      ctx.fillStyle = d.tiles[i] ? "rgba(52,34,20,0.88)" : "rgba(196,170,120,0.9)";
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
    for (const e of d.entities) {
      if (!d.seen[e.y * d.w + e.x] || (e.done && e.kind !== "shop")) continue;
      ctx.fillStyle = COLORS[e.kind];
      const r = e.kind === "guardian" || e.kind === "stairs" ? cell * 0.42 : cell * 0.3;
      ctx.beginPath(); ctx.arc(e.x * cell + cell / 2, e.y * cell + cell / 2, r, 0, Math.PI * 2); ctx.fill();
    }
    // player arrow
    const cx = run.pos.x * cell + cell / 2, cy = run.pos.y * cell + cell / 2;
    const a = ((run.pos.dir - 1) * Math.PI) / 2;
    ctx.fillStyle = "#7fe3ff";
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * cell * 0.45, cy + Math.sin(a) * cell * 0.45);
    ctx.lineTo(cx + Math.cos(a + 2.4) * cell * 0.38, cy + Math.sin(a + 2.4) * cell * 0.38);
    ctx.lineTo(cx + Math.cos(a - 2.4) * cell * 0.38, cy + Math.sin(a - 2.4) * cell * 0.38);
    ctx.fill();
  });
  const pick = (ev: MouseEvent) => {
    const cv = ref.current!;
    const rect = cv.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - rect.left) / rect.width) * d.w);
    const y = Math.floor(((ev.clientY - rect.top) / rect.height) * d.h);
    onPick(x, y);
  };
  return (
    <div class="minimap">
      <canvas ref={ref} width={d.w * cell} height={d.h * cell} onClick={pick} />
      <div class="legend">
        {([["fight", "妖"], ["shop", "狐市"], ["rest", "灯台"], ["event", "事件"], ["chest", "宝箱"], ["guardian", "守关"]] as const).map(([k, label]) => (
          <span><i class="dot" style={{ background: COLORS[k] }} />{label}</span>
        ))}
      </div>
    </div>
  );
}
