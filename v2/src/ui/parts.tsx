import type { ComponentChildren } from "preact";
import { CARDS, type Preview, RARITY_LABEL, TYPE_LABEL, cardCost, cardVals } from "../data/cards";
import { GOODS, KIND_LABEL, TAGS } from "../data/goods";
import { RELICS } from "../data/relics";
import type { GoodId, StatusId } from "../game/types";
import { ART, artId } from "../render/assets";
import { say } from "./store";

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
  thorns: { name: "反震", text: (n) => `每被打一下，回敬 ${n} 伤害。` },
  counter: { name: "回敬", text: (n) => `直到你的下回合，每被打一下回敬 ${n} 伤害。` },
  focus: { name: "蓄势", text: (n) => `下一张攻击牌伤害 +${n}。` },
  ward: { name: "护货", text: () => "本回合货不会被抢。" },
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

export function CardView({ id, up, preview, onClick, disabled, reason, small, selected, extra, bonus }: {
  id: string; up: boolean; preview: Preview; onClick?: () => void; disabled?: boolean; reason?: string | null;
  small?: boolean; selected?: boolean; extra?: ComponentChildren; bonus?: { dmg?: number; blk?: number };
}) {
  const def = CARDS[id];
  const cost = cardCost(def, up);
  return (
    <button type="button" class={`card pool-${def.pool} type-${def.type} ${small ? "small" : ""} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`}
      onClick={onClick} aria-disabled={disabled} title={reason ?? undefined}>
      <span class="cost">{cost}</span>
      <span class="name">{def.name}{up ? "+" : ""}</span>
      <span class="pic"><Art id={artId(`card-${id}`, CARD_ART[id] ?? "sword")} /></span>
      <span class="type">{TYPE_LABEL[def.type]} · {RARITY_LABEL[def.rarity]}</span>
      <span class="text">{def.text(cardVals(def, up, bonus), preview)}</span>
      {bonus && (bonus.dmg || bonus.blk) ? <span class="bonus-tag">{bonus.dmg ? `磨刀 +${bonus.dmg}` : ""}{bonus.blk ? ` 护符 +${bonus.blk}` : ""}</span> : null}
      {reason && <span class="reason">{reason}</span>}
      {extra}
    </button>
  );
}

/** `lose`: HP the card under the cursor would take off, shown as a flashing chunk at the end of the bar. */
export function Bar({ value, max, kind, block = 0, label, lose = 0 }: { value: number; max: number; kind: "hp" | "enemy"; block?: number; label?: string; lose?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const losePct = Math.min(pct, (Math.max(0, lose) / max) * 100);
  return (
    <div class={`bar bar-${kind}`}>
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
export function GoodInfo({ id, price, note }: { id: GoodId; price?: string; note?: string }) {
  const g = GOODS[id];
  return (
    <div class="good-info">
      <div class="gi-head"><Art id={g.icon} /><div><b>{g.name}</b><span>{KIND_LABEL[g.kind]}{price ? ` · ${price}` : ""}</span></div></div>
      <p>{g.text}</p>
      {g.passive && <p class="gi-line">带在身上：{g.passive}</p>}
      {g.cards && <p class="gi-line">牌组多出：{g.cards.map((c) => `「${CARDS[c].name}」`).join("")}</p>}
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
