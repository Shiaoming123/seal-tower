import { sfx } from "../audio/sfx";
import { EVENTS } from "../data/events";
import { GOODS } from "../data/goods";
import * as R from "../game/run";
import { ART, artId } from "../render/assets";
import { BagGrid } from "./Bag";
import { GoodsReveal } from "./Reveal";
import { commit, useRun } from "./store";
import { useState } from "preact/hooks";
import type { GoodId, RunState } from "../game/types";

/** Every good you carry (bag, the not-yet-packed pile, side pouch), to see what an event just handed over. */
const carried = (run: RunState): GoodId[] => [...run.bag.items.map((it) => it.id), ...run.pending, ...run.pouch];
function gained(before: GoodId[], after: GoodId[]): GoodId[] {
  const left = [...before];
  return after.filter((g) => { const i = left.indexOf(g); if (i >= 0) { left.splice(i, 1); return false; } return true; });
}

const FLOOR_BG: Record<number, string> = { 1: "court", 2: "gate", 3: "belfry" };

export function EventScreen() {
  const run = useRun();
  const ev = EVENTS[run.event!.id];
  const options = R.currentEventOptions(run);
  const result = run.event!.result;
  // The optional close-up is for conversation. The reveal uses the encounter sprite.
  const sprite = run.eventFight ? ev.sprite : artId(`event-${ev.sprite}`, ev.sprite);
  const [reveal, setReveal] = useState<GoodId[] | null>(null);
  const choose = (i: number) => {
    const before = carried(run);
    sfx.click(); R.chooseEvent(run, i);
    const got = gained(before, carried(run)).filter((g) => GOODS[g].kind === "goods");
    if (got.length >= 2) setReveal(got);
    commit();
  };
  return (
    <div class="event" style={{ backgroundImage: `linear-gradient(rgba(5,3,2,0.55), rgba(5,3,2,0.75)), url(${ART[FLOOR_BG[run.floor]]})` }}>
      <div class="event-art"><img src={ART[sprite]} alt="" draggable={false} /></div>
      <div class="event-box panel">
        <div class="event-scroll">
        <h2>{ev.title}</h2>
        <p class="event-text">{ev.text}</p>
        {!result ? (
          <div class="options">
            {options.map((o, i) => {
              const locked = o.locked?.(run) ?? null;
              return (
                <button type="button" class={`option ${locked ? "locked" : ""}`} disabled={!!locked}
                  onClick={() => choose(i)}>
                  <b>{o.label}</b><span>{o.detail}{locked ? <em class="lock-why">（{locked}）</em> : null}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <>
            <p class="result-text">{result}</p>
            {run.pending.length > 0 && <BagGrid mode="manage" cell={44} />}
          </>
        )}
        </div>
        {/* Outside the scrolling area so it never ends up below the stage, however full the bag is. */}
        {result && (
          <button type="button" class="btn big primary event-continue" onClick={() => { R.closeEvent(run); commit(); }}>
            {run.eventFight ? "迎战" : "继续"}
          </button>
        )}
      </div>
      {reveal && <GoodsReveal goods={reveal} onDone={() => setReveal(null)} />}
    </div>
  );
}

export function RestScreen() {
  const run = useRun();
  const heal = Math.min(Math.round(run.maxHp * 0.3), run.maxHp - run.hp);
  // 香火旺 allows two different choices here (GAME-009); each one used is greyed out.
  const e = R.currentEntity(run);
  const used = e?.restUsed ?? [];
  const allow = R.restAllowance(run);
  // A choice that would do nothing (full HP, full oil) is greyed out instead of quietly using up the lamp (REVIEW-002).
  const opt = (id: "heal" | "upgrade" | "oil", title: string, text: string, useless?: string) => {
    const why = used.includes(id) ? "已经做过了" : useless;
    return (
      <button type="button" class={`option ${why ? "locked" : ""}`} disabled={!!why} onClick={() => { sfx.click(); R.rest(run, id); commit(); }}>
        <b>{title}</b><span>{why ? `（${why}）` : text}</span>
      </button>
    );
  };
  return (
    <div class="event rest" style={{ backgroundImage: `linear-gradient(rgba(5,3,2,0.55), rgba(5,3,2,0.75)), url(${ART[FLOOR_BG[run.floor]]})` }}>
      <div class="event-art"><img src={ART.lamp} alt="" draggable={false} /></div>
      <div class="event-box panel">
        <h2>旧灯台</h2>
        <p class="event-text">{allow > 1
          ? `守关妖就在不远处。今晚香火旺，灯台的香够用两回：可以做两件不同的事${used.length ? `（还能再做 ${allow - used.length} 件）` : ""}。`
          : "守关妖就在不远处。灯台下还算安全，只够做一件事：歇口气、磨剑，或者把灯台的油倒进自己的灯里。"}</p>
        <div class="options">
          {opt("heal", "歇一会", `回复 ${heal} 气血（最多回复最大气血的 30%）。`, heal <= 0 ? "气血是满的" : undefined)}
          {opt("upgrade", "磨剑", "升级 1 张牌。")}
          {opt("oil", "添灯油", `灯油 +${Math.min(R.REST_OIL, run.maxOil - run.oil)}（现在 ${run.oil} / ${run.maxOil}）。`, run.oil >= run.maxOil ? "灯油是满的" : undefined)}
          <button type="button" class="option" onClick={() => { run.at = null; run.screen = "explore"; commit(); }}>
            <b>{used.length ? "先走" : "先不用"}</b><span>{used.length ? "剩下的一回以后还能回来用。" : "以后还能回来。"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
