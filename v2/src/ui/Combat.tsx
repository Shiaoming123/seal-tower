import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { ENEMIES } from "../data/enemies";
import { GOODS } from "../data/goods";
import { type CombatEvent, blockedReason, endTurn, enemyHitDamage, incomingDamage, playCard, previewFor, stealTarget } from "../game/combat";
import { DIRS } from "../game/dungeon";
import { useItem } from "../game/inventory";
import * as R from "../game/run";
import type { CombatState, RunState } from "../game/types";
import { ART, artId } from "../render/assets";
import { useView } from "./Explore";
import { Bar, CardView, Statuses } from "./parts";
import { commit, markTip, overlay, say, seenTip, useRun } from "./store";

interface Floater { id: number; text: string; kind: string; x: number; y: number }
let floaterId = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function intentSummary(run: RunState, c: CombatState) {
  const i = c.enemy.intent;
  const parts: { icon: string; label: string; cls: string }[] = [];
  if (i.stunned) parts.push({ icon: "晕", label: "", cls: "stun" });
  if (i.flee) parts.push({ icon: "逃", label: "", cls: "steal" });
  if (i.charge) parts.push({ icon: "蓄", label: `${Math.min(c.dmgThisTurn, i.charge.threshold)}/${i.charge.threshold}`, cls: "charge" });
  if (i.dmg && !i.stunned) parts.push({ icon: "攻", label: `${enemyHitDamage(run, c)}${(i.hits ?? 1) > 1 ? `×${i.hits}` : ""}`, cls: "atk" });
  if (i.steal) parts.push({ icon: "抢", label: "", cls: "steal" });
  if (i.drainOil) parts.push({ icon: "油", label: `-${i.drainOil}`, cls: "steal" });
  if (i.eatAsh) parts.push({ icon: "灰", label: `-${i.eatAsh}`, cls: "steal" });
  if (i.stealGold) parts.push({ icon: "钱", label: `-${i.stealGold}`, cls: "steal" });
  if (i.counter) parts.push({ icon: "架", label: `${i.counter}`, cls: "def" });
  if (i.dive) parts.push({ icon: "潜", label: "½", cls: "def" });
  if (i.thorns) parts.push({ icon: "棘", label: `+${i.thorns}`, cls: "buff" });
  if (i.block) parts.push({ icon: "守", label: `${i.block}`, cls: "def" });
  if (i.str) parts.push({ icon: "强", label: `+${i.str}`, cls: "buff" });
  if (i.apply) parts.push({ icon: i.apply.status === "weak" ? "弱" : i.apply.status === "blind" ? "盲" : "破", label: `${i.apply.n}`, cls: "debuff" });

  let line = i.text ?? "";
  if (!line) {
    const bits: string[] = [];
    if (i.dmg) bits.push(`打你 ${enemyHitDamage(run, c)} 点${(i.hits ?? 1) > 1 ? `，连打 ${i.hits} 下` : ""}`);
    if (i.block) bits.push(`给自己加 ${i.block} 格挡`);
    if (i.str) bits.push(`力量 +${i.str}`);
    if (i.apply) bits.push(i.apply.status === "blind" ? "糊住你的眼睛（下回合少抽 1 张牌）" : `让你${i.apply.status === "weak" ? "虚弱（伤害 -25%）" : "露出破绽（受伤 +50%）"} ${i.apply.n} 回合`);
    if (i.thorns) bits.push(`身上多长 ${i.thorns} 层棘刺`);
    line = bits.join("，") + "。";
  }
  if (i.drainOil) line += ` 打穿格挡会吸走你 ${i.drainOil} 点灯油（你有 ${run.oil}）。`;
  if (i.eatAsh) line += ` 打穿格挡会吃掉你 ${i.eatAsh} 份灯灰。`;
  if (i.stealGold) line += ` 打穿格挡会收走你 ${i.stealGold} 石。`;
  const def = ENEMIES[c.enemy.id];
  if (def.maxHit) line += ` 铜身：你每下最多打 ${def.maxHit} 点。`;
  if (def.weakTo === "fire") line += " 怕火：扬灰、灯火伤害翻倍。";
  if (c.enemy.status.thorns) line += ` 你每打它一下，自己挨 ${c.enemy.status.thorns + (i.counter ?? 0)} 点。`;
  if (def.dmgMod && def.dmgMod(run.oil)) line += def.dmgMod(run.oil) > 0 ? ` 灯油不足 30，它每下多打 ${def.dmgMod(run.oil)}。` : ` 灯油充足，它每下少打 ${-def.dmgMod(run.oil)}。`;
  if (i.steal) {
    const t = stealTarget(run);
    const how = ENEMIES[c.enemy.id].stealFlees ? "叼走" : "抢走并毁掉";
    line += c.status.ward ? " 你已经护住了货。" : t ? ` 只要有伤害打穿格挡，就会${how}「${GOODS[t].name}」。` : " 你的行囊里没有能抢的货。";
  }
  if (i.charge) {
    const next = ENEMIES[c.enemy.id].moves[i.charge.then];
    line += ` 不打断的话，下回合放「${next.name}」${next.dmg ? `（${next.dmg + c.enemy.dmgAdd + (c.enemy.status.str ?? 0)} 伤害）` : ""}。`;
  }
  return { parts, line };
}

