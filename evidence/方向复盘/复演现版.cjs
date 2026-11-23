"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");

const bundle = process.argv[2] || path.join(__dirname, "../一印两价/一印两价.html");
const html = fs.readFileSync(bundle, "utf8");
const sha = crypto.createHash("sha256").update(html).digest("hex");
assert.equal(sha, "d5fe59f59696a5546d5b69187c4c392644b83fbbcb602c8edfc52a6444e8b001", "请提供本次研究的正式包");
const start = html.indexOf("/* 斩妖塔 · 同一塔签与动作序列总是得出同一结果。 */");
const endMarker = "\n})();";
const end = html.indexOf(endMarker, start);
assert(start >= 0 && end > start);
const context = {module: {exports: {}}};
vm.runInNewContext(html.slice(start, end + endMarker.length), context);
const tower = context.module.exports;

function act(state, id) {
  const next = tower.act(state, id);
  assert.notEqual(next, state, "此步不可操作 " + (id.id || id) + " " + state.phase);
  return next;
}
function run(state, actions) {
  return actions.reduce(act, state);
}
function trade(state, id, qty = 1, instanceId) {
  const quote = tower.quoteTrade(state, {id, qty, instanceId});
  assert(quote && !quote.disabled, "报价不可用 " + id);
  return act(state, quote);
}
function firstStall(initial, choice) {
  return run(initial, ["sword", "strike", "strike", "take-ash", "guide", choice]);
}
function fresh(choice) {
  return firstStall(tower.start(1, {marketTrial: true}), choice);
}
function escort(state, id) {
  const op = tower.escortView(state).options.find(option => option.id === id);
  assert(op && !op.disabled, "押运动作不可用 " + id);
  const next = tower.escortAct(state, op);
  assert.notEqual(next, state);
  return next;
}
function driveToStop(state) {
  while (tower.escortView(state).stage === "road") {
    state = escort(state, tower.escortView(state).cue);
  }
  return state;
}
function visitMarkets(state) {
  const choices = ["branch-ash", "branch-shell", "branch-sale"];
  const trades = [["buy-ash", "buy-ash"], ["sell-ash", "sell-ash"], ["sell-shell"]];
  state = escort(state, "start");
  for (let leg = 0; leg < 3; leg++) {
    state = driveToStop(state);
    state = escort(state, "visit-branch");
    state = driveToStop(state);
    state = escort(state, choices[leg]);
    for (const item of trades[leg]) state = escort(state, item);
    state = escort(state, "continue");
  }
  state = driveToStop(state);
  state = escort(state, "deliver");
  return escort(state, "return");
}
function sealRoute(choice) {
  let state = fresh(choice);
  state = visitMarkets(state);
  const afterHaul = state.gold;
  state = trade(trade(state, "barter-abacus"), "buy-silk", 2);
  const gateGold = state.gold;
  state = run(state, ["gate", "focus-strike", "strike", "strike"]);
  assert.equal(state.phase, "shop");
  if (choice === "keep") state = act(state, "sell-1");
  state = trade(state, "vend-fox-clasp");
  state = trade(state, "vend-silk", 2);
  state = act(state, "settle");
  assert.equal(state.phase, "won");
  assert.deepEqual(Array.from(tower.view(state).profile.bag.items), []);
  return {choice, afterHaul, gateGold, turns: state.trial.gateTurns, hp: state.hp, finalGold: state.gold};
}

function battleOutcomes() {
  const found = new Map();
  function tryMoves(state, sequence) {
    if (state.phase === "shop") {
      const sale = trade(state, "vend-fox-clasp");
      const record = {turns: sequence.length, hp: sale.hp, gold: sale.gold, sequence};
      const signature = [record.turns, record.hp, record.gold].join("/");
      if (!found.has(signature)) found.set(signature, record);
      return;
    }
    if (state.phase !== "fight" || sequence.length >= 7) return;
    for (const move of ["strike", "focus-strike", "guard"]) {
      if (move === "focus-strike" && state.focusSpent) continue;
      const next = tower.act(state, move);
      if (next !== state) tryMoves(next, [...sequence, move]);
    }
  }
  tryMoves(act(fresh("sell-1"), "gate"), []);
  const all = [...found.values()];
  return all.filter(a => !all.some(b => b !== a && b.turns <= a.turns && b.hp >= a.hp && b.gold >= a.gold))
    .sort((a, b) => a.turns - b.turns);
}

function followOrder(id) {
  let state = run(fresh("sell-1"), ["gate", "strike", "strike", "guard", "strike"]);
  state = trade(state, "vend-fox-clasp");
  const beforeOrder = state.gold;
  state = act(trade(state, id), "settle");
  const previousEnd = state.gold;
  assert.equal(state.phase, "won");
  state = firstStall(tower.nextRun(state, 2), "keep");
  if (id === "order-ash") {
    const ash = tower.view(state).stock.find(item => item.id === "ash");
    const stack = ash.sellStacks.find(item => item.qty === 3);
    state = trade(state, "vend-ash", 3, stack.instanceId);
  }
  return {
    id, beforeOrder, previousEnd, nextSeed: state.seed, firstStallGold: state.gold, hp: state.hp,
    weapon: state.trial.weapon, bag: tower.view(state).profile.bag.items.map(item => [item.id, item.qty])
  };
}

const seal = ["sell-1", "keep"].map(sealRoute);
const combat = battleOutcomes();
const orders = ["order-ash", "order-purse"].map(followOrder);
assert.deepEqual(seal.map(r => [r.finalGold, r.hp, r.turns]), [[30, 19, 3], [33, 19, 3]]);
assert.deepEqual(combat.map(r => [r.turns, r.hp, r.gold]), [[3, 19, 10], [4, 15, 12], [5, 18, 12]]);
assert.deepEqual(orders.map(r => [r.previousEnd, r.firstStallGold, r.hp]), [[10, 6, 22], [8, 6, 22]]);
assert.equal(JSON.stringify(orders[0].bag), JSON.stringify(orders[1].bag));
assert.equal(orders[0].weapon, orders[1].weapon);
console.log(JSON.stringify({bundleSHA256: sha, seal, combat, orders}, null, 2));
