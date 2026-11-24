// A simple player used by the balance simulation and smoke tests. It is deliberately average, not optimal.
import { CARDS, cardCost } from "../src/data/cards";
import { blockedReason, endTurn, incomingDamage, playCard } from "../src/game/combat";
import { entityAt, findPath, revealAll } from "../src/game/dungeon";
import { GOODS } from "../src/data/goods";
import { sellItem, useItem } from "../src/game/inventory";
import * as R from "../src/game/run";
import type { RunState } from "../src/game/types";

/** Optional numbers collected while the bot plays (see tests/report.test.ts). */
export interface SimStats {
  /** Keyed `floor:enemyId:kind` (the same monster can be a normal fight on one floor and an elite on another). */
  enemies: Record<string, { n: number; turns: number; hpLost: number; losses: number; kind: string }>;
  floors: Record<number, { reached: number; fightGold: number; saleGold: number; orderGold: number; spentCards: number; spentOil: number; spentOther: number; oilOut: number; hpAtEnd: number; goldAtEnd: number }>;
  offered: Record<string, number>;
  picked: Record<string, number>;
  refines: number;
  cracks: number;
}
export const newStats = (): SimStats => ({
  enemies: {}, offered: {}, picked: {}, refines: 0, cracks: 0,
  floors: Object.fromEntries([1, 2, 3].map((f) => [f, { reached: 0, fightGold: 0, saleGold: 0, orderGold: 0, spentCards: 0, spentOil: 0, spentOther: 0, oilOut: 0, hpAtEnd: 0, goldAtEnd: 0 }])),
});

export function fight(run: RunState, maxTurns = 60, stats?: SimStats) {
  const c = run.combat!;
  const hp0 = run.hp, gold0 = run.gold, id = c.enemy.id, kind = c.kind, floor0 = run.floor;
  const fragile0 = run.bag.items.filter((i) => GOODS[i.id].fragile).length;
  while (!c.over && c.turn < maxTurns) {
    if (run.hp < run.maxHp * 0.35) {
      const salve = run.bag.items.find((i) => i.id === "salve");
      if (salve) useItem(run, salve.uid);
    }
    for (let guard = 0; guard < 20 && !c.over; guard++) {
      const need = Math.max(0, incomingDamage(run, c) - c.block);
      const charging = !!c.enemy.intent.charge;
      let best = -1, bestScore = 0;
      c.hand.forEach((card, i) => {
        if (blockedReason(run, c, card)) return;
        const def = CARDS[card.id];
        let score = 1;
        const v = def.v[card.up ? 1 : 0];
        if (def.type === "power") score = 8;
        else if (def.id === "talisman") score = charging ? 20 : -1;
        else if (def.type === "attack") score = (v.dmg ?? 6) * (charging ? 1.6 : 1) * (need > 0 && !charging ? 0.6 : 1);
        else if (v.blk) score = need > 0 ? Math.min(need, v.blk) * 1.2 + 1 : 1;
        else score = 3;
        score -= cardCost(def, card.up) * 0.5;
        if (score > bestScore) { bestScore = score; best = i; }
      });
      if (best < 0) break;
      playCard(run, best);
    }
    if (!c.over) endTurn(run);
  }
  const fragile1 = run.bag.items.filter((i) => GOODS[i.id].fragile).length;
  const hp1 = Math.max(0, run.hp); // before win heals (獠牙护符) so the loss is what the fight cost
  if (c.over === "win") R.winCombat(run);
  else if (c.over === "fled") R.fledCombat(run);
  else R.loseCombat(run);
  if (stats) {
    const e = (stats.enemies[`${floor0}:${id}:${kind}`] ??= { n: 0, turns: 0, hpLost: 0, losses: 0, kind });
    e.n++; e.turns += c.turn; e.hpLost += Math.max(0, hp0 - hp1); if (c.over !== "win" && c.over !== "fled") e.losses++;
    stats.floors[run.floor].fightGold += run.gold - gold0;
    stats.cracks += fragile0 - fragile1;
    if (run.reward?.note.includes("淬炼")) stats.refines++;
  }
}

/** Sell trade goods the bot doesn't need: keeps what open orders ask for and a few ash for lamp cards. */
function sellSpare(run: RunState, always: readonly string[] = []): number {
  let got = 0;
  const keep: Record<string, number> = {};
  run.orders.forEach((o, i) => { if (!o.done) for (const p of R.orderProgress(run, i).parts) keep[p.id] = Math.max(keep[p.id] ?? 0, p.need); });
  if (run.bag.items.some((i) => i.id === "lamp" || i.id === "lamp-fine")) keep.ash = Math.max(keep.ash ?? 0, 3);
  for (const it of [...run.bag.items]) {
    if (GOODS[it.id].kind !== "goods") continue;
    if (always.includes(it.id)) continue;
    if ((keep[it.id] ?? 0) > 0) { keep[it.id]--; continue; }
    got += sellItem(run, it.uid);
  }
  return got;
}

