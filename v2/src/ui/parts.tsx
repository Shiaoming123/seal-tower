import type { ComponentChildren } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { CARDS, type CardDef, type Preview, RARITY_LABEL, TYPE_LABEL, cardCost, cardVals } from "../data/cards";
import { GOODS, TAGS, kindLabel } from "../data/goods";
import { RELICS } from "../data/relics";
import { previewFor } from "../game/combat";
import type { GoodId, StatusId } from "../game/types";
import { ART, artId } from "../render/assets";
import { TERMS, type TermId } from "../data/glossary";
import { markTip, say, seenTip, termTip } from "./store";

export const CARD_ART: Record<string, string> = {
  strike: "sword", defend: "mirror", unison: "sword", twin: "sword", riposte: "hook", gap: "pin", breach: "ward-blade",
  gather: "knot", flurry: "pin", intent: "grit", cleave: "ward-blade", flow: "silk",
  bash: "mirror", wall: "mirror", spikes: "hook", center: "mirror", guardgoods: "order-purse", ram: "mirror", rooted: "bell-item", bulwark: "hook",
  dust: "ash", reveal: "seal", flame: "ash", burnwick: "seal", barter: "order-purse", scatter: "abacus", reap: "ash", lamparray: "seal", stoke: "ash",
  gale: "pin", sheathe: "sword", swordqi: "ward-blade", ironshirt: "mirror", hold: "plank", ignite: "seal", burnout: "ash", fuel: "salve",
  clearance: "ash", principal: "abacus", hoard: "pouch",
  reckon: "abacus", bribe: "order-purse", interest: "abacus", windfall: "abacus",
  bandage: "salve", breath: "silk", talisman: "pin", pluck: "clasp", steady: "knot",
};

export const STATUS_INFO: Record<StatusId, { name: string; text: (n: number) => string; bad?: boolean }> = {
  str: { name: "力量", text: (n) => `每次伤害 +${n}。` },
  weak: { name: "虚弱", text: (n) => `造成的伤害 -25%，还剩 ${n} 回合。`, bad: true },
  vuln: { name: "破绽", text: (n) => `受到的伤害 +50%，还剩 ${n} 回合。`, bad: true },
  thorns: { name: "棘刺", text: (n) => `每被打一下，扎回去 ${n} 伤害（整场有效）。` },
  counter: { name: "回敬", text: (n) => `直到你的下回合，每被打一下回敬 ${n} 伤害。` },
  focus: { name: "蓄势", text: (n) => `下一张攻击牌伤害 +${n}。` },
  ward: { name: "护货", text: () => "本回合货不会被抢，易碎货也不会磕坏。" },
  barricade: { name: "不动", text: () => "回合结束不清空格挡。" },
  lampArray: { name: "灯阵", text: (n) => `每回合开始烧 1 份灯灰，造成 ${n} 伤害并获得 ${n} 格挡。` },
  swordIntent: { name: "行云", text: () => "每回合第一张攻击牌后抽 1 张、能量 +1。" },
  bulwark: { name: "以守为攻", text: (n) => `每回合开始获得 ${n} 格挡。` },
  interest: { name: "生息", text: (n) => `每回合开始获得 ${n} 石。` },
  burn: { name: "灼烧", text: (n) => `每回合掉 ${n} 点血（无视格挡），然后少一层。`, bad: true },
  swordQi: { name: "剑气", text: (n) => `每打出一张攻击牌，额外造成 ${n} 伤害。` },
  ironshirt: { name: "铁布衫", text: (n) => `每次获得格挡，额外 +${n}。` },
  blind: { name: "墨糊眼", text: (n) => `下回合少抽 1 张牌（还剩 ${n} 回合）。`, bad: true },
};

export const relicIcon = (id: string) => artId(`relic-${id}`, RELICS[id].icon);
export const portraitOf = (id: string, fallback: string) => artId(`portrait-${id}`, fallback);

export function Art({ id, class: cls = "", alt = "" }: { id: string; class?: string; alt?: string }) {
  return <img class={`art ${cls}`} src={ART[id]} alt={alt} draggable={false} />;
}

