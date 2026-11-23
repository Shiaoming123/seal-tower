import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { ORDERS } from "../data/orders";
import { ACHIEVEMENTS } from "../data/achievements";
import { createRun, orderNeeds, orderRewardText } from "../game/run";
import { MAX_FAVOR, UPGRADES } from "../data/town";
import { seedFromString } from "../game/rng";
import type { WeaponId } from "../game/types";
import { previewFor } from "../game/combat";
import { ART } from "../render/assets";
import { Art, CardView } from "./parts";
import { clearRun, commit, page, profileSig, runSig, savedRun } from "./store";

export function Title() {
  const saved = savedRun();
  const p = profileSig.value;
  return (
    <div class="title-screen">
      <div class="title-bg" style={{ backgroundImage: `url(${artUrl("shop")})` }} />
      <div class="title-hero"><Art id="hero" /></div>
      <div class="title-box">
        <h1 class="logo">斩妖塔</h1>
        <p class="tagline">镇灯铺 · 一个斩妖人的进货生意</p>
        <div class="title-buttons">
          {saved && (
            <button type="button" class="btn big primary" onClick={() => { sfx.click(); runSig.value = saved; page.value = "game"; commit(); }}>
              继续上一趟 <small>第 {saved.floor} 层 · 气血 {saved.hp}</small>
            </button>
          )}
          <button type="button" class={`btn big ${saved ? "" : "primary"}`} onClick={() => { sfx.click(); page.value = "town"; }}>
            {saved ? "放弃上一趟，重新接单" : "去镇灯铺接单"}
          </button>
          <div class="row">
            <button type="button" class="btn" onClick={() => { sfx.click(); page.value = "help"; }}>怎么玩</button>
            <button type="button" class="btn" onClick={() => { sfx.click(); page.value = "achievements"; }}>成就 {p.achievements.length}/{ACHIEVEMENTS.length}</button>
          </div>
        </div>
        <p class="profile-line">声望 {p.renown} · 进塔 {p.runs} 次 · 登顶 {p.wins} 次</p>
      </div>
    </div>
  );
}

export const ABACUS_RENOWN = 4;

const WEAPONS: { id: WeaponId; label: string; note: string; tag: string }[] = [
  { id: "sword", label: "照影剑", tag: "连招", note: "一回合连出几刀，越打越疼。适合喜欢算伤害的人。" },
  { id: "shield", label: "木挡板", tag: "入门", note: "先挡住再反打，最稳的开局。被抢货的机会也少。" },
  { id: "lamp", label: "引灯盘", tag: "烧货", note: "烧掉灯灰换伤害。货越多越强，但烧掉的货就卖不了钱。" },
  { id: "abacus", label: "算盘", tag: "花钱", note: "带 32 石进塔。钱就是格挡、力量和伤害——花出去的每一石都要算。" },
];

