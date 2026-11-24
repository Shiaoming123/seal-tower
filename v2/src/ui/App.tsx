import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { setSound, setVolumes, sfx } from "../audio/sfx";
import { setMusic } from "../audio/music";
import { setAmbience } from "../audio/ambience";
import { setRoom } from "../audio/engine";
import { ORDERS } from "../data/orders";
import { OMEN } from "../data/omens";
import { orderProgress } from "../game/run";
import { BagOverlay } from "./Bag";
import { CardPicker, DeckOverlay } from "./Deck";
import { Explore } from "./Explore";
import { Combat } from "./Combat";
import { Reward } from "./Reward";
import { Shop } from "./Shop";
import { EventScreen, RestScreen } from "./Event";
import { Result } from "./Result";
import { Achievements, Help, Title, Town } from "./Title";
import { Codex } from "./Codex";
import { Bar, GoodChip, RelicRow } from "./parts";
import { canRestartFight, commit, overlay, page, profileSig, restartFight, runSig, say, tick, toast, useRun } from "./store";

/** Fixed-size stage scaled to fit the window, so nothing reflows or jumps while playing. */
function useStage() {
  const [layout, setLayout] = useState({ portrait: false, scale: 1, w: 1280, h: 720 });
  useLayoutEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const portrait = h > w * 1.15;
      // Portrait phones: a 600-wide stage whose height follows the screen, so text stays readable.
      const [sw, sh] = portrait ? [600, Math.max(1000, Math.min(1400, Math.round((600 * h) / w)))] : [1280, 720];
      setLayout({ portrait, scale: Math.min(w / sw, h / sh), w: sw, h: sh });
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return layout;
}

export function App() {
  const { portrait, scale, w, h } = useStage();
  tick.value; // subscribe
  useEffect(() => { setSound(profileSig.value.sound); setVolumes(profileSig.value.musicVol ?? 0.7, profileSig.value.sfxVol ?? 0.8); }, []);
  const run = runSig.value;
  // Background music follows where you are.
  const mood = page.value === "game" && run ? (run.screen === "result" ? "town" : `f${run.floor}`) : "town";
  const fight = run?.screen === "combat" ? (run.combat?.kind === "guardian" ? "boss" : "fight") : null;
  useEffect(() => { setMusic(profileSig.value.sound ? mood : "", fight); }, [mood, fight, profileSig.value.sound]);
  // Ambience and reverb follow the place too; the floor's omen colours the ambience.
  const omen = page.value === "game" && run && run.screen !== "result" ? run.omen : "calm";
  useEffect(() => { setRoom(mood); setAmbience(profileSig.value.sound ? mood : "", omen, !!fight); }, [mood, omen, fight, profileSig.value.sound]);
  let body;
  if (page.value === "title") body = <Title />;
  else if (page.value === "help") body = <Help />;
  else if (page.value === "achievements") body = <Achievements />;
  else if (page.value === "codex") body = <Codex />;
  else if (page.value === "town" || !run) body = <Town />;
  else body = <Game />;
  return (
    <div class={`stage ${portrait ? "portrait" : "landscape"}`} style={{ width: `${w}px`, height: `${h}px`, transform: `translate(-50%, -50%) scale(${scale})` }}
      onScroll={(e) => { const el = e.currentTarget as HTMLElement; if (el.scrollTop || el.scrollLeft) { el.scrollTop = 0; el.scrollLeft = 0; } }}>
      {body}
      {toast.value && <div class="toast" key={toast.value.id}>{toast.value.text}</div>}
    </div>
  );
}

function Game() {
  const run = useRun();
  const screen = run.screen;
  return (
    <div class={`game screen-${screen} floor-${run.floor}`}>
      {screen !== "result" && <Hud />}
      <div class="main">
        {screen === "explore" && <Explore />}
        {screen === "combat" && <Combat />}
        {screen === "reward" && <Reward />}
        {screen === "shop" && <Shop />}
        {screen === "event" && <EventScreen />}
        {screen === "rest" && <RestScreen />}
        {screen === "result" && <Result />}
      </div>
      {overlay.value === "bag" && <BagOverlay />}
      {overlay.value === "deck" && <DeckOverlay />}
      {overlay.value === "pause" && <PauseMenu />}
      {run.cardPick && <CardPicker />}
    </div>
  );
}

const FLOOR_NAMES = ["", "第一层 · 照影廊", "第二层 · 桥驿", "第三层 · 钟楼"];

