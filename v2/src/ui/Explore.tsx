import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { ENEMIES } from "../data/enemies";
import { EVENTS } from "../data/events";
import { DIRS, DIR_NAMES, entityAt, findPath, isWall } from "../game/dungeon";
import * as R from "../game/run";
import type { Entity, RunState } from "../game/types";
import { type Billboard, Raycaster } from "../render/raycaster";
import { theme } from "../render/textures";
import { commit, markTip, overlay, runSig, seenTip, useRun } from "./store";

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

export function billboards(run: RunState, hide?: number): Billboard[] {
  const out: Billboard[] = [];
  for (const e of run.dungeon.entities) {
    if (e.id === hide) continue;
    if (e.done && e.kind !== "shop") continue;
    let sprite = "", scale = 0.5, bob = false;
    if (e.enemy && e.kind !== "stairs") {
      const def = ENEMIES[e.enemy];
      sprite = def.sprite;
      scale = 0.58 * (def.scale ?? 1) * (e.kind === "elite" ? 1.1 : e.kind === "guardian" ? 1.15 : 1);
      bob = true;
    } else if (e.kind === "shop") { sprite = "trader"; scale = 0.78; }
    else if (e.kind === "event") { sprite = EVENTS[e.event!].sprite; scale = ["broker", "guide"].includes(sprite) ? 0.8 : 0.5; }
    else if (e.kind === "rest") { sprite = "lamp"; scale = 0.55; }
    else if (e.kind === "chest") { sprite = "purse"; scale = 0.32; }
    else if (e.kind === "stairs") { sprite = "sign-turn"; scale = 0.55; }
    out.push({ x: e.x, y: e.y, sprite, scale, bob });
  }
  return out;
}

/** Mounts the shared 3D canvas into a container. */
export function useView(ref: { current: HTMLDivElement | null }, run: RunState, opts: { hideAll?: boolean; dim?: number } = {}) {
  useEffect(() => {
    ref.current?.appendChild(view.canvas);
  }, []);
  useEffect(() => {
    view.dim = opts.dim ?? 0;
    view.lamp = run.oil <= 0 ? 0 : Math.min(1, 0.45 + run.oil / 50);
    view.setScene(run.dungeon, theme(run.floor), opts.hideAll ? [] : billboards(run));
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
      return `前面 ${i} 格：${entityName(e)}。${tip}`;
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
  const done = () => { busy.current = false; const q = queued.current; queued.current = null; if (q && runSig.value?.screen === "explore") q(); };
  useView(ref, run);
  useLayoutEffect(() => { view.place(run.pos.x, run.pos.y, run.pos.dir); }, [run.floor]);

  const stepTo = async (x: number, y: number, dir: number, deliberate: boolean) => {
    sfx.step();
    await view.moveTo(x, y, dir);
    const opened = R.arrive(run, x, y, dir, deliberate);
    commit();
    return opened;
  };
  const turn = async (delta: number) => {
    if (busy.current) { queued.current = () => void turn(delta); return; }
    busy.current = true;
    const dir = (run.pos.dir + delta + 4) % 4;
    run.pos.dir = dir;
    await view.moveTo(run.pos.x, run.pos.y, dir, 150);
    commit();
    done();
  };
  const move = async (back = false) => {
    if (busy.current) { queued.current = () => void move(back); return; }
    const dir = run.pos.dir;
    const [dx, dy] = DIRS[back ? (dir + 2) % 4 : dir];
    const x = run.pos.x + dx, y = run.pos.y + dy;
    if (isWall(run.dungeon, x, y)) { sfx.bump(); view.bump(back ? (dir + 2) % 4 : dir); return; }
    busy.current = true;
    await stepTo(x, y, dir, true);
    done();
  };
  const walkTo = async (tx: number, ty: number) => {
    if (busy.current) return;
    const path = findPath(run.dungeon, run.pos, { x: tx, y: ty });
    if (!path || !path.length) return;
    busy.current = true;
    setWalking(true);
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      const dir = DIRS.findIndex(([dx, dy]) => dx === p.x - run.pos.x && dy === p.y - run.pos.y);
      if (dir !== run.pos.dir) { run.pos.dir = dir; await view.moveTo(run.pos.x, run.pos.y, dir, 110); }
      if (await stepTo(p.x, p.y, dir, i === path.length - 1)) break;
      if (runSig.value?.screen !== "explore") break;
    }
    busy.current = false;
    setWalking(false);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay.value || run.cardPick) return;
      const k = e.key.toLowerCase();
      if (k === "w" || k === "arrowup") { e.preventDefault(); void move(); }
      else if (k === "s" || k === "arrowdown") { e.preventDefault(); void move(true); }
      else if (k === "a" || k === "arrowleft" || k === "q") { e.preventDefault(); void turn(-1); }
      else if (k === "d" || k === "arrowright" || k === "e") { e.preventDefault(); void turn(1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [run]);

  const here = entityAt(run.dungeon, run.pos.x, run.pos.y);
  const onStairs = here?.kind === "stairs";
  const showTip = !seenTip("move");

  return (
    <div class="explore">
      <div class="viewport" ref={ref}>
        <div class="compass">面朝{DIR_NAMES[run.pos.dir]}</div>
        {showTip && (
          <div class="tip">
            <p><b>W</b> 前进　<b>A</b> / <b>D</b> 转身　<b>S</b> 后退。也可以直接<b>点右边小地图上的格子</b>，会自动走过去。</p>
            <p>红点是妖，金点是狐市，绿点是灯台，紫点是事件。最远处的大红点是守关妖。</p>
            <button type="button" class="btn small" onClick={() => markTip("move")}>知道了</button>
          </div>
        )}
        {onStairs && <StairsPrompt />}
        {run.oil <= 0 ? <div class="dark-warn">灯灭了：小地图不再自动探路，妖趁黑每下多打 {R.DARK_DAMAGE} 点。去狐市买灯油、在灯台添油，或在行囊里烧灯灰。</div>
          : run.oil <= 15 ? <div class="dark-warn soft">灯油只剩 {run.oil} 步了。</div> : null}
      </div>
      <aside class="side">
        <Minimap onPick={walkTo} />
        <div class="ahead">{walking ? "自动行走中… 遇到东西会停下。" : lookAhead(run)}</div>
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