const VAL_LABEL: Record<string, string> = { dmg: "伤害", blk: "格挡", hits: "段数", n: "数值", draw: "抽牌", plus: "加成", burn: "灼烧", heal: "回复" };
/** What upgrading a card changes, for the upgrade picker: cost, numbers, exhaust. Empty if nothing visible changes. */
export function upgradeDiff(id: string): string[] {
  const def = CARDS[id];
  const out: string[] = [];
  const c0 = cardCost(def, false), c1 = cardCost(def, true);
  if (c0 !== c1) out.push(`费用 ${c0} → ${c1}`);
  const [a, b] = def.v as [Record<string, number>, Record<string, number>];
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) if (a[k] !== b[k]) out.push(`${VAL_LABEL[k] ?? k} ${a[k] ?? 0} → ${b[k] ?? 0}`);
  const e0 = Array.isArray(def.exhaust) ? def.exhaust[0] : !!def.exhaust, e1 = Array.isArray(def.exhaust) ? def.exhaust[1] : !!def.exhaust;
  if (e0 && !e1) out.push("不再消耗");
  return out;
}

/**
 * A card's rules text as shown on its face. Exhausting cards always say so (火上浇油 used to vanish without a word),
 * and 「消耗」 says what it means (REVIEW-001).
 */
export function cardText(def: CardDef, up: boolean, bonus: { dmg?: number; blk?: number } | undefined, preview: Preview): string {
  let t = def.text(cardVals(def, up, bonus), preview);
  const ex = Array.isArray(def.exhaust) ? def.exhaust[up ? 1 : 0] : !!def.exhaust;
  if (ex && !/消耗。$/.test(t)) t += "消耗。";
  return t.replace(/(^|[。，])消耗。$/, "$1消耗（这场只能用一次）。");
}

export function CardView({ id, up, preview, onClick, disabled, reason, small, selected, extra, bonus, readOnly }: {
  id: string; up: boolean; preview: Preview; onClick?: () => void; disabled?: boolean; reason?: string | null;
  readOnly?: boolean; small?: boolean; selected?: boolean; extra?: ComponentChildren; bonus?: { dmg?: number; blk?: number };
}) {
  const def = CARDS[id];
  const cost = cardCost(def, up);
  const Tag = readOnly ? "div" : "button";
  return (
    <Tag type={readOnly ? undefined : "button"} class={`card pool-${def.pool} type-${def.type} ${small ? "small" : ""} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""} ${readOnly ? "read-only" : ""}`}
      onClick={readOnly ? undefined : onClick} aria-disabled={disabled} title={reason ?? undefined}>
      <span class="cost">{cost}</span>
      <span class="name">{def.name}{up ? "+" : ""}</span>
      <span class="pic"><Art id={artId(`card-${id}`, CARD_ART[id] ?? "sword")} /></span>
      <span class="type">{TYPE_LABEL[def.type]}{def.type === "power" ? "（整场有效）" : ""} · {RARITY_LABEL[def.rarity]}</span>
      {def.tags?.includes("fire") && <span class="fire-tag" title="带「火」字的牌：纸人怕火，但用它打出最后一下会烧掉红纸">火</span>}
      {/* 「消耗」 alone means nothing to a new player: say what it does right on the card (REVIEW-001). */}
      <span class="text">{cardText(def, up, bonus, preview)}</span>
      {(() => {
        // Only name a bonus this card actually uses (REVIEW-001: 「护符 +2」 used to sit on attack-only cards).
        const v = def.v[0], dmg = bonus?.dmg && (v.dmg !== undefined || v.plus !== undefined) ? bonus.dmg : 0, blk = bonus?.blk && v.blk !== undefined ? bonus.blk : 0;
        return dmg || blk ? <span class="bonus-tag">{[dmg ? `伤害 +${dmg}` : "", blk ? `格挡 +${blk}` : ""].filter(Boolean).join(" ")}</span> : null;
      })()}
      {reason && <span class="reason">{reason}</span>}
      {extra}
    </Tag>
  );
}

/** A number that rolls to its new value instead of jumping, and flashes up (gold) or down (red) as it changes. */
export function RollingNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const [dir, setDir] = useState<"" | "up" | "down">("");
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    setDir(value > start ? "up" : "down");
    const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now(), dur = calm ? 0 : Math.min(600, 200 + Math.abs(value - start) * 12);
    let raf = 0;
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1;
      setShown(Math.round(start + (value - start) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step); else { from.current = value; setTimeout(() => setDir(""), 250); }
    };
    raf = requestAnimationFrame(step);
    // Fallback when frames are throttled (background tab): land on the final value anyway.
    const done = setTimeout(() => { cancelAnimationFrame(raf); setShown(value); from.current = value; setDir(""); }, dur + 300);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); from.current = value; };
  }, [value]);
  return <span class={`roll ${dir}`}>{shown}</span>;
}