export function Combat() {
  const run = useRun();
  const c = run.combat!;
  const ref = useRef<HTMLDivElement>(null);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [fx, setFx] = useState<string>("");
  const [banner, setBanner] = useState<string>("");
  const [slash, setSlash] = useState(0);
  const busy = useRef(false);
  useView(ref, run, { hideAll: true, dim: 0.35 });

  const float = (text: string, kind: string, target: "enemy" | "player") => {
    const f = { id: ++floaterId, text, kind, x: target === "enemy" ? 50 + (Math.random() * 16 - 8) : 22 + Math.random() * 8, y: target === "enemy" ? 34 + Math.random() * 8 : 70 };
    setFloaters((fs) => [...fs.slice(-8), f]);
    setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== f.id)), 1100);
  };
  const flash = async (cls: string, ms = 260) => { setFx(cls); await wait(ms); setFx(""); };

  const show = async (events: CombatEvent[]) => {
    for (const e of events) {
      if (e.t === "hit") {
        if (e.target === "enemy") {
          if (e.amount > 0) { e.amount >= 12 ? sfx.heavy() : sfx.hit(); float(`-${e.amount}`, "dmg", "enemy"); setSlash((n) => n + 1); }
          if (e.blocked) { sfx.block(); float(`挡 ${e.blocked}`, "blocked", "enemy"); }
          if (e.part === "broke") { float(`${ENEMIES[c.enemy.id].part!.label}碎了`, "warn", "enemy"); }
          void flash("enemy-hit", 200);
        } else {
          if (e.amount > 0) { sfx.hurt(); float(`-${e.amount}`, "hurt", "player"); void flash("player-hit", 300); }
          if (e.blocked) { sfx.block(); float(`挡住 ${e.blocked}`, "blocked", "player"); }
        }
        await wait(170);
      } else if (e.t === "block") { if (e.target === "player") float(`+${e.amount} 格挡`, "block", "player"); else float(`+${e.amount} 格挡`, "block", "enemy"); }
      else if (e.t === "status" && e.id === "burn" && e.n < 0) { sfx.burn(); }
      else if (e.t === "status") float(`${e.n > 0 ? "" : ""}${statusName(e.id)} ${e.n}`, e.target === "enemy" ? "status" : "status-self", e.target);
      else if (e.t === "steal") {
        if (e.saved) { float("货护住了", "block", "player"); }
        else if (e.good) { sfx.steal(); setBanner(`${c.enemy.name}抢走了「${GOODS[e.good].name}」！`); float(`被抢：${GOODS[e.good].name}`, "warn", "player"); await wait(400); }
      }
      else if (e.t === "interrupt") { sfx.interrupt(); setBanner(`打断了！${c.enemy.name}的蓄力落空。`); float("打断", "warn", "enemy"); await wait(300); }
      else if (e.t === "phase") { sfx.gong(); setBanner(e.text); await wait(700); }
      else if (e.t === "heal") { if (e.amount) float(`+${e.amount}`, "heal", "player"); }
      else if (e.t === "goods") float(`${e.gained ? "+" : "烧掉 "}${GOODS[e.good].name}`, e.gained ? "heal" : "status", "player");
      else if (e.t === "thorns") { if (e.target === "player") float(`被扎 ${e.amount}`, "hurt", "player"); else float(`回敬 ${e.amount}`, "status-self", "enemy"); }
      else if (e.t === "drain") { sfx.drain(); float(e.what === "oil" ? `灯油 -${e.amount}` : e.what === "ash" ? `被吃掉 ${e.amount} 份灯灰` : `被收走 ${e.amount} 石`, "warn", "player"); }
      else if (e.t === "enemy-move") { setBanner(`${c.enemy.name}：${e.name}`); }
      else if (e.t === "fled") { sfx.steal(); setBanner(`${c.enemy.name}钻进洞里跑了！`); await wait(700); }
    }
    await settle();
  };

  const settle = async () => {
    if (c.over === "win") {
      busy.current = true;
      sfx.win();
      setFx("enemy-die");
      await wait(900);
      R.winCombat(run);
      commit();
    } else if (c.over === "fled") {
      busy.current = true;
      setFx("enemy-die");
      await wait(900);
      R.fledCombat(run);
      commit();
      say(`${c.enemy.name}带着${c.stolen.map((g) => GOODS[g].name).join("、")}跑了。`, 3200);
    } else if (c.over === "lose") {
      busy.current = true;
      sfx.lose();
      await wait(900);
      R.loseCombat(run);
      commit();
    }
  };

  const play = async (i: number) => {
    if (busy.current || c.over) return;
    const card = c.hand[i];
    const reason = card && blockedReason(run, c, card);
    if (reason) { say(reason); return; }
    busy.current = true;
    sfx.card();
    const res = playCard(run, i);
    commit();
    await show(res.events);
    busy.current = false;
    commit();
  };

  const finishTurn = async () => {
    if (busy.current || c.over) return;
    busy.current = true;
    setBanner("");
    if (c.enemy.intent.dmg && !c.enemy.intent.stunned && !(c.enemy.intent.charge && c.dmgThisTurn >= c.enemy.intent.charge.threshold)) {
      setFx("enemy-lunge");
      await wait(260);
    }
    const events = endTurn(run);
    setFx("");
    commit();
    await show(events);
    if (!c.over) { sfx.turn(); }
    busy.current = false;
    commit();
  };

  const flee = () => {
    if (busy.current) return;
    const [dx, dy] = DIRS[run.pos.dir];
    R.flee(run, { x: run.pos.x - dx, y: run.pos.y - dy });
    commit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay.value || run.cardPick) return;
      if (e.key === "e" || e.key === "E" || e.key === " ") { e.preventDefault(); void finishTurn(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) void play(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const def = ENEMIES[c.enemy.id];
  const intent = intentSummary(run, c);
  const incoming = incomingDamage(run, c);
  const net = Math.max(0, incoming - c.block);
  const preview = previewFor(run, c);
  const salve = run.bag.items.find((it) => GOODS[it.id].use?.inCombat);
  const tipId = c.enemy.intent.steal ? "steal" : c.enemy.intent.charge ? "charge" : def.part ? "part" : "combat";
  const tips: Record<string, string> = {
    combat: "敌人头上写着它下回合要做什么。每回合 3 点能量，点牌就能打出。打不过可以先架起格挡。按 E 结束回合。",
    steal: "这只妖要抢货：它这一下只要有伤害打穿你的格挡，就会叼走你行囊里最值钱的货。格挡够了就抢不走。",
    charge: "它在蓄力。这回合内打出够多的伤害（看「蓄」后面的数字）就能打断，下回合的大招就不会来。",
    part: `${def.part?.label ?? ""}很脆：单次伤害到 ${def.part?.threshold ?? 0} 点就会碎，只能卖废铜价。想要完整的，就用多段小伤害收尾。`,
  };

  return (
    <div class={`combat ${fx}`} data-enemy={c.enemy.id}>
      <div class="viewport" ref={ref}>
        <div class={`enemy kind-${c.kind}`}>
          <div class="intent">
            <div class="intent-icons">
              {intent.parts.map((p) => <span class={`ib ${p.cls}`}><i>{p.icon}</i>{p.label && <b>{p.label}</b>}</span>)}
            </div>
            <div class="intent-name">{c.enemy.intent.name}</div>
          </div>
          <img class="enemy-sprite" src={ART[enemyPose(c, def, fx)]} alt={c.enemy.name} draggable={false} style={{ height: `${Math.round(232 * (def.scale ?? 1))}px` }} />
          <div class="enemy-info">
            <div class="enemy-name">{c.enemy.name}</div>
            <Bar value={c.enemy.hp} max={c.enemy.maxHp} kind="enemy" block={c.enemy.block} />
            <Statuses status={c.enemy.status} />
            {def.harvest && <HarvestTag c={c} />}
            {def.part && (
              <div class={`part ${c.enemy.partIntact ? "ok" : "broken"}`}>
                {def.part.label}：{c.enemy.partIntact ? `完好（单次 ≥${def.part.threshold} 伤害会碎）` : "已碎"}
              </div>
            )}
          </div>
        </div>
        <div class="intent-line">{intent.line}</div>
        {banner && <div class="banner" key={banner}>{banner}</div>}
        {slash > 0 && <div class={`slash s${slash % 3}`} key={`slash${slash}`} />}
        {floaters.map((f) => <span class={`floater ${f.kind}`} key={f.id} style={{ left: `${f.x}%`, top: `${f.y}%` }}>{f.text}</span>)}
        {!seenTip(tipId) && (
          <div class="tip combat-tip">
            <p>{tips[tipId]}</p>
            <button type="button" class="btn small" onClick={() => markTip(tipId)}>知道了</button>
          </div>
        )}
      </div>
      <div class="player-panel">
        <div class="energy" title="能量：打牌要消耗">{c.energy}<small>/{c.maxEnergy}</small></div>
        <div class="player-stats">
          <div class={`incoming ${net > 0 ? "danger" : "safe"}`}>
            {c.enemy.intent.stunned || !incoming ? "这回合不会挨打" : net > 0 ? `结束回合会挨 ${net} 点` : `格挡够了（来袭 ${incoming}）`}
          </div>
          <div class="block-line">格挡 <b>{c.block}</b></div>
          <Statuses status={c.status} />
        </div>
        <div class="piles">
          <span title="抽牌堆">抽 {c.draw.length}</span>
          <span title="弃牌堆">弃 {c.discard.length}</span>
          {c.exhaust.length > 0 && <span title="消耗掉的牌">耗 {c.exhaust.length}</span>}
        </div>
      </div>
      <div class="hand">
        {c.hand.map((card, i) => {
          const reason = blockedReason(run, c, card);
          return (
            <div class="hand-slot" style={{ "--i": i, "--n": c.hand.length } as never} key={card.uid}>
              <CardView id={card.id} up={card.up} bonus={card.bonus} preview={preview} disabled={!!reason} reason={reason}
                onClick={() => play(i)} extra={<span class="hotkey">{i + 1}</span>} />
            </div>
          );
        })}
      </div>
      <div class="combat-actions">
        <button type="button" class="btn big primary end-turn" onClick={finishTurn}>结束回合 <kbd>E</kbd></button>
        <div class="row">
          {salve && <button type="button" class="btn small" onClick={() => { const r = useItem(run, salve.uid); if (r) { sfx.coin(); say(r); commit(); } }}>用{GOODS[salve.id].name}</button>}
          {c.kind !== "guardian" && <button type="button" class="btn small ghost" onClick={flee} title="退回上一格。这只妖会恢复，被抢的货找不回来。">撤退</button>}
        </div>
      </div>
    </div>
  );
}

const statusName = (id: string) => ({ str: "力量", weak: "虚弱", vuln: "破绽", thorns: "反震", counter: "回敬", focus: "蓄势", ward: "护货", barricade: "不动", lampArray: "灯阵", swordIntent: "行云", bulwark: "以守为攻" } as Record<string, string>)[id] ?? id;

const HARVEST_STATE = { done: "已达成", open: "能取", risk: "注意", failed: "取不了了" } as const;

function HarvestTag({ c }: { c: CombatState }) {
  const h = ENEMIES[c.enemy.id].harvest!;
  const st = h.state(c);
  return (
    <div class={`harvest ${st}`} title={h.text}>
      <b>取材 · {h.label}</b>
      <span>{h.text}</span>
      <i>{HARVEST_STATE[st]}</i>
    </div>
  );
}

/** Which picture to show: attack pose while lunging, hurt pose when hit, stance pose during a guard stance. */
function enemyPose(c: CombatState, def: (typeof ENEMIES)[string], fx: string): string {
  const base = c.enemy.sprite;
  if (fx === "enemy-lunge") return artId(`${base}-attack`, def.spriteAttack ?? base);
  if (fx === "enemy-hit") return artId(`${base}-hurt`, base);
  if (c.enemy.intent.counter && def.spriteStance) return def.spriteStance;
  return base;
}
