import { sfx } from "../audio/sfx";
import { EVENTS } from "../data/events";
import * as R from "../game/run";
import { ART, artId } from "../render/assets";
import { BagGrid } from "./Bag";
import { commit, useRun } from "./store";

const FLOOR_BG: Record<number, string> = { 1: "court", 2: "gate", 3: "belfry" };

export function EventScreen() {
  const run = useRun();
  const ev = EVENTS[run.event!.id];
  const options = R.currentEventOptions(run);
  const result = run.event!.result;
  // The optional close-up is for conversation. The reveal uses the encounter sprite.
  const sprite = run.eventFight ? ev.sprite : artId(`event-${ev.sprite}`, ev.sprite);
  return (
    <div class="event" style={{ backgroundImage: `linear-gradient(rgba(5,3,2,0.55), rgba(5,3,2,0.75)), url(${ART[FLOOR_BG[run.floor]]})` }}>
      <div class="event-art"><img src={ART[sprite]} alt="" draggable={false} /></div>
      <div class="event-box panel">
        <h2>{ev.title}</h2>
        <p class="event-text">{ev.text}</p>
        {!result ? (
          <div class="options">
            {options.map((o, i) => {
              const locked = o.locked?.(run) ?? null;
              return (
                <button type="button" class={`option ${locked ? "locked" : ""}`} disabled={!!locked}
                  onClick={() => { sfx.click(); R.chooseEvent(run, i); commit(); }}>
                  <b>{o.label}</b><span>{locked ? `（${locked}）` : o.detail}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <p class="result-text">{result}</p>
            {run.pending.length > 0 && <BagGrid mode="manage" cell={44} />}
            <button type="button" class="btn big primary" onClick={() => { R.closeEvent(run); commit(); }}>
              {run.eventFight ? "迎战" : "继续"}{run.pending.length ? `（${run.pending.length} 件没装的留在这里）` : ""}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function RestScreen() {
  const run = useRun();
  const heal = Math.min(Math.round(run.maxHp * 0.3), run.maxHp - run.hp);
  return (
    <div class="event rest" style={{ backgroundImage: `linear-gradient(rgba(5,3,2,0.55), rgba(5,3,2,0.75)), url(${ART[FLOOR_BG[run.floor]]})` }}>
      <div class="event-art"><img src={ART.lamp} alt="" draggable={false} /></div>
      <div class="event-box panel">
        <h2>旧灯台</h2>
        <p class="event-text">守关妖就在不远处。灯台下还算安全，只够做一件事：歇口气、磨剑，或者把灯台的油倒进自己的灯里。</p>
        <div class="options">
          <button type="button" class="option" onClick={() => { sfx.click(); R.rest(run, "heal"); commit(); }}>
            <b>歇一会</b><span>回复 {heal} 气血（最大气血的 30%）。</span>
          </button>
          <button type="button" class="option" onClick={() => { sfx.click(); R.rest(run, "upgrade"); commit(); }}>
            <b>磨剑</b><span>升级 1 张牌。</span>
          </button>
          <button type="button" class="option" onClick={() => { sfx.click(); R.rest(run, "oil"); commit(); }}>
            <b>添灯油</b><span>灯油 +{Math.min(R.REST_OIL, run.maxOil - run.oil)}（现在 {run.oil} / {run.maxOil}）。</span>
          </button>
          <button type="button" class="option" onClick={() => { run.at = null; run.screen = "explore"; commit(); }}>
            <b>先不用</b><span>以后还能回来。</span>
          </button>
        </div>
      </div>
    </div>
  );
}