/** `lose`: HP the card under the cursor would take off, shown as a flashing chunk at the end of the bar. */
export function Bar({ value, max, kind, block = 0, label, lose = 0 }: { value: number; max: number; kind: "hp" | "enemy"; block?: number; label?: string; lose?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  // Flash the bar when the value changes: red for damage, green for healing.
  const prev = useRef(value);
  const [flash, setFlash] = useState<"" | "down" | "up">("");
  useEffect(() => {
    if (value === prev.current) return;
    setFlash(value < prev.current ? "down" : "up");
    prev.current = value;
    const t = setTimeout(() => setFlash(""), 450);
    return () => clearTimeout(t);
  }, [value]);
  const losePct = Math.min(pct, (Math.max(0, lose) / max) * 100);
  return (
    <div class={`bar bar-${kind} ${flash ? `flash-${flash}` : ""}`}>
      <div class="trail" style={{ width: `${pct}%` }} />
      <div class="fill" style={{ width: `${pct}%` }} />
      {losePct > 0 && <div class="lose" style={{ left: `${pct - losePct}%`, width: `${losePct}%` }} />}
      <span class="num">{label ?? `${value} / ${max}`}</span>
      {block > 0 && <span class="shield">{block}</span>}
    </div>
  );
}

export function Statuses({ status }: { status: Partial<Record<StatusId, number>> }) {
  const entries = Object.entries(status).filter(([, n]) => n) as [StatusId, number][];
  if (!entries.length) return null;
  return (
    <div class="statuses">
      {entries.map(([id, n]) => {
        const info = STATUS_INFO[id];
        return (
          <button type="button" class={`chip ${info.bad ? "bad" : ""}`} title={info.text(n)} onClick={() => say(`${info.name}：${info.text(n)}`)}>
            {info.name}{n > 1 || id === "focus" || id === "str" ? ` ${n}` : ""}
          </button>
        );
      })}
    </div>
  );
}

export function RelicRow({ relics }: { relics: string[] }) {
  return (
    <div class="relics">
      {relics.map((id) => (
        <button type="button" class="relic" title={`${RELICS[id].name}：${RELICS[id].text}`} onClick={() => say(`${RELICS[id].name}：${RELICS[id].text}`, 3600)}>
          <Art id={relicIcon(id)} />
        </button>
      ))}
      {/* With many relics the coins overlap and the row is clipped: the count lists them all (follow-up review). */}
      {relics.length >= 3 && (
        <button type="button" class="relic-count" title="看全部法宝" onClick={() => say(`法宝 ${relics.length} 件：${relics.map((id) => `${RELICS[id].name}（${RELICS[id].text}）`).join("；")}`, 9000)}>{relics.length}</button>
      )}
    </div>
  );
}

/** How a good is presented when you get it: plain, good (blue) or rare (gold), by its value. */
export function goodTier(id: GoodId): "plain" | "good" | "rare" {
  const p = GOODS[id].price;
  return p >= 8 ? "rare" : p >= 5 ? "good" : "plain";
}

/** One framed loot slot: icon, count, name. Used by the reward screen and the goods reveal. */
export function LootSlot({ id, n }: { id: GoodId; n?: number }) {
  const g = GOODS[id];
  return (
    <div class={`loot tier-${goodTier(id)} ${g.dim ? "dim" : ""}`} title={g.text}>
      <span class="loot-frame"><Art id={g.icon} />{n && n > 1 ? <i>×{n}</i> : null}</span>
      <small>{g.name}</small>
    </div>
  );
}

/** Read-only details of a good (no buttons): shown when you look at a ware in the 狐市 or pick a good to sell. */
/** A neutral preview (no fight, empty bag) for card text outside combat. */
let giPv: Preview | null = null;
const giPreview = () => (giPv ??= previewFor({ bag: { w: 1, h: 1, items: [] }, gold: 0, relics: [], combat: null } as never, null));

export function GoodInfo({ id, price, note }: { id: GoodId; price?: string; note?: string }) {
  const g = GOODS[id];
  return (
    <div class="good-info">
      <div class="gi-head"><Art id={g.icon} /><div><b>{g.name}</b><span>{kindLabel(id)}{price ? ` · ${price}` : ""}</span></div></div>
      <p>{g.text}</p>
      {g.passive && <p class="gi-line">带在身上：{g.passive}</p>}
      {g.cards && (
        // The whole card, not just its name: what goes into the deck is the point of buying gear (REVIEW-001).
        <div class="gi-line gi-cards">放进行囊，牌组多出：{g.cards.map((c) => <span class="det-card"><b>「{CARDS[c].name}{g.cardsUp ? "+" : ""}」</b>{cardText(CARDS[c], !!g.cardsUp, g.selfBonus, giPreview())}</span>)}</div>
      )}
      {g.aura && <p class="gi-line">配件：{g.aura.text}</p>}
      {g.use && <p class="gi-line">{g.use.label}</p>}
      {g.tags && <p class="gi-tags">{g.tags.map((t) => `「${TAGS[t].name}」套装`).join("　")}</p>}
      {note && <p class="gi-note">{note}</p>}
    </div>
  );
}

export function GoodChip({ id, n }: { id: GoodId; n?: number }) {
  const g = GOODS[id];
  return (
    <span class={`good-chip ${g.dim ? "dim" : ""}`} title={g.text}>
      <Art id={g.icon} />{g.name}{n && n > 1 ? ` ×${n}` : ""}
    </span>
  );
}

export function Panel({ title, children, class: cls = "" }: { title?: string; children: ComponentChildren; class?: string }) {
  return (
    <section class={`panel ${cls}`}>
      {title && <h3>{title}</h3>}
      {children}
    </section>
  );
}

export const countGoods = (ids: GoodId[]) => {
  const m = new Map<GoodId, number>();
  for (const id of ids) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()];
};

