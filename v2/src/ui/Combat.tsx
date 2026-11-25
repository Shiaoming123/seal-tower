import { useEffect, useRef, useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { setIntensity } from "../audio/music";
import { creatureCall } from "../audio/voices";
import { CARDS } from "../data/cards";
import { ENEMIES } from "../data/enemies";
import { GOODS } from "../data/goods";
import { type CombatEvent, type PlayPreview, RAMP_TURN, blockedReason, endTurn, enemyHitDamage, incomingDamage, playCard, previewFor, simulatePlay, stealTarget } from "../game/combat";
import { DIRS, isWall } from "../game/dungeon";
import { useItem } from "../game/inventory";
import * as R from "../game/run";
import type { CombatState, RunState, StatusId } from "../game/types";
import { ART, artId, image } from "../render/assets";
import { VIEW_H, VIEW_W } from "../render/raycaster";
import { fx as fxLayer } from "../render/fx";
import { enemyStage, useView, view } from "./Explore";
import { PILE_LABELS } from "./Deck";
import { Bar, CardView, ConceptTip, STATUS_INFO, Statuses, Term } from "./parts";
import { commit, forgetFight, markTip, overlay, rememberFight, runSig, say, seenTip, useRun } from "./store";

interface Floater { id: number; text: string; kind: string; x: number; y: number }
let floaterId = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function intentSummary(run: RunState, c: CombatState) {
  const i = c.enemy.intent;
  const parts: { icon: string; label: string; cls: string }[] = [];
  if (i.stunned) parts.push({ icon: "晕", label: "", cls: "stun" });
  if (i.flee) parts.push({ icon: "逃", label: "", cls: "steal" });
  // Once the threshold is met, say so at once (REVIEW-002): 打断 itself only shows when the turn ends.
  if (i.charge) parts.push(c.dmgThisTurn >= i.charge.threshold
    ? { icon: "断", label: "够了", cls: "charge broken" }
    : { icon: "蓄", label: `${c.dmgThisTurn}/${i.charge.threshold}`, cls: "charge" });
  if (i.dmg && !i.stunned) parts.push({ icon: "攻", label: `${enemyHitDamage(run, c)}${(i.hits ?? 1) > 1 ? `×${i.hits}` : ""}`, cls: "atk" });
  if (i.steal) parts.push({ icon: "抢", label: "", cls: "steal" });
  if (i.drainOil) parts.push({ icon: "油", label: `-${i.drainOil}`, cls: "steal" });
  if (i.eatAsh) parts.push({ icon: "灰", label: `-${i.eatAsh}`, cls: "steal" });
  if (i.stealGold) parts.push({ icon: "钱", label: `-${i.stealGold}`, cls: "steal" });
  if (i.counter) parts.push({ icon: "反", label: `${i.counter}`, cls: "def" });
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
  if (def.weakTo === "fire") line += " 怕火：带「火」字的牌伤害翻倍。";
  if (c.enemy.status.thorns) line += ` 你每打它一下，自己挨 ${c.enemy.status.thorns + (i.counter ?? 0)} 点。`;
  if (def.dmgMod && def.dmgMod(run.oil)) line += def.dmgMod(run.oil) > 0 ? ` 灯油不足 30，它每下多打 ${def.dmgMod(run.oil)}。` : ` 灯油充足，它每下少打 ${-def.dmgMod(run.oil)}。`;
  if (i.steal) {
    const t = stealTarget(run);
    const how = ENEMIES[c.enemy.id].stealFlees ? "叼走" : "抢走并毁掉";
    line += c.status.ward ? " 你已经护住了货。" : t ? ` 只要有伤害打穿格挡，就会${how}「${GOODS[t].name}」。` : " 你的行囊里没有能抢的货。";
  }
  if (i.charge) {
    const next = ENEMIES[c.enemy.id].moves[i.charge.then];
    line += c.dmgThisTurn >= i.charge.threshold
      ? ` 这回合的伤害已经够了：结束回合时它会被打断，「${next.name}」不会来。`
      : ` 不打断的话，下回合放「${next.name}」${next.dmg ? `（${next.dmg + c.enemy.dmgAdd + (c.enemy.status.str ?? 0)} 伤害）` : ""}。`;
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
  // Phones: the fanned hand overlaps too much to read, so the first tap picks a card (lifted, enlarged, on top)
  // and a second tap on it plays it. Desktop mouse keeps one-click play.
  const [picked, setPicked] = useState<number | null>(null);
  /** Card under the mouse (desktop); on phones the picked card is previewed instead. */
  const [hovered, setHovered] = useState<number | null>(null);
  const twoStep = () => !!rootRef.current?.closest(".stage.portrait") || matchMedia("(hover: none)").matches;
  // The fight happens in the scene: the monster keeps standing on its tile, one step ahead of you.
  const foe = R.currentEntity(run);
  useView(ref, run, { combatEntity: foe?.id, dim: 0.08 });
  const enemyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const anchorPt = useRef({ x: 50, y: 34 });
  const anchorPx = useRef({ x: 0, y: 0 });
  // Remember the fight as it began, for 「重新开战」 (the snapshot includes the rng, so the same hand comes up).
  useEffect(() => {
    rememberFight(runSig.value!);
    return () => {
      forgetFight();
      if (PILE_LABELS.some(([id]) => overlay.value === id)) overlay.value = null;
    };
  }, []);
  useEffect(() => {
    // Pull the camera back and tilt it down so the whole monster stands on the floor above your hand.
    const r0 = runSig.value!;
    const e0 = R.currentEntity(r0);
    let { x, y, dir } = r0.pos;
    // An event can turn into an enemy on the player's tile. Frame it from an open
    // adjacent tile without moving the player or the encounter in the run.
    if (e0 && e0.x === x && e0.y === y) {
      const facing = [dir, (dir + 1) % 4, (dir + 3) % 4, (dir + 2) % 4].find((candidate) => {
        const [dx, dy] = DIRS[candidate];
        return !isWall(r0.dungeon, x - dx, y - dy);
      });
      if (facing !== undefined) {
        const [dx, dy] = DIRS[facing];
        x -= dx;
        y -= dy;
        dir = facing;
      }
    }
    view.place(x, y, dir);
    // Step back for big monsters when there is floor behind the camera.
    const [backX, backY] = DIRS[(dir + 2) % 4];
    const roomBehind = !isWall(r0.dungeon, x + backX, y + backY);
    const big = e0?.enemy ? enemyStage(e0).scale > 0.72 : false;
    view.setDolly(roomBehind ? (big ? 1.05 : 0.7) : 0.45, -36);
    const anchor = () => {
      const el = enemyRef.current, vp = ref.current, e = R.currentEntity(runSig.value!);
      if (!el || !vp || !e || !e.enemy) return;
      const st = enemyStage(e);
      const img = image(runSig.value!.combat?.enemy.sprite ?? ENEMIES[e.enemy].sprite);
      const aspect = img?.naturalWidth ? img.naturalWidth / img.naturalHeight : 1;
      const p = view.project(e.x, e.y, st.scale, aspect, st.lift);
      const vw = vp.clientWidth, vh = vp.clientHeight;
      const k = Math.max(vw / VIEW_W, vh / VIEW_H);
      const ox = (vw - VIEW_W * k) / 2, oy = (vh - VIEW_H * k) / 2;
      const head = headRef.current;
      const indicatorHeight = head?.offsetHeight ?? 0;
      const center = ox + p.cx * k;
      const foot = oy + p.floorY * k;
      // Keep the projected foot point and make room for the indicator and the
      // whole silhouette when a large projection would overlap or get cropped.
      const h = Math.max(0, Math.min(p.h * k, foot - indicatorHeight - 14, (vw - 24) / aspect));
      const w = h * aspect, left = center - w / 2, top = foot - h;
      el.style.left = `${left}px`; el.style.top = `${top}px`; el.style.width = `${w}px`; el.style.height = `${h}px`;
      el.style.setProperty("--lit", p.light.toFixed(2));
      el.style.visibility = p.visible ? "visible" : "hidden";
      anchorPt.current = { x: ((left + w / 2) / vw) * 100, y: ((top + h * 0.38) / vh) * 100 };
      if (head) {
        head.style.left = `${center}px`;
        head.style.top = `${Math.max(6, top - indicatorHeight - 4)}px`;
      }
      anchorPx.current = { x: left + w / 2, y: top + h * 0.45 };
      vp.style.setProperty("--ex", `${left + w / 2}px`);
      vp.style.setProperty("--ey", `${top + h * 0.45}px`);
    };
    view.onFrame = anchor;
    anchor();
    // Encounter: a flash and the monster's name, like stepping into a fight.
    fxLayer.pulse("255,240,210", 0.45);
    const name = runSig.value!.combat?.enemy.name;
    if (name) setBanner(`遭遇 · ${name}`);
    // The monster announces itself, then you draw your opening hand.
    const c0 = runSig.value!.combat;
    if (c0) { creatureCall(c0.enemy.id, 0, 1.2); setTimeout(() => sfx.draw(c0.hand.length), 450); }
    const ro = new ResizeObserver(anchor);
    if (ref.current) ro.observe(ref.current);
    return () => { view.onFrame = null; view.setDolly(0, 0); ro.disconnect(); setIntensity(0); };
  }, []);

  const float = (text: string, kind: string, target: "enemy" | "player") => {
    const a = anchorPt.current;
    const f = { id: ++floaterId, text, kind, x: target === "enemy" ? a.x + (Math.random() * 12 - 6) : 22 + Math.random() * 8, y: target === "enemy" ? a.y + Math.random() * 6 : 70 };
    setFloaters((fs) => [...fs.slice(-8), f]);
    setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== f.id)), 1100);
  };
  const flash = async (cls: string, ms = 260) => { setFx(cls); await wait(ms); setFx(""); };

  const show = async (events: CombatEvent[]) => {
    for (const e of events) {
      if (e.t === "hit") {
        if (e.target === "enemy") {
          if (e.amount > 0) {
            const heavy = e.amount >= 12;
            heavy ? sfx.heavy() : sfx.hit();
            float(`-${e.amount}`, heavy ? "dmg crit" : "dmg", "enemy");
            setSlash((n) => n + 1);
            fxLayer.burst(anchorPx.current.x, anchorPx.current.y, { power: heavy ? 1.6 : 1, n: heavy ? 26 : 14 });
            // Hit-stop: a heavy blow freezes the moment for a beat.
            if (heavy) { setFx("enemy-hit hitstop"); fxLayer.pulse("255,255,255", 0.25); await wait(90); }
          }
          if (e.blocked) { sfx.block(); float(`挡 ${e.blocked}`, "blocked", "enemy"); }
          if (e.part === "broke") { float(`${ENEMIES[c.enemy.id].part!.label}碎了`, "warn", "enemy"); }
          void flash(e.amount > 0 ? "enemy-hit" : "enemy-hit guarded", 200);
        } else {
          if (e.amount > 0) { sfx.hurt(); float(`-${e.amount}`, "hurt", "player"); fxLayer.pulse("200,30,20", Math.min(0.45, 0.15 + e.amount / 40)); void flash("player-hit", 300); }
          // A whole attack stopped is worth a moment of its own.
          if (e.blocked && !e.amount) { sfx.parry(); float("全挡住！", "parry", "player"); fxLayer.pulse("120,190,255", 0.22); }
          else if (e.blocked) { sfx.block(); float(`挡住 ${e.blocked}`, "blocked", "player"); }
        }
        await wait(170);
      } else if (e.t === "block") { if (e.target === "player") { sfx.guard(); float(`+${e.amount} 格挡`, "block", "player"); } else float(`+${e.amount} 格挡`, "block", "enemy"); }
      else if (e.t === "status" && e.id === "burn" && e.n < 0) { sfx.burn(); }
      else if (e.t === "status") float(`${e.n > 0 ? "" : ""}${statusName(e.id)} ${e.n}`, e.target === "enemy" ? "status" : "status-self", e.target);
      else if (e.t === "steal") {
        if (e.saved) { float("货护住了", "block", "player"); }
        else if (e.good) { sfx.steal(); setBanner(`${c.enemy.name}抢走了「${GOODS[e.good].name}」！`); float(`被抢：${GOODS[e.good].name}`, "warn", "player"); await wait(400); }
      }
      else if (e.t === "interrupt") { sfx.interrupt(); setBanner(`打断了！${c.enemy.name}的蓄力落空。`); float("打断", "warn", "enemy"); await wait(300); }
      else if (e.t === "phase") { sfx.gong(); setBanner(e.text); await wait(700); }
      else if (e.t === "heal") { if (e.amount) float(`+${e.amount}`, "heal", "player"); }
      else if (e.t === "crack") { sfx.crack(); float(`${GOODS[e.good].name}磕坏了`, "warn", "player"); }
      else if (e.t === "goods") float(`${e.gained ? "+" : "烧掉 "}${GOODS[e.good].name}`, e.gained ? "heal" : "status", "player");
      else if (e.t === "thorns") { if (e.target === "player") float(`被扎 ${e.amount}`, "hurt", "player"); else float(`回敬 ${e.amount}`, "status-self", "enemy"); }
      else if (e.t === "drain") { sfx.drain(); float(e.what === "oil" ? `灯油 -${e.amount}` : e.what === "ash" ? `被吃掉 ${e.amount} 份灯灰` : `被收走 ${e.amount} 石`, "warn", "player"); }
      else if (e.t === "enemy-move") { setBanner(`${c.enemy.name}：${e.name}`); }
      else if (e.t === "proc") { sfx.harvest(); float(e.text, "proc", "player"); await wait(250); }
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
    if (!card) return;
    const reason = blockedReason(run, c, card);
    if (reason) { say(reason); return; }
    busy.current = true;
    setBanner(""); // the encounter / last-move banner sits where the damage numbers land
    const def = CARDS[card.id];
    sfx.card();
    if (def.type === "power") sfx.power(); else if (def.type === "skill") sfx.turn();
    flyCard(i);
    const attacks0 = c.attacksThisTurn;
    const weak = !!ENEMIES[c.enemy.id].weakTo && !!def.tags?.some((t) => t === ENEMIES[c.enemy.id].weakTo);
    const res = playCard(run, i);
    commit();
    // Chains: the 2nd, 3rd… attack in a turn gets a climbing note and a 「连击」 floater; hitting a weakness says so.
    if (def.type === "attack" && c.attacksThisTurn > attacks0 && c.attacksThisTurn >= 2) { sfx.combo(c.attacksThisTurn); float(`连击 ×${c.attacksThisTurn}`, "combo", "enemy"); }
    if (weak && res.events.some((e) => e.t === "hit" && e.target === "enemy" && e.amount > 0)) float("怕火！", "warn", "enemy");
    await show(res.events);
    busy.current = false;
    commit();
  };

  /** The played card flies from your hand to the monster and fades out. */
  const flyCard = (i: number) => {
    const root = rootRef.current;
    const el = root?.querySelectorAll(".hand .card")[i] as HTMLElement | undefined;
    if (!root || !el) return;
    const rr = root.getBoundingClientRect(), r = el.getBoundingClientRect();
    const k = root.offsetWidth / rr.width;
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.classList.add("card-ghost");
    Object.assign(ghost.style, { left: `${(r.left - rr.left) * k}px`, top: `${(r.top - rr.top) * k}px`, width: `${r.width * k}px`, height: `${r.height * k}px` });
    root.appendChild(ghost);
    const dx = anchorPx.current.x - ((r.left - rr.left) * k + (r.width * k) / 2);
    const dy = anchorPx.current.y + 60 - ((r.top - rr.top) * k + (r.height * k) / 2);
    const anim = ghost.animate([
      { transform: "translate(0,0) scale(1) rotate(0deg)", opacity: 1 },
      { transform: `translate(${dx * 0.6}px, ${dy * 0.6 - 40}px) scale(0.7) rotate(-6deg)`, opacity: 0.95, offset: 0.6 },
      { transform: `translate(${dx}px, ${dy}px) scale(0.25) rotate(8deg)`, opacity: 0 },
    ], { duration: 320, easing: "cubic-bezier(.3,.7,.4,1)" });
    anim.onfinish = () => ghost.remove();
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
    if (!c.over) { sfx.turn(); sfx.draw(c.hand.length); }
    busy.current = false;
    commit();
  };

  const flee = () => {
    if (busy.current) return;
    const spot = R.fleeSpot(run);
    if (!spot) return;
    R.flee(run, spot);
    commit();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (overlay.value || run.cardPick) return;
      // Only E ends the turn: Space is too easy to hit by accident (REVIEW-001).
      if (e.key === "e" || e.key === "E") { e.preventDefault(); void finishTurn(); }
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 9) void play(n - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Battle music gets busier as the fight comes down to the wire.
  const tension = c.over ? 0
    : c.enemy.phase === 2 || c.enemy.hp <= c.enemy.maxHp * 0.3 || run.hp <= run.maxHp * 0.3 ? 2
    : c.enemy.hp <= c.enemy.maxHp * 0.6 || run.hp <= run.maxHp * 0.55 || c.turn >= 6 ? 1 : 0;
  useEffect(() => { setIntensity(tension); }, [tension]);

  const def = ENEMIES[c.enemy.id];
  const intent = intentSummary(run, c);
  const incoming = incomingDamage(run, c);
  const net = Math.max(0, incoming - c.block);
  const preview = previewFor(run, c);
  const salve = run.bag.items.find((it) => GOODS[it.id].use?.inCombat);
  // Same rule as twoStep(): phones pick a card first, then play it.
  const phoneHand = !!document.querySelector(".stage.portrait") || matchMedia("(hover: none)").matches;
  const previewIdx = picked !== null ? c.hand.findIndex((h) => h.uid === picked) : hovered !== null ? c.hand.findIndex((h) => h.uid === hovered) : -1;
  const pv = previewIdx >= 0 && !busy.current ? simulatePlay(run, previewIdx) : null;
  const tipId = c.enemy.intent.steal ? "steal" : c.enemy.intent.charge ? "charge" : def.part ? "part" : "combat";
  // A fight that opened with a 知道了 tip doesn't also queue a 新概念 tip (TIP-PACE): one explanation per fight.
  const hadTip = useRef(false);
  if (!seenTip(tipId)) hadTip.current = true;
  const tips: Record<string, string> = {
    combat: phoneHand
      ? "敌人头上写着它下回合要做什么。每回合 3 点能量。点一张牌会放大，再点一次才打出。打不过可以先架起格挡，最后点「结束回合」。"
      : "敌人头上写着它下回合要做什么。每回合 3 点能量，点牌就能打出。打不过可以先架起格挡。按 E 结束回合。",
    steal: "这只妖要抢货：它这一下只要有伤害打穿你的格挡，就会叼走你行囊里最值钱的货。格挡够了就抢不走。",
    charge: "它在蓄力。这回合内打出够多的伤害（看「蓄」后面的数字）就能打断，下回合的大招就不会来。",
    part: `${def.part?.label ?? ""}很脆：单次伤害到 ${def.part?.threshold ?? 0} 点就会碎，只能卖废铜价。想要完整的，就用多段小伤害收尾。`,
  };

  return (
    <div class={`combat combat-enter ${fx}`} data-enemy={c.enemy.id} ref={rootRef}
      onPointerDown={(e) => { if (picked !== null && !(e.target as HTMLElement).closest(".hand")) setPicked(null); }}>
      <div class="viewport" ref={ref}>
        <div class={`enemy kind-${c.kind} ${foe && enemyStage(foe).lift ? "flyer" : ""}`} ref={enemyRef} style={{ visibility: "hidden" }}>
          <img class="enemy-sprite" src={ART[enemyPose(c, def, fx)]} alt={c.enemy.name} draggable={false} />
        </div>
        <div class="enemy-head" ref={headRef}>
          <div class="intent">
            <div class="intent-icons">
              {intent.parts.map((p) => <span class={`ib ${p.cls}`}><i>{p.icon}</i>{p.label && <b>{p.label}</b>}</span>)}
            </div>
            <div class="intent-name">{c.enemy.intent.name}</div>
          </div>
          <div class="enemy-info">
            <div class="enemy-name">{c.enemy.name}</div>
            <Bar value={c.enemy.hp} max={c.enemy.maxHp} kind="enemy" block={c.enemy.block} lose={pv?.dmg ?? 0} />
            {pv && <PreviewTag pv={pv} part={def.part?.label} />}
            <Statuses status={c.enemy.status} />
            {def.harvest && <HarvestTag c={c} />}
            {def.part && (
              <div class={`part ${c.enemy.partIntact ? "ok" : "broken"}`}>
                {def.part.label}：{c.enemy.partIntact ? `完好（单次 ≥${def.part.threshold} 伤害会碎）` : "已碎"}
              </div>
            )}
          </div>
            <div class="intent-line">{intent.line}</div>
            {/* 妖气渐盛 used to arrive unannounced on turn 8 (REVIEW-001): warn two turns ahead. */}
            {c.turn >= RAMP_TURN - 2 && !c.over && (
              <div class="ramp-line"><Term id="ramp" />{c.turn < RAMP_TURN ? `：再过 ${RAMP_TURN - c.turn} 回合，妖每回合力量 +2` : "：妖每回合力量 +2"}</div>
            )}
        </div>
        {banner && <div class="banner" key={banner}>{banner}</div>}
        {slash > 0 && <div class={`slash s${slash % 3}`} key={`slash${slash}`} />}
        {floaters.map((f) => <span class={`floater ${f.kind}`} key={f.id} style={{ left: `${f.x}%`, top: `${f.y}%` }}>{f.text}</span>)}
        {seenTip(tipId) && !hadTip.current && <ConceptTip ids={["intent", "block", ...(def.harvest ? ["harvest" as const] : []), ...(c.kind === "elite" ? ["elite" as const] : []), ...(c.kind === "guardian" ? ["guardian" as const] : []), ...(c.turn >= RAMP_TURN - 2 ? ["ramp" as const] : [])]} float />}
        {!seenTip(tipId) && (
          <div class="tip combat-tip">
            <p>{tips[tipId]}</p>
            <button type="button" class="btn small" onClick={() => { markTip(tipId); if (tipId === "combat") markTip("term:intent"); }}>知道了</button>
          </div>
        )}
      </div>
      <div class="player-panel">
        <div class="energy" title="能量：打牌要消耗">{c.energy}<small>/{c.maxEnergy}</small></div>
        <div class="player-stats">
          <div class={`incoming ${net > 0 ? "danger" : "safe"}`}>
            {c.enemy.intent.stunned || !incoming ? "这回合不会挨打" : net > 0 ? `结束回合会挨 ${net} 点` : `格挡够了（来袭 ${incoming}）`}
            {pv && pv.block > 0 && <span class="pv-block">+{pv.block} 格挡{incoming && !c.enemy.intent.stunned ? ` → ${Math.max(0, incoming - c.block - pv.block) ? `还会挨 ${Math.max(0, incoming - c.block - pv.block)}` : "全挡住"}` : ""}</span>}
          </div>
          <div class="block-line">格挡 <b>{c.block}</b></div>
          <Statuses status={c.status} />
        </div>
        <div class="piles">
          {PILE_LABELS.map(([pile, name]) => (
            <button type="button" class="btn small" data-combat-pile={pile} aria-haspopup="dialog"
              onClick={() => { sfx.click(); overlay.value = pile; }}>
              {name} <b>{c[pile].length}</b>
            </button>
          ))}
        </div>
      </div>
      <div class="hand">
        {c.hand.map((card, i) => {
          const reason = blockedReason(run, c, card);
          return (
            <div class={`hand-slot ${picked === card.uid ? "picked" : ""}`} style={{ "--i": i, "--n": c.hand.length } as never} key={card.uid}
              onPointerEnter={(e) => { if (e.pointerType === "mouse") setHovered(card.uid); }}
              onPointerLeave={() => setHovered((h) => (h === card.uid ? null : h))}>
              <CardView id={card.id} up={card.up} bonus={card.bonus} preview={preview} disabled={!!reason} reason={reason}
                onClick={() => {
                  if (twoStep() && picked !== card.uid) { sfx.click(); setPicked(card.uid); return; }
                  setPicked(null); play(i);
                }} extra={<span class="hotkey">{i + 1}</span>} />
            </div>
          );
        })}
      </div>
      <div class="combat-actions">
        <button type="button" class="btn big primary end-turn" onClick={finishTurn}>结束回合 <kbd>E</kbd></button>
        <div class="row">
          {salve && <button type="button" class="btn small" onClick={() => { const r = useItem(run, salve.uid); if (r) { sfx.coin(); say(r); commit(); } }}>用{GOODS[salve.id].name}</button>}
          {c.kind !== "guardian" && (R.fleeSpot(run)
            ? <button type="button" class="btn small ghost" onClick={flee} title="退回旁边一格。这只妖会恢复，被抢的货找不回来。">撤退</button>
            : <button type="button" class="btn small ghost" disabled title="四周都是墙或别的东西，没处可退。">无路可退</button>)}
        </div>
      </div>
    </div>
  );
}

/** What the card under the cursor (or the picked one) would do, over the monster's HP bar. */
function PreviewTag({ pv, part }: { pv: PlayPreview; part?: string }) {
  const chips: [string, string][] = [];
  if (pv.hits > 1) chips.push(["", `${pv.hits} 段`]);
  if (pv.weakness) chips.push(["fire", "怕火 · 伤害翻倍"]);
  if (pv.absorbed > 0) chips.push(["muted", `格挡吃掉 ${pv.absorbed}`]);
  if (pv.interrupts) chips.push(["good", "打断蓄力"]);
  if (pv.breaksPart) chips.push(["warn", `会打碎${part ?? "部件"}`]);
  for (const s of pv.enemyStatus) chips.push(["status", `${statusName(s.id)} ${s.n > 0 ? "+" : ""}${s.n}`]);
  if (pv.heal > 0) chips.push(["good", `回复 ${pv.heal}`]);
  if (!pv.dmg && !chips.length) return null;
  return (
    <div class={`play-preview ${pv.kills ? "lethal" : ""}`}>
      {pv.dmg > 0 && <b class="pv-dmg">-{pv.dmg}</b>}
      {pv.kills && <i class="pv-kill">致命</i>}
      {chips.map(([cls, t]) => <span class={`pv-chip ${cls}`}>{t}</span>)}
    </div>
  );
}

const statusName = (id: string) => STATUS_INFO[id as StatusId]?.name ?? id;

const HARVEST_STATE = { done: "已达成", open: "能取", risk: "注意", failed: "取不了了" } as const;

function HarvestTag({ c }: { c: CombatState }) {
  const h = ENEMIES[c.enemy.id].harvest!;
  const st = h.state(c);
  return (
    <div class={`harvest ${st}`} title={h.text}>
      <b><Term id="harvest" /> · {h.label}</b>
      <span>{h.text}</span>
      <i>{HARVEST_STATE[st]}</i>
    </div>
  );
}

/** Which picture to show: attack pose while lunging, hurt pose when hit, stance pose during a guard stance. */
function enemyPose(c: CombatState, def: (typeof ENEMIES)[string], fx: string): string {
  const base = c.enemy.sprite;
  if (fx === "enemy-lunge") return artId(`${base}-attack`, def.spriteAttack ?? base);
  if (fx === "enemy-hit" || fx === "enemy-hit hitstop") return artId(`${base}-hurt`, base);
  if (c.enemy.intent.counter && def.spriteStance) return def.spriteStance;
  return base;
}