function Hud() {
  const run = useRun();
  const toggle = (o: "bag" | "deck") => { sfx.click(); overlay.value = overlay.value === o ? null : o; };
  const pending = run.pending.length;
  return (
    <header class="hud">
      <div class="hud-left">
        <span class="floor-name">{FLOOR_NAMES[run.floor]}</span>
        <Bar value={run.hp} max={run.maxHp} kind="hp" block={run.combat?.block ?? 0} />
        <span class="gold" title="灵石">{run.gold} 石</span>
        <span class={`oil ${run.oil <= 15 ? "low" : ""} ${run.oil <= 0 ? "out" : ""}`} title="灯油：每走一步烧 1 点。灯灭了会很危险。">
          <i style={{ height: `${Math.round((run.oil / run.maxOil) * 100)}%` }} />灯油 {run.oil}
        </span>
      </div>
      <button type="button" class="omen-chip" title={`${OMEN[run.omen].name}：${OMEN[run.omen].text}`} onClick={() => say(`本层签文「${OMEN[run.omen].name}」：${OMEN[run.omen].text}`, 4000)}>签·{OMEN[run.omen].name}</button>
      <RelicRow relics={run.relics} />
      <div class="hud-orders">
        {run.orders.map((_, i) => {
          const { order, parts, ord } = orderProgress(run, i);
          return (
            <div class="hud-order" title={order.story}>
              <span class="order-label">{order.client}</span>
              {ord.done ? <span class="done">已交付</span> : parts.map((p) => (
                <span class={p.have >= p.need ? "ok" : ""}><GoodChip id={p.id} /> {Math.min(p.have, p.need)}/{p.need}</span>
              ))}
            </div>
          );
        })}
      </div>
      <div class="hud-buttons">
        <button type="button" class={`btn small ${pending ? "alert" : ""}`} onClick={() => toggle("bag")}>行囊{pending ? ` · ${pending} 件没装` : ""} <kbd>B</kbd></button>
        <button type="button" class="btn small" onClick={() => toggle("deck")}>牌组 {run.deck.length} <kbd>C</kbd></button>
        <SoundButton />
        <button type="button" class="btn small menu-btn" onClick={() => { sfx.click(); overlay.value = overlay.value === "pause" ? null : "pause"; }}>菜单 <kbd>Esc</kbd></button>
      </div>
    </header>
  );
}

/** Global keyboard shortcuts for overlays. Screens add their own. */
export function useOverlayKeys() {
  const ref = useRef(false);
  useEffect(() => {
    if (ref.current) return;
    ref.current = true;
    const onKey = (e: KeyboardEvent) => {
      if (!runSig.value || page.value !== "game" || e.target instanceof HTMLInputElement) return;
      const k = e.key.toLowerCase();
      if (k === "b") overlay.value = overlay.value === "bag" ? null : "bag";
      else if (k === "c") overlay.value = overlay.value === "deck" ? null : "deck";
      else if (k === "escape" && !e.defaultPrevented) overlay.value = overlay.value ? null : "pause";
    };
    window.addEventListener("keydown", onKey);
  }, []);
}

/** Pause: carry on, restart the current fight, or save and go back to the title (the run is saved on every step). */
function PauseMenu() {
  const run = useRun();
  const [sure, setSure] = useState<null | "restart" | "title">(null);
  const close = () => { sfx.click(); overlay.value = null; };
  const ask = (what: "restart" | "title", act: () => void) => { if (sure !== what) { sfx.click(); setSure(what); return; } act(); };
  return (
    <div class="overlay pause-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div class="pause-box panel">
        <h2 class="plaque">暂停</h2>
        <p class="muted">{FLOOR_NAMES[run.floor]} · 气血 {run.hp}/{run.maxHp} · {run.gold} 石</p>
        <button type="button" class="btn big primary" onClick={close}>继续</button>
        {canRestartFight() && (
          <button type="button" class={`btn big ${sure === "restart" ? "danger" : ""}`} onClick={() => ask("restart", () => { sfx.click(); restartFight(); })}>
            {sure === "restart" ? "再点一下：回到这场战斗开始时重打" : "重新开战"}
          </button>
        )}
        <button type="button" class={`btn big ${sure === "title" ? "danger" : ""}`} onClick={() => ask("title", () => { sfx.click(); commit(); overlay.value = null; page.value = "title"; })}>
          {sure === "title" ? "再点一下：存档并回主菜单" : "存档并回主菜单"}
        </button>
        <p class="muted pause-note">进度每走一步都会自动保存，回主菜单后点「继续上一趟」接着玩。{canRestartFight() ? "重新开战会回到这场战斗的第一回合，手牌也一样。" : ""}</p>
        <div class="pause-sound"><span>声音</span><SoundButton /></div>
      </div>
    </div>
  );
}

export const orderTitle = (id: string) => `${ORDERS[id].client}：${ORDERS[id].title}`;

/** Sound menu: mute plus separate music and effect volumes, saved in the profile. */
export function SoundButton() {
  const [open, setOpen] = useState(false);
  const p = profileSig.value;
  const update = (patch: Partial<typeof p>) => {
    profileSig.value = { ...profileSig.value, ...patch };
    const q = profileSig.value;
    setSound(q.sound);
    setVolumes(q.musicVol ?? 0.7, q.sfxVol ?? 0.8);
    commit();
  };
  return (
    <div class="sound-menu">
      <button type="button" class="btn small ghost" onClick={() => { sfx.click(); setOpen(!open); }}>{p.sound ? "声音" : "静音"}</button>
      {open && (
        <div class="sound-panel">
          <label class="row"><input type="checkbox" checked={p.sound} onChange={(e) => update({ sound: (e.target as HTMLInputElement).checked })} /> 开启声音</label>
          <label>配乐<input type="range" min="0" max="1" step="0.05" value={p.musicVol ?? 0.7} onInput={(e) => update({ musicVol: Number((e.target as HTMLInputElement).value) })} /></label>
          <label>音效<input type="range" min="0" max="1" step="0.05" value={p.sfxVol ?? 0.8} onInput={(e) => update({ sfxVol: Number((e.target as HTMLInputElement).value) })} onChange={() => sfx.coin()} /></label>
        </div>
      )}
    </div>
  );
}