/** A game word with a dotted underline: tap it to see what it means (the popover is drawn by <TermPopover>). */
export function Term({ id, children }: { id: TermId; children?: ComponentChildren }) {
  return (
    <span class="term" role="button" tabIndex={0} onClick={(e) => {
      e.stopPropagation();
      const el = e.currentTarget as HTMLElement, stage = document.querySelector(".stage") as HTMLElement | null;
      if (!stage) return;
      const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect(), k = s.width / stage.offsetWidth;
      termTip.value = termTip.value?.id === id ? null : { id, x: (r.left - s.left) / k, y: (r.bottom - s.top) / k + 4, top: (r.top - s.top) / k - 4 };
    }}>{children ?? TERMS[id].name}</span>
  );
}

/** The one glossary popover, on top of the stage; any tap elsewhere closes it. */
export function TermPopover() {
  const t = termTip.value;
  useEffect(() => {
    if (!t) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest(".term-pop, .term")) termTip.value = null; };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [t]);
  if (!t) return null;
  const term = TERMS[t.id as TermId];
  const stage = document.querySelector(".stage") as HTMLElement | null;
  const w = 300, maxX = (stage?.offsetWidth ?? 1280) - w - 8, H = stage?.offsetHeight ?? 720;
  // Words low on the stage open their explanation upwards, so it never runs off the bottom.
  const up = t.y > H * 0.6;
  return (
    <div class="term-pop" style={{ left: `${Math.max(8, Math.min(maxX, t.x))}px`, width: `${w}px`, ...(up ? { bottom: `${H - (t.top ?? t.y)}px` } : { top: `${t.y}px` }) }}>
      <b>{term.name}</b>
      <p>{term.short}</p>
      <p class="muted">{term.more}</p>
    </div>
  );
}

/** First time an idea matters on this screen, explain it once: the first of `ids` not yet seen, with 「知道了」. */
// `float` pins it over a 3D view (explore, combat); in normal flow it would sit under the canvas.
// One new concept per visit (TIP-PACE): after 「知道了」 the next one waits until the screen is opened again (the next
// fight, the next walk, the next look in the bag). The first playtest tapped 知道了 about ten times in two minutes.
export function ConceptTip({ ids, float }: { ids: TermId[]; float?: boolean }) {
  const [done, setDone] = useState(false);
  const id = ids.find((x) => !seenTip(`term:${x}`));
  if (!id || done) return null;
  const term = TERMS[id];
  return (
    <div class={`concept-tip ${float ? "float" : ""}`}>
      <span class="ct-badge">新概念</span>
      <b>{term.name}</b>
      <p>{term.short}</p>
      <p class="muted">{term.more}</p>
      <button type="button" class="btn small" onClick={() => { markTip(`term:${id}`); setDone(true); }}>知道了</button>
    </div>
  );
}
