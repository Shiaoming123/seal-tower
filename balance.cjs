const assert = require("node:assert/strict");
const Tower = require("./game.js");

// Policies use the announced attack, next attack, prices, equipment and visible currency.
function choose(s, build, policy) {
  const v = Tower.view(s);
  const enabled = v.actions.filter(a => !a.disabled);
  const can = id => enabled.some(a => a.id === id);
  switch (s.phase) {
    case "start": return build;
    case "fight": {
      const damage = Number(v.actions[0].detail.match(/先斩 (\d+)/)[1]);
      if (damage >= v.enemy.hp || policy === "rush") return "strike";
      if (can("cast") && v.combat.nextHeavy && !v.combat.heavy && v.enemy.hp > damage * 2) return "cast";
      if (v.combat.heavy && !s.armed && !s.counter) return "guard";
      return "strike";
    }
    case "reward": return "take";
    case "route":
      if (policy === "liquidate" && can("salvage") && s.hp > 9) return "salvage";
      return enabled[0].id;
    case "shop": {
      const sale = enabled.find(a => a.id.startsWith("sell-"));
      if (policy === "liquidate" && sale) return sale.id;
      if (policy === "carry" && s.floor === 2 && sale) return sale.id;
      if (can("potion") && s.hp <= 17) return "potion";
      if (can("mirror")) return "mirror";
      return "leave";
    }
    case "prep": {
      const embed = enabled.find(a => a.id.startsWith("embed-"));
      if (embed && !(policy === "carry" && s.floor === 1)) return embed.id;
      return "climb";
    }
  }
  throw Error("Unexpected phase " + s.phase);
}

function advance(s, id) {
  const before = JSON.stringify(s);
  const result = Tower.act(s, id);
  assert.notEqual(result, s, "Action must be legal: " + s.phase + "/" + id);
  assert.equal(JSON.stringify(s), before, "Previous state was changed");
  assert.ok(result.hp >= 0 && result.hp <= 24 && result.gold >= 0 && result.charges >= 0);
  assert.ok(result.seals.length <= 2);
  return result;
}
function play(seed, build, policy) {
  let s = Tower.start(seed);
  const trace = [];
  while (!["won","lost"].includes(s.phase)) {
    assert.ok(trace.length < 100, "policy got stuck");
    const id = choose(s, build, policy);
    trace.push(id);
    s = advance(s, id);
  }
  assert.deepEqual(trace.reduce(Tower.act, Tower.start(seed)), s);
  return {s, trace};
}

for (const build of ["sword","disc","shield"]) {
  for (const policy of ["embed","carry","liquidate","rush"]) {
    let wins = 0, sumHp = 0, sumSteps = 0;
    for (let i = 0; i < 256; i++) {
      const {s, trace} = play(i, build, policy);
      wins += Number(s.phase === "won");
      sumHp += s.hp;
      sumSteps += trace.length;
    }
    if (policy === "embed") assert.ok(wins > 0);
    console.log(build, policy, wins + "/256 wins", "HP " + (sumHp/256).toFixed(1), "steps " + (sumSteps/256).toFixed(1));
  }
}

const fight = build => advance(Tower.start("first"), build);
const disc = fight("disc");
const set = advance(disc, "cast");
assert.equal(set.hp, 22);
assert.equal(set.charges, 0);
assert.equal(Tower.act(set, "cast"), set);
const intercepted = advance(set, "strike");
assert.equal(intercepted.phase, "reward");
assert.equal(intercepted.echoes, 1);
assert.equal(intercepted.hp, set.hp);
// An array cast on the very turn a heavy lands cannot cancel it retroactively.
const late = advance(advance(disc, "strike"), "cast");
assert.equal(late.hp, 16);
assert.equal(late.echoes, 0);
const shield = advance(fight("shield"), "strike");
const counter = advance(shield, "guard");
assert.equal(counter.counter, 6);
assert.equal(counter.hp, shield.hp);
assert.equal(advance(counter, "strike").phase, "reward");
const sealed = advance(advance(fight("sword"), "strike"), "strike");
assert.equal(sealed.hp, 22);
const path = advance(sealed, "take");
assert.equal(Tower.act(path, "take"), path);
const poor = {...path, hp:3, gold:0};
assert.equal(Tower.act(poor, "salvage"), poor);
const shop = advance(path, "guide");
assert.equal(shop.marketIntel, true);
assert.equal(Tower.act(shop, "mirror"), shop);
const offer = Number(Tower.view(shop).actions[0].detail.match(/\+(\d+)/)[1]);
assert.ok([4,7].includes(offer));
const sold = advance(shop,"sell-1");
assert.equal(sold.gold, shop.gold+offer);
assert.equal(sold.seals.length, 0);
assert.equal(Tower.act(sold, "sell-1"), sold);
const medicine = advance({...sold,hp:20}, "potion");
assert.equal(medicine.hp, 24);
assert.equal(medicine.gold, sold.gold-5);
assert.equal(Tower.act(medicine,"potion"), medicine);
const jewelled = advance({...shop,gold:8}, "mirror");
assert.equal(Tower.act(jewelled,"mirror"), jewelled);
const market = Tower.view(advance(advance(jewelled, "leave"), "climb"));
assert.equal(market.floor, 2);
const withMirror = {...fight("shield"),mirror:true,mirrorReady:true};
const unharmed = advance(withMirror, "guard");
assert.equal(unharmed.mirrorReady, true);
const hurt = advance(unharmed, "strike");
assert.equal(hurt.mirrorReady, false);
assert.equal(hurt.hp, 24);

