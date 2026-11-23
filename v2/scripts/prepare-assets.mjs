// Copies the pixel art we actually use from the legacy folders into src/assets,
// resized to the size the game draws them at. Run once after changing the manifest.
import sharp from "sharp";
import { mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = path.resolve(root, "v2/src/assets");
const S = (f) => path.join(root, "first-cut/sprites", f + ".webp");
const A = (f) => path.join(root, "assets", f + ".webp");

// id: [source, max edge in px]
const manifest = {
  // monsters
  moth: [S("crawl-moth"), 320], louse: [S("book-louse"), 420], rat: [S("crawl-rat"), 320],
  "rat-swipe": [S("crawl-rat-swipe"), 320], "mirror-fox": [S("crawl-fox"), 320],
  "moth-queen": [A("moth"), 380], "night-fox": [A("fox"), 400], warden: [S("warden"), 440],
  bell: [A("bell"), 400], "bell-heavy": [A("bell-heavy"), 420],
  fallen: [A("hunter"), 420], "fallen-strike": [A("hunter-strike"), 460], "fallen-guard": [A("hunter-guard"), 420],
  "lantern-spirit": [A("seal"), 300], "stele-spirit": [S("stele-ink"), 300], "thorn-stele": [S("stele-thorn"), 300], "fake-fox": [A("trader"), 400],
  cart: [S("escort-cart"), 300], ruin: [S("obstacle-ruin"), 240], puddle: [S("obstacle-water"), 240],
  // event scenes: placeholders until docs/美术需求.md art arrives
  "event-den": [S("obstacle-ruin"), 320], "event-peddler": [S("crawl-rat"), 320], "event-cart": [S("escort-cart"), 360],
  "event-hunter": [A("hunter-guard"), 420], "event-shrine": [S("grit"), 300], "event-pool": [S("obstacle-water"), 320],
  // people
  feixiao: [S("fox-offer-hands"), 720], "feixiao-settle": [S("fox-settle-hands"), 720],
  guide: [S("guide-oracle"), 480], broker: [S("blood-broker"), 480],
  hero: [S("hero-ready"), 460], "hunter-guard": [A("hunter-guard"), 460],
  // scenery
  shop: [S("hall"), 960], "shop-wall": [S("shop-wall"), 960], gate: [S("gate"), 960],
  "last-market": [S("last-market"), 960], belfry: [A("belfry"), 960], court: [A("court"), 960], market: [A("market"), 960],
  // props in the maze
  stele: [S("stele-ink"), 200], "stele-thorn": [S("stele-thorn"), 200], "sign-turn": [S("sign-turn"), 180],
  lamp: [S("lamp-seal"), 220], trader: [A("trader"), 360], purse: [S("seal-purse-tied"), 180], rock: [S("obstacle-rock"), 200],
  // goods & relics
  ash: [S("merch-ash"), 128], silk: [S("merch-silk"), 128], salve: [S("merch-salve"), 128], knot: [S("merch-knot"), 128],
  fang: [S("merch-fang"), 128], shell: [S("merch-ink-shell"), 128], lining: [S("merch-lining"), 128],
  mirror: [S("merch-mirror"), 128], abacus: [S("merch-abacus"), 128], "bell-item": [S("merch-bell"), 128],
  clasp: [S("merch-fox-clasp"), 128], hook: [S("merch-hook"), 128], sword: [S("merch-sword"), 128],
  "ward-blade": [S("merch-ward-blade"), 128], "order-purse": [S("merch-order-purse"), 128], pin: [S("fox-pin"), 128],
  seal: [S("lamp-seal"), 128], grit: [S("grit"), 128], plank: [S("obstacle-plank"), 160], pouch: [S("seal-purse"), 128],
};

// Placeholders until the real illustrations arrive (see docs/美术需求.md):
// recoloured variants of existing art. [id, source, edge, hue°, saturation, brightness]
const tints = [
  ["fire-rat", S("crawl-rat"), 320, 335, 1.5, 1.05],
  ["ink-moth", S("crawl-moth"), 320, 200, 0.55, 0.75],
  ["paper-doll", S("blood-broker"), 400, 20, 0.25, 1.35],
  ["water-ghost", S("guide-oracle"), 420, 180, 0.6, 0.7],
  ["bronze-puppet", A("bell-heavy"), 380, 30, 0.7, 1.1],
  ["night-owl", A("moth"), 360, 25, 0.8, 0.6],
  ["paper-matron", S("blood-broker"), 460, 350, 1.4, 1.1],
  ["fallen-elder", A("hunter"), 460, 250, 0.5, 0.7],
  ["fallen-elder-strike", A("hunter-strike"), 500, 250, 0.5, 0.7],
  ["fallen-elder-guard", A("hunter-guard"), 460, 250, 0.5, 0.7],
  // placeholder icons for the new goods
  ["icon-redpaper", S("merch-silk"), 128, 340, 1.6, 1],
  ["icon-fur", S("merch-knot"), 128, 30, 1.3, 1.1],
  ["icon-inkdust", S("merch-ash"), 128, 220, 0.5, 0.5],
  ["icon-pearl", S("lamp-seal"), 128, 180, 1.2, 1.2],
  ["icon-rubbing", S("merch-silk"), 128, 0, 0.1, 1.1],
  ["icon-token", S("grit"), 128, 0, 0.8, 1],
  ["icon-shard", S("merch-bell"), 128, 20, 1.2, 1.2],
  ["icon-feather", S("merch-fang"), 128, 30, 0.6, 0.7],
  ["icon-tail", S("merch-knot"), 128, 0, 0.05, 1.6],
  ["icon-whetstone", S("obstacle-rock"), 128, 200, 0.4, 1],
  ["icon-amulet", S("merch-order-hook"), 128, 40, 1.2, 1.1],
  ["icon-oilpot", S("merch-salve"), 128, 30, 1.4, 1.05],
  ["icon-luckybag", S("seal-purse"), 128, 40, 1.3, 1.15],
  ["icon-wardcharm", S("merch-order-hook"), 128, 300, 1, 1],
];

await mkdir(out, { recursive: true });
for (const [id, src, edge, hue, saturation, brightness] of tints) {
  await sharp(src).resize(edge, edge, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .modulate({ hue, saturation, brightness }).webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(out, id + ".webp"));
}
for (const [id, [src, edge]] of Object.entries(manifest)) {
  await sharp(src).resize(edge, edge, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(out, id + ".webp"));
}
// Real art dropped into v2/art/<id>.png|webp replaces any placeholder with the same id.
const artDir = path.resolve(root, "v2/art");
const edges = Object.fromEntries([...Object.entries(manifest).map(([id, [, e]]) => [id, e]), ...tints.map(([id, , e]) => [id, e])]);
let overrides = 0;
for (const file of await readdir(artDir).catch(() => [])) {
  const m = file.match(/^(.+)\.(png|webp|jpg)$/i);
  if (!m) continue;
  // New art for ids the game looks up with a fallback (cards, relics, portraits…) gets a size by prefix.
  const prefixEdge = [["card-", 256], ["relic-", 192], ["build-", 192], ["icon-", 128], ["portrait-", 480], ["event-", 420], ["omen-", 480]]
    .find(([p]) => m[1].startsWith(p))?.[1];
  const edge = edges[m[1]] ?? prefixEdge ?? 440;
  await sharp(path.join(artDir, file)).resize(edge, edge, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(out, m[1] + ".webp"));
  overrides++;
}
if (overrides) console.log(`replaced ${overrides} placeholder(s) from art/`);
console.log(`wrote ${Object.keys(manifest).length} assets to ${out}`);
