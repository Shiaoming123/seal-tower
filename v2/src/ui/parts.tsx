import type { ComponentChildren } from "preact";
import { CARDS, type Preview, RARITY_LABEL, TYPE_LABEL, cardCost, cardVals } from "../data/cards";
import { GOODS } from "../data/goods";
import { RELICS } from "../data/relics";
import type { GoodId, StatusId } from "../game/types";
import { ART } from "../render/assets";
import { say } from "./store";

export const CARD_ART: Record<string, string> = {
  strike: "sword", defend: "mirror", unison: "sword", twin: "sword", riposte: "hook", gap: "pin", breach: "ward-blade",
  gather: "knot", flurry: "pin", intent: "grit", cleave: "ward-blade", flow: "silk",
  bash: "mirror", wall: "mirror", spikes: "hook", center: "mirror", guardgoods: "order-purse", ram: "mirror", rooted: "bell-item", bulwark: "hook",
  dust: "ash", reveal: "seal", flame: "ash", burnwick: "seal", barter: "order-purse", scatter: "abacus", reap: "ash", lamparray: "seal", stoke: "ash",
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
  blind: { name: "墨糊眼", text: (n) => `下回合少抽 1 张牌（还剩 ${n} 回合）。`, bad: true },
};

export function Art({ id, class: cls = "", alt = "" }: { id: string; class?: string; alt?: string }) {
  return <img class={`art ${cls}`} src={ART[id]} alt={alt} draggable={false} />;
}

export function CardView({ id, up, preview, onClick, disabled, reason, small, selected, extra }: {
  id: string; up: boolean; preview: Preview; onClick?: () => void; disabled?: boolean; reason?: string | null;
  small?: boolean; selected?: boolean; extra?: ComponentChildren;
}) {
  const def = CARDS[id];
  const cost = cardCost(def, up);
  return (
    <button type="button" class={`card pool-${def.pool} type-${def.type} ${small ? "small" : ""} ${disabled ? "disabled" : ""} ${selected ? "selected" : ""}`}
      onClick={onClick} aria-disabled={disabled} title={reason ?? undefined}>
      <span class="cost">{cost}</span>
      <span class="name">{def.name}{up ? "+" : ""}</span>
      <span class="pic"><Art id={CARD_ART[id] ?? "sword"} /></span>
      <span class="type">{TYPE_LABEL[def.type]} · {RARITY_LABEL[def.rarity]}</span>
      <span class="text">{def.text(cardVals(def, up), preview)}</span>
      {reason && <span class="reason">{reason}</span>}
      {extra}
    </button>
  );
}

export function Bar({ value, max, kind, block = 0, label }: { value: number; max: number; kind: "hp" | "enemy"; block?: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div class={`bar bar-${kind}`}>
      <div class="fill" style={{ width: `${pct}%` }} />
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
          <Art id={RELICS[id].icon} />
        </button>
      ))}
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
