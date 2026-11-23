import { useState } from "preact/hooks";
import { sfx } from "../audio/sfx";
import { CARDS } from "../data/cards";
import { GOODS } from "../data/goods";
import { ORDERS } from "../data/orders";
import { createRun } from "../game/run";
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
          <button type="button" class="btn" onClick={() => { sfx.click(); page.value = "help"; }}>怎么玩</button>
        </div>
        <p class="profile-line">声望 {p.renown} · 进塔 {p.runs} 次 · 登顶 {p.wins} 次</p>
      </div>
    </div>
  );
}

const WEAPONS: { id: WeaponId; label: string; note: string; tag: string }[] = [
  { id: "sword", label: "照影剑", tag: "连招", note: "一回合连出几刀，越打越疼。适合喜欢算伤害的人。" },
  { id: "shield", label: "木挡板", tag: "入门", note: "先挡住再反打，最稳的开局。被抢货的机会也少。" },
  { id: "lamp", label: "引灯盘", tag: "烧货", note: "烧掉灯灰换伤害。货越多越强，但烧掉的货就卖不了钱。" },
];

export function Town() {
  const [weapon, setWeapon] = useState<WeaponId>("shield");
  const [order, setOrder] = useState("lamp");
  const p = profileSig.value;
  const maxDiff = p.renown >= 12 ? 3 : p.renown >= 7 ? 2 : p.renown >= 3 ? 1 : 0;
  const [diff, setDiff] = useState(0);
  const start = () => {
    sfx.bell();
    const params = new URLSearchParams(location.search);
    const seed = params.get("seed") ? seedFromString(params.get("seed")!) : (Math.random() * 2 ** 32) >>> 0;
    clearRun();
    runSig.value = createRun(seed, weapon, order, diff);
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
        <h2>镇灯铺 · 接单</h2>
        <p>塔里的妖偷光了镇上的灯油。你是给镇灯铺供货的斩妖人：接一张单，带一件兵器，进塔把货带回来。</p>
      </header>
      <section class="town-orders">
        <h3>① 选一张委托单 <small>委托在塔里任何一处狐市都能交</small></h3>
        <div class="order-list">
          {Object.values(ORDERS).map((o) => (
            <button type="button" class={`order-card ${order === o.id ? "selected" : ""}`} onClick={() => { sfx.click(); setOrder(o.id); }}>
              <div class="order-top"><Art id={o.portrait} class="portrait" /><div><b>{o.client}</b><span>{o.title}</span></div></div>
              <p>{o.story}</p>
              <p class="order-reward">报酬：{o.rewardText} · 声望 +{o.renown}</p>
              {order === o.id && <p class="order-hint">提示：{o.hint}</p>}
            </button>
          ))}
        </div>
      </section>
      <section class="town-weapons">
        <h3>② 带一件兵器</h3>
        <div class="weapon-list">
          {WEAPONS.map((w) => (
            <button type="button" class={`weapon-card ${weapon === w.id ? "selected" : ""}`} onClick={() => { sfx.click(); setWeapon(w.id); }}>
              <Art id={GOODS[w.id].icon} class="weapon-icon" />
              <b>{w.label}</b><span class="tag">{w.tag}</span>
              <p>{w.note}</p>
            </button>
          ))}
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
    </div>
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
          <li><b>回镇结算。</b>交了委托、打通的层数会换成声望。声望高了能解锁更难的签。</li>
        </ol>
        <p class="credits">字体：马善政楷书、霞鹜文楷（均为 SIL OFL 1.1 开源字体，可商用）。界面材质与迷宫贴图由代码生成，音效由代码合成。</p>
        <button type="button" class="btn primary" onClick={() => (page.value = "title")}>知道了</button>
      </div>
    </div>
  );
}

export const artUrl = (id: string) => ART[id];
