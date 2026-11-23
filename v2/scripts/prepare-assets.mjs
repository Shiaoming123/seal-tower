// Copies the pixel art we actually use from the legacy folders into src/assets,
// resized to the size the game draws them at. Run once after changing the manifest.
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
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

await mkdir(out, { recursive: true });
for (const [id, [src, edge]] of Object.entries(manifest)) {
  await sharp(src).resize(edge, edge, { fit: "inside", withoutEnlargement: true, kernel: "lanczos3" })
    .webp({ quality: 84, alphaQuality: 90, effort: 6 }).toFile(path.join(out, id + ".webp"));
}
console.log(`wrote ${Object.keys(manifest).length} assets to ${out}`);