export function Town() {
  const [tab, setTab] = useState<"go" | "build">("go");
  const [weapon, setWeapon] = useState<WeaponId>("shield");
  const p = profileSig.value;
  const slots = p.upgrades.counter ? 2 : 1;
  const [orders, setOrders] = useState<string[]>(["lamp"]);
  const [hint, setHint] = useState("lamp");
  const maxDiff = p.renown >= 12 ? 3 : p.renown >= 7 ? 2 : p.renown >= 3 ? 1 : 0;
  const [diff, setDiff] = useState(0);
  const toggleOrder = (id: string) => {
    sfx.click();
    setHint(id);
    setOrders((cur) => cur.includes(id) ? (cur.length > 1 ? cur.filter((o) => o !== id) : cur) : slots === 1 ? [id] : [...cur, id].slice(-slots));
  };
  const start = () => {
    sfx.bell();
    const params = new URLSearchParams(location.search);
    const seed = params.get("seed") ? seedFromString(params.get("seed")!) : (Math.random() * 2 ** 32) >>> 0;
    clearRun();
    runSig.value = createRun(seed, weapon, orders, diff, { favor: p.favor, upgrades: p.upgrades });
    profileSig.value = { ...p, runs: p.runs + 1 };
    page.value = "game";
    commit();
  };
  const gear = GOODS[weapon];
  return (
    <div class="town-screen">
      <div class="town-bg" style={{ backgroundImage: `url(${artUrl("shop-wall")})` }} />
      <header class="town-head">
        <button type="button" class="btn small ghost" onClick={() => (page.value = "title")}>← 返回</button>
        <h2>镇灯铺</h2>
        <div class="town-tabs">
          <button type="button" class={`btn small ${tab === "go" ? "primary" : "ghost"}`} onClick={() => setTab("go")}>接单出发</button>
          <button type="button" class={`btn small ${tab === "build" ? "primary" : "ghost"}`} onClick={() => setTab("build")}>营建铺子</button>
        </div>
        <span class="treasury" title="活着回镇带回来的钱和货，用来营建镇灯铺">库银 {p.treasury} 石</span>
        <p>塔里的妖偷光了镇上的灯油。你是给镇灯铺供货的斩妖人：接单、带兵器进塔、把货活着带回来。带回来的钱存进库银，用来把铺子越做越大。</p>
      </header>
      {tab === "build" ? <Build /> : (
        <>
          <section class="town-orders">
            <h3>① 接委托 <small>{slots === 1 ? "一趟接一张" : `一趟最多接 ${slots} 张`}，在塔里任何狐市都能交</small></h3>
            <div class="order-list">
              {Object.values(ORDERS).map((o) => {
                const level = p.favor[o.id] ?? 0;
                const ord = { id: o.id, level, done: false };
                const needs = orderNeeds(ord);
                return (
                  <button type="button" class={`order-card ${orders.includes(o.id) ? "selected" : ""}`} onClick={() => toggleOrder(o.id)}>
                    <div class="order-top"><Art id={o.portrait} class="portrait" /><div><b>{o.client}</b><span>{o.title}</span></div></div>
                    <p class="favor" title="交情越高，要的货越多、给的报酬越多">交情 {"●".repeat(level)}{"○".repeat(MAX_FAVOR - level)}</p>
                    <p>要：{Object.entries(needs).map(([g, n]) => `${GOODS[g as keyof typeof GOODS].name}×${n}`).join("、")}</p>
                    <p class="order-reward">报酬：{orderRewardText(ord)}</p>
                    {level >= 1 && <p class="order-regular">{o.regular.text}</p>}
                  </button>
                );
              })}
            </div>
            <p class="order-hint-box"><b>{ORDERS[hint].client}：</b>{ORDERS[hint].story} 提示：{ORDERS[hint].hint}</p>
          </section>
          <section class="town-weapons">
            <h3>② 带一件兵器</h3>
            <div class="weapon-list">
              {WEAPONS.map((w) => {
                const locked = w.id === "abacus" && p.renown < ABACUS_RENOWN;
                return (
                <button type="button" class={`weapon-card ${weapon === w.id ? "selected" : ""} ${locked ? "locked" : ""}`} disabled={locked}
                  onClick={() => { sfx.click(); setWeapon(w.id); }} title={locked ? `声望 ${ABACUS_RENOWN} 解锁` : undefined}>
                  <Art id={GOODS[w.id].icon} class="weapon-icon" />
                  <b>{w.label}</b><span class="tag">{w.tag}</span>
                  <p>{locked ? `声望达到 ${ABACUS_RENOWN} 解锁（现在 ${p.renown}）` : w.note}</p>
                </button>
                );
              })}
            </div>
            <div class="weapon-detail">
              <p><b>{gear.name}</b>：{gear.passive} 带在行囊里时，牌组里多出这两张牌：</p>
              <div class="card-row">
                {(gear.cards ?? []).map((id) => <CardView id={id} up={false} small preview={previewFor({ bag: { w: 0, h: 0, items: [] }, gold: 0 } as never, null)} />)}
              </div>
              <p class="muted">另外每个人都会 4 张「{CARDS.strike.name}」和 4 张「{CARDS.defend.name}」。</p>
            </div>
            <div class="town-start">
              {maxDiff > 0 && (
                <label class="diff">难度
                  <select value={diff} onChange={(e) => setDiff(Number((e.target as HTMLSelectElement).value))}>
                    {Array.from({ length: maxDiff + 1 }, (_, i) => <option value={i}>{["寻常", "夜签（妖更凶）", "血签（气血更少）", "死签"][i]}</option>)}
                  </select>
                </label>
              )}
              <button type="button" class="btn big primary" onClick={start}>进塔</button>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

/** 营建: spend the treasury on permanent upgrades. */
function Build() {
  const p = profileSig.value;
  const buy = (id: string, cost: number) => {
    if (p.treasury < cost) return;
    sfx.coin();
    profileSig.value = { ...p, treasury: p.treasury - cost, upgrades: { ...p.upgrades, [id]: (p.upgrades[id] ?? 0) + 1 } };
    commit();
  };
  return (
    <section class="town-build">
      <h3>营建铺子 <small>活着回镇时，身上的石和行囊里的货折成库银。倒在塔里就全丢了——所以楼梯口那句「回镇结算」值得想一想。</small></h3>
      <div class="build-list">
        {UPGRADES.map((u) => {
          const lv = p.upgrades[u.id] ?? 0;
          const next = u.levels[lv];
          return (
            <div class={`build-card ${lv ? "owned" : ""}`}>
              <Art id={u.icon} class="build-icon" />
              <div class="build-body">
                <b>{u.name} <small>{lv ? `${lv} / ${u.levels.length} 级` : "未建"}</small></b>
                {u.levels.map((l, i) => <p class={i < lv ? "done" : i === lv ? "next" : "later"}>{i + 1} 级：{l.text}</p>)}
              </div>
              {next
                ? <button type="button" class="btn small primary" disabled={p.treasury < next.cost} onClick={() => buy(u.id, next.cost)}>营建 · {next.cost} 石</button>
                : <span class="done-tag">已建满</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Help() {
  return (
    <div class="help-screen">
      <div class="help-box">
        <h2>怎么玩</h2>
        <ol>
          <li><b>接单进塔。</b>在镇灯铺选一张委托和一件兵器。塔有三层，每层最深处有一只守关妖，打倒它才能上楼。</li>
          <li><b>走迷宫。</b>第一人称前进、转身（W / A / D 或方向键，或点屏幕下方的按钮）。点右上角小地图上的格子可以自动走过去。路上会遇到妖、狐市、事件、灯台和宝箱，一次只处理一件事。</li>
          <li><b>打牌战斗。</b>每回合 3 点能量、5 张牌。敌人头上会写明它下回合要干什么：打你多少、要不要抢货、是不是在蓄力。蓄力的回合里打够伤害能打断它。</li>
          <li><b>行囊就是你的构筑。</b>兵器放在行囊里，它的牌就进你的牌组；卖掉或丢掉，牌也没了。行囊格子有限，每件东西形状不同，可以旋转。</li>
          <li><b>货怎么用你说了算。</b>妖掉的材料能卖给狐市换石，能交委托拿报酬，有的还能在战斗里烧掉换伤害。灯鼠会抢你最值钱的货，挡住它的攻击就抢不走。</li>
          <li><b>取材。</b>每只妖都有取材条件，写在它名字下面：比如完整挡下纸灯蛾一次攻击再打死它能多拿灯芯，别在书虱缩壳时打死它。想带回什么，决定了怎么打。</li>
          <li><b>灯油。</b>每走一步烧 1 点灯油。灯灭了看不清地图，妖也更凶。狐市卖灯油，灯台能添油，灯灰也能烧来照路。不必每间屋子都进。</li>
          <li><b>行情。</b>每层狐市收价不同，同一种货卖得越多越便宜。道友能告诉你上一层的行情：是现在卖，还是背上去卖，你自己算。</li>
          <li><b>回镇结算。</b>交了委托、打通的层数、拿到的成就会换成声望。完成过的委托人会把你当老主顾；声望高了能解锁「算盘」兵器和更难的签。</li>
        </ol>
        <p class="credits">字体：马善政楷书、霞鹜文楷（均为 SIL OFL 1.1 开源字体，可商用）。界面材质与迷宫贴图由代码生成，音效由代码合成。</p>
        <button type="button" class="btn primary" onClick={() => (page.value = "title")}>知道了</button>
      </div>
    </div>
  );
}

export const artUrl = (id: string) => ART[id];

export function Achievements() {
  const got = new Set(profileSig.value.achievements);
  return (
    <div class="help-screen">
      <div class="help-box">
        <h2>成就 <small>{got.size}/{ACHIEVEMENTS.length}</small></h2>
        <ul class="ach-list">
          {ACHIEVEMENTS.map((a) => (
            <li class={got.has(a.id) ? "got" : ""}><b>{a.name}</b><span>{a.text}</span><i>声望 +{a.renown}</i></li>
          ))}
        </ul>
        <button type="button" class="btn primary" onClick={() => (page.value = "title")}>返回</button>
      </div>
    </div>
  );
}
