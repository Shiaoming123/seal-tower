import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CHARACTERS, ENEMY_LORE } from "../data/codex";
import { ENEMIES, FLOOR_SPAWNS } from "../data/enemies";
import { GOODS, KIND_LABEL } from "../data/goods";
import { RELICS } from "../data/relics";
import { CARDS } from "../data/cards";
import { ART } from "../render/assets";
import { portraitOf, relicIcon } from "./parts";
import { page, profileSig } from "./store";

type Tab = "enemies" | "goods" | "relics" | "people";

/** Floors where an enemy can appear, for the codex entry. */
function floorsOf(id: string): string {
  const out: string[] = [];
  for (const f of [1, 2, 3] as const) {
    const s = FLOOR_SPAWNS[f];
    if (s.guardian.some((g) => g.id === id)) out.push(`第${"一二三"[f - 1]}层守关`);
    else if (s.elite.some((g) => g.id === id)) out.push(`第${"一二三"[f - 1]}层精英`);
    else if (s.normal.some((g) => g.id === id)) out.push(`第${"一二三"[f - 1]}层`);
  }
  return out.join("、") || (ENEMIES[id].eventOnly ? "只在事件里出现" : "");
}

export function Codex() {
  const p = profileSig.value;
  const seen = new Set(p.codex);
  const [tab, setTab] = useState<Tab>("enemies");
  const [sel, setSel] = useState<string | null>(null);
  const entries: { key: string; id: string; name: string; art: string }[] =
    tab === "enemies" ? Object.values(ENEMIES).map((e) => ({ key: "e:" + e.id, id: e.id, name: e.name, art: e.sprite }))
    : tab === "goods" ? Object.values(GOODS).map((g) => ({ key: "g:" + g.id, id: g.id, name: g.name, art: g.icon }))
    : tab === "relics" ? Object.values(RELICS).map((r) => ({ key: "r:" + r.id, id: r.id, name: r.name, art: relicIcon(r.id) }))
    : CHARACTERS.map((c) => ({ key: "c:" + c.id, id: c.id, name: c.name, art: portraitOf(c.id, c.portrait) }));
  const count = entries.filter((e) => seen.has(e.key)).length;
  const cur = entries.find((e) => e.key === sel && seen.has(e.key)) ?? null;
  const tabs: [Tab, string][] = [["enemies", "妖怪"], ["goods", "货物与装备"], ["relics", "法宝"], ["people", "人物"]];
  return (
    <div class="codex-screen">
      <header class="codex-head">
        <button type="button" class="btn small ghost" onClick={() => (page.value = "title")}>← 返回</button>
        <h2>图鉴</h2>
        <div class="town-tabs">
          {tabs.map(([t, label]) => <button type="button" class={`btn small ${tab === t ? "primary" : "ghost"}`} onClick={() => { sfx.click(); setTab(t); setSel(null); }}>{label}</button>)}
        </div>
        <span class="treasury">{count} / {entries.length}</span>
      </header>
      <div class="codex-body">
        <div class="codex-grid">
          {entries.map((e) => {
            const known = seen.has(e.key);
            return (
              <button type="button" class={`codex-cell ${known ? "" : "unknown"} ${sel === e.key ? "selected" : ""}`} onClick={() => { sfx.click(); setSel(e.key); }}>
                <img src={ART[e.art]} alt="" draggable={false} />
                <span>{known ? e.name : "？？？"}</span>
              </button>
            );
          })}
        </div>
        <div class="codex-detail">
          {!cur ? <p class="muted">{sel ? "还没遇见过。进塔看看吧。" : "点一个条目看详情。遇见过的妖、拿到过的东西、认识的人都会记在这里。"}</p> : <Detail tab={tab} id={cur.id} art={cur.art} name={cur.name} />}
        </div>
      </div>
    </div>
  );
}

function Detail({ tab, id, art, name }: { tab: Tab; id: string; art: string; name: string }) {
  const p = profileSig.value;
  if (tab === "enemies") {
    const e = ENEMIES[id];
    return (
      <>
        <img class="codex-art" src={ART[art]} alt="" />
        <h3>{name} <small>{floorsOf(id)}</small></h3>
        <p class="lore">{ENEMY_LORE[id]}</p>
        <p><b>打法：</b>{e.blurb}</p>
        {e.harvest && <p><b>取材：</b>{e.harvest.text}，多拿{e.harvest.label}。</p>}
        {e.part && <p><b>易碎：</b>{e.part.label}单次受伤到 {e.part.threshold} 会碎。</p>}
        <p class="muted">招式：{Object.values(e.moves).map((m) => m.name).join("、")}</p>
      </>
    );
  }
  if (tab === "goods") {
    const g = GOODS[id as keyof typeof GOODS];
    return (
      <>
        <img class="codex-art small" src={ART[art]} alt="" />
        <h3>{name} <small>{KIND_LABEL[g.kind]} · 镇上价 {g.price} 石</small></h3>
        <p class="lore">{g.text}</p>
        {g.cards && <p><b>带来的牌：</b>{g.cards.map((c) => CARDS[c].name).join("、")}</p>}
        {g.passive && <p><b>带在身上：</b>{g.passive}</p>}
        {g.aura && <p><b>配件：</b>{g.aura.text}</p>}
        {g.use && <p><b>用法：</b>{g.use.label}</p>}
      </>
    );
  }
  if (tab === "relics") {
    const r = RELICS[id];
    return (
      <>
        <img class="codex-art small" src={ART[art]} alt="" />
        <h3>{name} <small>法宝</small></h3>
        <p class="lore">{r.text}</p>
      </>
    );
  }
  const c = CHARACTERS.find((x) => x.id === id)!;
  const level = c.favorKey ? p.favor[c.favorKey] ?? 0 : 99;
  return (
    <>
      <img class="codex-art" src={ART[art]} alt="" />
      <h3>{name} {c.favorKey && <small>交情 {level}</small>}</h3>
      {c.lines.map((l) => (level >= l.need
        ? <p class="lore">{l.text}</p>
        : <p class="muted">（交情到 {l.need} 时，你会知道更多。）</p>))}
    </>
  );
}