const firstShop = advance(path,"salvage");
assert.equal(firstShop.hp, path.hp-3);
assert.equal(firstShop.gold, path.gold+4);
const carried = advance(advance(shop, "leave"), "climb");
assert.equal(carried.seals[0].mark, "灯纹");
const empty = advance(advance(shop, "leave"), "embed-1");
assert.equal(empty.upgrades, 1);
assert.equal(Tower.act(empty,"embed-1"), empty);
const fatal = {...disc, hp:1};
const lost = advance(fatal,"strike");
assert.equal(lost.phase,"lost");
assert.equal(Tower.act(lost,"strike"),lost);
assert.deepEqual(Tower.start(lost.seed), Tower.start("first"));
console.log("PASS state integrity, replay, seal routing, resources, delayed echo, damage order, loss and restart.");

let verifiedCarry = false;
for (let seed = 0; seed < 256 && !verifiedCarry; seed++) {
  let s = Tower.start(seed);
  while (s.phase !== "shop") s = advance(s, choose(s,"sword","carry"));
  const firstView = Tower.view(s);
  if (!firstView.actions.find(a => a.id === "sell-1").detail.startsWith("+4") ||
      !firstView.intent.includes("末市以 7 石求灯纹印")) continue;
  s = advance(advance(s,"leave"),"climb");
  while (s.phase !== "shop") s = advance(s, choose(s,"sword","carry"));
  assert.equal(s.seals.length, 2);
  assert.deepEqual(s.seals.map(item=>item.id), [1,2]);
  assert.ok(Tower.view(s).title.includes("末市"));
  const purse = s.gold;
  s = advance(s, "sell-1");
  assert.equal(s.gold, purse + 7);
  assert.equal(s.seals.length, 1);
  assert.equal(s.seals[0].id, 2);
  assert.equal(Tower.act(s,"sell-1"), s);
  s = advance(s, "mirror");
  assert.equal(s.gold, purse + 7 - 8);
  assert.equal(Tower.act(s,"mirror"), s);
  s = advance(advance(s,"leave"),"embed-2");
  assert.equal(s.upgrades, 1);
  assert.equal(s.receipts.length, 2);
  console.log("Seed", seed, "verified first offer 4 → second offer 7, two seals, buy mirror, embed other seal.");
  verifiedCarry = true;
}
assert.ok(verifiedCarry);

const beforeFocus = fight("sword");
const afterFocus = advance(beforeFocus, "focus-strike");
assert.equal(beforeFocus.foeHp - afterFocus.foeHp, 8);
assert.equal(afterFocus.turn, beforeFocus.turn + 1);
assert.equal(Tower.view(afterFocus).combat.focusReady, false);
assert.equal(Tower.act(afterFocus, "focus-strike"), afterFocus);
let nextFloor = advance(afterFocus, "strike");
assert.equal(Tower.act(nextFloor, "focus-strike"), nextFloor);
for (const id of ["take", "guide", "leave", "embed-1", "climb"]) nextFloor = advance(nextFloor, id);
assert.equal(Tower.view(nextFloor).combat.focusReady, true);
assert.equal(nextFloor.foeHp - advance(nextFloor, "focus-strike").foeHp, 10);
console.log("PASS focused strike +2, once per encounter, turn accounting, floor reset and upgraded blade.");
