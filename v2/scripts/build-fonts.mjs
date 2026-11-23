// Subsets the two OFL fonts to the characters the game actually uses and writes WOFF2 files to src/fonts.
// Source TTFs are downloaded once into .cache/fonts (see README). Re-run after adding new text.
import subsetFont from "subset-font";
import { readFile, writeFile, readdir, mkdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".cache/fonts");
const out = path.join(root, "src/fonts");
const SOURCES = {
  brush: { file: "MaShanZheng-Regular.ttf", url: "https://raw.githubusercontent.com/google/fonts/06bfe0d62a98375cb09c942fa18e68bd32cff057/ofl/mashanzheng/MaShanZheng-Regular.ttf" },
  kai: { file: "LXGWWenKai-Medium.ttf", url: "https://raw.githubusercontent.com/lxgw/LxgwWenKai/e52e0e1e9f561f1caa2e14c8154d3a1accee834a/fonts/TTF/LXGWWenKai-Medium.ttf" },
};

async function walk(dir) {
  const files = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...(await walk(p)));
    else if (/\.(tsx?|css|html)$/.test(e.name)) files.push(p);
  }
  return files;
}

const text = (await Promise.all([...(await walk(path.join(root, "src"))), path.join(root, "index.html")].map((f) => readFile(f, "utf8")))).join("");
const ascii = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join("");
const chars = new Set([...ascii, ..."，。、：；！？（）「」《》…—·×←→↑↓↶↷●○★☆％＋－"]);
for (const ch of text) if (ch.charCodeAt(0) > 0x2000) chars.add(ch);
const charset = [...chars].join("");

await mkdir(out, { recursive: true });
for (const [name, src] of Object.entries(SOURCES)) {
  const file = path.join(cache, src.file);
  try { await access(file); } catch {
    await mkdir(cache, { recursive: true });
    console.log(`downloading ${src.file}…`);
    const res = await fetch(src.url);
    if (!res.ok) throw new Error(`download failed: ${src.url}`);
    await writeFile(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = await subsetFont(await readFile(file), charset, { targetFormat: "woff2" });
  await writeFile(path.join(out, `${name}.woff2`), buf);
  console.log(`${name}.woff2  ${(buf.length / 1024).toFixed(0)} KB  (${chars.size} chars)`);
}
