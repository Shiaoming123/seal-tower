// A simple player used by the balance simulation and smoke tests. It is deliberately average, not optimal.
import { CARDS, cardCost } from "../src/data/cards";
import { EVENTS } from "../src/data/events";
import { blockedReason, endTurn, incomingDamage, playCard } from "../src/game/combat";
import { entityAt, findPath, revealAll } from "../src/game/dungeon";
import { useItem } from "../src/game/inventory";
import * as R from "../src/game/run";
import type { RunState } from "../src/game/types";

export function fight(run: RunState, maxTurns = 60) {
  const c = run.combat!;
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
  if (c.over === "win") R.winCombat(run);
  else R.loseCombat(run);
}

/** Play a whole run with simple rules. Returns the floor reached and the outcome. */
export function playRun(run: RunState, opts: { elites?: boolean } = {}) {
  for (let step = 0; step < 400 && !run.outcome; step++) {
    if (run.screen === "combat") { fight(run); continue; }
    if (run.screen === "reward") {
      const rw = run.reward!;
      if (rw.cards) R.takeRewardCard(run, rw.cards[0]);
      if (rw.relic) R.takeRewardRelic(run, rw.relic);
      if (rw.relicChoices) R.takeRewardRelic(run, rw.relicChoices[0]);
      R.closeReward(run);
      continue;
    }
    if (run.screen === "event") {
      const ev = EVENTS[run.event!.id];
      const i = ev.options.findIndex((o) => !o.locked?.(run));
      R.chooseEvent(run, i);
      if (run.cardPick) R.applyCardPick(run, run.deck.find((c) => !c.up && c.id === "strike")?.uid ?? run.deck[0].uid);
      R.closeEvent(run);
      continue;
    }
    if (run.screen === "rest") {
      if (run.hp < run.maxHp * 0.6) R.rest(run, "heal");
      else { R.rest(run, "upgrade"); R.applyCardPick(run, run.deck.find((c) => !c.up && c.id !== "strike" && c.id !== "defend")?.uid ?? run.deck[0].uid); }
      continue;
    }
    if (run.screen === "shop") {
      R.deliverOrder(run);
      if (run.hp < run.maxHp * 0.5) R.buyItem(run, "consumables", 0);
      run.shop!.cards.forEach((_, i) => { if (run.gold > 30) R.buyCard(run, i); });
      run.at = null;
      run.screen = "explore";
      continue;
    }
    if (run.screen === "result") break;
    for (const it of [...run.bag.items]) if (it.id === "pill" || it.id === "lining") useItem(run, it.uid);
    // explore: go to the nearest unfinished entity, guardian last
    revealAll(run.dungeon);
    const targets = run.dungeon.entities.filter((e) => !e.done && e.kind !== "stairs" && (opts.elites !== false || e.kind !== "elite"));
    const stairs = run.dungeon.entities.find((e) => e.kind === "stairs");
    if (stairs) { if (run.floor === 3) break; R.climb(run); continue; }
    const others = targets.filter((e) => e.kind !== "guardian");
    const order = (others.length ? others : targets)
      .map((e) => ({ e, p: findPath(run.dungeon, run.pos, e) }))
      .filter((t) => t.p)
      .sort((a, b) => a.p!.length - b.p!.length);
    if (!order.length) break;
    const path = order[0].p!;
    for (const t of path) {
      if (R.arrive(run, t.x, t.y, 0, true)) break;
      if (entityAt(run.dungeon, t.x, t.y)?.kind === "stairs") break;
    }
  }
  return { floor: run.floor, outcome: run.outcome ?? "stuck", hp: run.hp };
}