/** Play a whole run with simple rules. Returns the floor reached and the outcome. */
/** `keep`: goods the bot never sells (experiments that load the bag with tagged goods). */
export function playRun(run: RunState, opts: { elites?: boolean; onFloor?: () => void; stats?: SimStats; sell?: boolean; keep?: readonly string[] } = {}) {
  const st = opts.stats;
  let floorSeen = 0;
  const endFloor = () => { if (st && floorSeen) { st.floors[floorSeen].hpAtEnd += Math.max(0, run.hp); st.floors[floorSeen].goldAtEnd += run.gold; } };
  for (let step = 0; step < 400 && !run.outcome; step++) {
    if (st && run.floor !== floorSeen) { endFloor(); floorSeen = run.floor; st.floors[floorSeen].reached++; }
    if (run.screen === "combat") { fight(run, 60, st); continue; }
    if (run.screen === "reward") {
      const rw = run.reward!;
      if (rw.cards && st) for (const id of rw.cards) st.offered[id] = (st.offered[id] ?? 0) + 1;
      if (rw.cards) {
        // An average player: prefers solid attacks and blocks, skips cards it can't use well.
        const score = (id: string) => {
          const d = CARDS[id], v = d.v[0];
          const raw = (v.dmg ?? 0) * (v.hits ?? 1) + (v.blk ?? 0) + ({ common: 1, uncommon: 3, rare: 5, basic: 0 }[d.rarity]);
          return raw / Math.max(1, cardCost(d, false));
        };
        const pick = [...rw.cards].sort((a, b) => score(b) - score(a))[0];
        if (st) st.picked[pick] = (st.picked[pick] ?? 0) + 1;
        R.takeRewardCard(run, pick);
      }
      if (rw.relic) R.takeRewardRelic(run, rw.relic);
      if (rw.relicChoices) R.takeRewardRelic(run, rw.relicChoices[0]);
      R.closeReward(run);
      continue;
    }
    if (run.screen === "event") {
      const i = R.currentEventOptions(run).findIndex((o) => !o.locked?.(run));
      R.chooseEvent(run, i);
      if (run.cardPick) R.applyCardPick(run, run.deck.find((c) => !c.up && c.id === "strike")?.uid ?? run.deck[0].uid);
      R.closeEvent(run);
      continue;
    }
    if (run.screen === "rest") {
      if (run.oil < 25) R.rest(run, "oil");
      else if (run.hp < run.maxHp * 0.6) R.rest(run, "heal");
      else { R.rest(run, "upgrade"); R.applyCardPick(run, run.deck.find((c) => !c.up && c.id !== "strike" && c.id !== "defend")?.uid ?? run.deck[0].uid); }
      continue;
    }
    if (run.screen === "shop") {
      const f = st?.floors[run.floor];
      let g = run.gold;
      R.deliverOrder(run);
      if (f) f.orderGold += run.gold - g;
      if (opts.sell !== false) { const got = sellSpare(run, opts.keep); if (f) f.saleGold += got; }
      g = run.gold;
      if (run.hp < run.maxHp * 0.5) R.buyItem(run, "consumables", 0);
      if (f) { f.spentOther += g - run.gold; g = run.gold; }
      while (run.oil < 70 && run.gold >= R.oilCost(run) + 10 && !R.buyOil(run)) { /* top up */ }
      if (f) { f.spentOil += g - run.gold; g = run.gold; }
      run.shop!.cards.forEach((_, i) => { if (run.gold > 30) R.buyCard(run, i); });
      if (f) { f.spentCards += g - run.gold; g = run.gold; }
      // A relic when there's comfortably enough left over (cheapest first).
      [...run.shop!.relics.keys()].sort((a, b) => run.shop!.relics[a].price - run.shop!.relics[b].price)
        .forEach((i) => { const r = run.shop!.relics[i]; if (!r.sold && run.gold >= r.price + 25) R.buyRelic(run, i); });
      if (f) f.spentOther += g - run.gold;
      run.at = null;
      run.screen = "explore";
      continue;
    }
    if (run.screen === "result") break;
    for (const it of [...run.bag.items]) if (it.id === "pill" || it.id === "lining" || (it.id === "ash" && run.oil < 8)) useItem(run, it.uid);
    // explore: go to the nearest unfinished entity, guardian last
    revealAll(run.dungeon);
    const targets = run.dungeon.entities.filter((e) => !e.done && e.kind !== "stairs" && (opts.elites !== false || e.kind !== "elite"));
    const stairs = run.dungeon.entities.find((e) => e.kind === "stairs");
    if (stairs) { if (run.floor === 3) break; opts.onFloor?.(); R.climb(run); continue; }
    const others = targets.filter((e) => e.kind !== "guardian");
    const order = (others.length ? others : targets)
      .map((e) => ({ e, p: findPath(run.dungeon, run.pos, e) }))
      .filter((t) => t.p)
      .sort((a, b) => a.p!.length - b.p!.length);
    if (!order.length) break;
    const path = order[0].p!;
    for (const t of path) {
      const oil0 = run.oil;
      if (R.arrive(run, t.x, t.y, 0, true)) break;
      if (st && oil0 > 0 && run.oil === 0) st.floors[run.floor].oilOut++;
      if (entityAt(run.dungeon, t.x, t.y)?.kind === "stairs") break;
    }
  }
  endFloor();
  return { floor: run.floor, outcome: run.outcome ?? "stuck", hp: run.hp };
}
