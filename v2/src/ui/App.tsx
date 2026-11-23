import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { setSound, sfx } from "../audio/sfx";
import { ORDERS } from "../data/orders";
import { orderProgress } from "../game/run";
import { BagOverlay } from "./Bag";
import { CardPicker, DeckOverlay } from "./Deck";
import { Explore } from "./Explore";
import { Combat } from "./Combat";
import { Reward } from "./Reward";
import { Shop } from "./Shop";
import { EventScreen, RestScreen } from "./Event";
import { Result } from "./Result";
import { Help, Title, Town } from "./Title";
import { Bar, GoodChip, RelicRow } from "./parts";
import { commit, overlay, page, profileSig, runSig, tick, toast, useRun } from "./store";

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
  useEffect(() => { setSound(profileSig.value.sound); }, []);
  const run = runSig.value;
  let body;
  if (page.value === "title") body = <Title />;
  else if (page.value === "help") body = <Help />;
  else if (page.value === "town" || !run) body = <Town />;
  else body = <Game />;
  return (
    <div class={`stage ${portrait ? "portrait" : "landscape"}`} style={{ width: `${w}px`, height: `${h}px`, transform: `translate(-50%, -50%) scale(${scale})` }}>
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
      {run.cardPick && <CardPicker />}
    </div>
  );
}

const FLOOR_NAMES = ["", "第一层 · 照影廊", "第二层 · 桥驿", "第三层 · 钟楼"];

function Hud() {
  const run = useRun();
  const { order, parts } = orderProgress(run);
  const toggle = (o: "bag" | "deck") => { sfx.click(); overlay.value = overlay.value === o ? null : o; };
  const pending = run.pending.length;
  return (
    <header class="hud">
      <div class="hud-left">
        <span class="floor-name">{FLOOR_NAMES[run.floor]}</span>
        <Bar value={run.hp} max={run.maxHp} kind="hp" block={run.combat?.block ?? 0} />
        <span class="gold" title="灵石">{run.gold} 石</span>
      </div>
      <RelicRow relics={run.relics} />
      <div class="hud-order" title={order.story}>
        <span class="order-label">委托 · {order.client}</span>
        {run.orderDone ? <span class="done">已交付</span> : parts.map((p) => (
          <span class={p.have >= p.need ? "ok" : ""}><GoodChip id={p.id} /> {Math.min(p.have, p.need)}/{p.need}</span>
        ))}
      </div>
      <div class="hud-buttons">
        <button type="button" class={`btn small ${pending ? "alert" : ""}`} onClick={() => toggle("bag")}>行囊{pending ? ` · ${pending} 件没装` : ""} <kbd>B</kbd></button>
        <button type="button" class="btn small" onClick={() => toggle("deck")}>牌组 {run.deck.length} <kbd>C</kbd></button>
        <button type="button" class="btn small ghost" onClick={() => {
          profileSig.value = { ...profileSig.value, sound: !profileSig.value.sound };
          setSound(profileSig.value.sound);
          commit();
        }}>{profileSig.value.sound ? "声音开" : "声音关"}</button>
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
      else if (k === "escape") overlay.value = null;
    };
    window.addEventListener("keydown", onKey);
  }, []);
}

export const orderTitle = (id: string) => `${ORDERS[id].client}：${ORDERS[id].title}`;
