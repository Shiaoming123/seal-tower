// Art audit: lists every picture the game uses or looks for, and marks what is real, placeholder,
// shared between several things, or still missing. Writes docs/美术清单.json for image-generation agents.
// Usage: node scripts/art-audit.mjs
import { createServer } from "vite";
import { createHash } from "node:crypto";
import { readdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const server = await createServer({ root, server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const load = (f) => server.ssrLoadModule(f);
const [{ ENEMIES, FLOOR_SPAWNS }, { GOODS }, { RELICS }, { CARDS }, { EVENTS }, { CHARACTERS }, { ORDERS }, { UPGRADES }, { OMENS }, { ORDER_CHARACTER }, parts] = await Promise.all([
  load("/src/data/enemies.ts"), load("/src/data/goods.ts"), load("/src/data/relics.ts"), load("/src/data/cards.ts"), load("/src/data/events.ts"),
  load("/src/data/codex.ts"), load("/src/data/orders.ts"), load("/src/data/town.ts"), load("/src/data/omens.ts"), load("/src/game/discover.ts"), load("/src/ui/parts.tsx"),
]);
await server.close();

const have = new Set((await readdir(path.join(root, "src/assets"))).map((f) => f.replace(/\.webp$/, "")));
const artDir = path.join(root, "art");
const recorded = await readFile(path.join(artDir, "exports.json"), "utf8").then(JSON.parse, (err) => {
  if (err.code !== "ENOENT") throw err;
  return {};
});
const digest = (data) => createHash("sha256").update(data).digest("hex");
const overrides = new Set();
for (const [id, art] of Object.entries(recorded)) {
  if (!have.has(id) || path.basename(art.file) !== art.file) continue;
  const source = await readFile(path.join(artDir, art.file)).catch((err) => {
    if (err.code !== "ENOENT") throw err;
    return null;
  });
  if (!source || digest(source) !== art.sourceSha256) continue;
  const output = await readFile(path.join(root, "src/assets", id + ".webp"));
  if (digest(output) === art.webpSha256) overrides.add(id);
}
const prep = await readFile(path.join(root, "scripts/prepare-assets.mjs"), "utf8");
// Placeholders: recoloured variants, and manifest entries borrowed from art made for something else.
const tinted = new Set([...prep.matchAll(/\["([a-z0-9-]+)", [SA]\(/g)].map((m) => m[1]));
const BORROWED = {
  fallen: "旧斩妖人", "fallen-strike": "旧斩妖人出剑", "fallen-guard": "旧斩妖人架势", "lantern-spirit": "旧灯纹印挂灯",
  "stele-spirit": "旧墨碑", "thorn-stele": "旧荆棘碑", "fake-fox": "旧白狐商", "event-den": "碎石", "event-peddler": "灯鼠",
  "event-cart": "押运货车", "event-hunter": "斩妖人架势", "event-shrine": "描金盒", "event-pool": "水洼", plank: "桥上的木板障碍",
};

const items = new Map();
const use = (file, category, usedBy, want) => {
  const e = items.get(file) ?? { file, category, usedBy: [], wanted: [] };
  e.usedBy.push(usedBy);
  if (want) e.wanted.push(want);
  items.set(file, e);
};
const status = (file) => file === "portal" ? "code-drawn" : !have.has(file) ? "missing" : overrides.has(file) ? "ok" : tinted.has(file) ? "placeholder-tint" : BORROWED[file] ? "placeholder-borrowed" : "ok";

// What the game shows now.
for (const e of Object.values(ENEMIES)) {
  use(e.sprite, "敌怪", `敌怪·${e.name}`);
  if (e.spriteAttack) use(e.spriteAttack, "敌怪", `敌怪·${e.name}·出招`);
  if (e.spriteStance) use(e.spriteStance, "敌怪", `敌怪·${e.name}·架势`);
  if (e.phase2 && e.phase2.sprite !== e.sprite) use(e.phase2.sprite, "敌怪", `敌怪·${e.name}·二阶段`);
}
for (const g of Object.values(GOODS)) use(g.icon, "物品图标", `${{ goods: "货物", gear: "装备", consumable: "消耗品" }[g.kind]}·${g.name}`);
for (const r of Object.values(RELICS)) use(r.icon, "物品图标", `法宝·${r.name}`);
for (const [id, icon] of Object.entries(parts.CARD_ART)) use(icon, "物品图标", `卡牌·${CARDS[id]?.name ?? id}`);
for (const ev of Object.values(EVENTS)) {
  use(ev.sprite, "事件", `事件·${ev.title}`);
  const closeUp = `event-${ev.sprite}`;
  if (have.has(closeUp)) use(closeUp, "事件", `事件近景·${ev.title}`);
  const billboard = `map-${ev.sprite}`;
  if (have.has(billboard)) use(billboard, "事件", `地图物件·${ev.title}`);
}
for (const c of CHARACTERS) use(parts.portraitOf(c.id, c.portrait), "人物", `图鉴·${c.name}`);
for (const order of Object.values(ORDERS)) {
  use(parts.portraitOf(ORDER_CHARACTER[order.id] ?? order.id, order.portrait), "人物", `接单·${order.client}`);
}
for (const u of UPGRADES) use(u.icon, "物品图标", `营建·${u.name}`);
for (const [file, what] of [["shop", "标题背景"], ["shop-wall", "镇灯铺背景"], ["market", "狐市背景"], ["court", "第一层事件背景"], ["gate", "第二层事件背景"],
  ["belfry", "第三层事件背景"], ["last-market", "结算背景"], ["hero", "标题主角 / 结算"], ["hunter-guard", "败北结算"], ["feixiao", "狐市·绯绡"],
  ["feixiao-settle", "狐市·绯绡成交"], ["trader", "迷宫里的狐市摊位"], ["lamp", "迷宫里的灯台"], ["purse", "迷宫里的宝箱"], ["sign-turn", "迷宫里的楼梯"]])
  use(file, "场景", what);

// Dedicated art the game already looks for (with a fallback): each should be its own picture.
const wantCards = Object.keys(parts.CARD_ART).map((id) => ({ file: `card-${id}`, category: "卡牌插图", usedBy: `卡牌·${CARDS[id].name}`, fallback: parts.CARD_ART[id] }));
const wantRelics = Object.values(RELICS).map((r) => ({ file: `relic-${r.id}`, category: "法宝图标", usedBy: `法宝·${r.name}`, fallback: r.icon }));
const wantPortraits = CHARACTERS.filter((c) => ["lamp", "herbs", "scholar", "mayor"].includes(c.id)).map((c) => ({ file: `portrait-${c.id}`, category: "人物立绘", usedBy: `人物·${c.name}`, fallback: c.portrait }));
const wantBuilds = UPGRADES.map((u) => ({ file: `build-${u.id}`, category: "营建图标", usedBy: `营建·${u.name}`, fallback: u.icon }));
const enemies = Object.values(ENEMIES);
const enemyIds = [...new Set(enemies.flatMap((e) => e.phase2 ? [e.sprite, e.phase2.sprite] : [e.sprite]))];
const wantPoses = enemyIds.flatMap((s) => {
  const attack = `${s}-attack`;
  const definition = enemies.find((e) => e.sprite === s) ?? enemies.find((e) => e.phase2?.sprite === s);
  const fallback = definition?.spriteAttack ?? s;
  // Combat can use a named strike frame. A verified exclusive fallback already covers that pose.
  const hasDedicatedFallback = overrides.has(fallback) && fallback !== s && items.get(fallback)?.usedBy.length === 1;
  const attackFile = !have.has(attack) && hasDedicatedFallback ? fallback : attack;
  return [
    { file: attackFile, category: "敌怪姿态", usedBy: `${s} 扑击/出招`, fallback: attackFile === attack ? fallback : s },
    { file: `${s}-hurt`, category: "敌怪姿态", usedBy: `${s} 受击`, fallback: s },
  ];
});
const wanted = [...wantCards, ...wantRelics, ...wantPortraits, ...wantBuilds, ...wantPoses].map((w) => ({ ...w, status: have.has(w.file) ? "ok" : "missing" }));

const current = [...items.values()].map((e) => ({
  ...e, status: status(e.file), shared: e.usedBy.length > 1, note: overrides.has(e.file) && have.has(e.file) ? "已采用 v2/art 原图" : BORROWED[e.file] ? `现在借用：${BORROWED[e.file]}` : tinted.has(e.file) ? "现在是旧图改色" : "",
}));
const priority = (x) => x.category === "敌怪" && x.status !== "ok" ? "P0" : x.category === "事件" && x.status !== "ok" ? "P0"
  : ["卡牌插图", "法宝图标", "人物立绘"].includes(x.category) ? "P1" : x.category === "物品图标" && x.status !== "ok" ? "P1" : "P2";
const out = {
  generatedBy: "scripts/art-audit.mjs",
  howToAdd: "把图放进 v2/art/<file>.png，在 v2/ 下运行 npm run assets。file 不带扩展名，必须和下表一致。",
  current: current.map((x) => ({ ...x, priority: x.status === "ok" && !x.shared ? "-" : priority(x) })),
  wanted: wanted.map((x) => ({ ...x, priority: priority(x) })),
  omens: OMENS.map((o) => ({ file: `omen-${o.id}`, name: o.name, status: have.has(`omen-${o.id}`) ? "ok" : "optional" })),
};
await writeFile(path.join(root, "docs/美术清单.json"), JSON.stringify(out, null, 2) + "\n");
const count = (list, s) => list.filter((x) => x.status === s).length;
console.log(`现用图片 ${current.length} 张：原图 ${count(current, "ok")}，改色占位 ${count(current, "placeholder-tint")}，借用占位 ${count(current, "placeholder-borrowed")}，被多处共用 ${current.filter((x) => x.shared).length}`);
console.log(`待补专用图 ${wanted.length} 张（缺 ${count(wanted, "missing")}）：卡牌 ${wantCards.length}、法宝 ${wantRelics.length}、人物 ${wantPortraits.length}、营建 ${wantBuilds.length}、敌怪姿态 ${wantPoses.length}`);
console.log("→ docs/美术清单.json");
void FLOOR_SPAWNS;
