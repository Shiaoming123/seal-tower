// Build the ModelScope Static studio package: dist/ plus the studio card README, zipped.
// Usage: npm run pack:studio   →  dist-studio/ and dist-studio.zip (both git-ignored)
//   node scripts/pack-studio.mjs --flat  →  also dist-studio-flat/: every file at the top level, for the studio's
//   web uploader (which takes files, not folders): assets/* and licenses/* move up, index.html is rewritten.
import { cp, rm, readdir, rename, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist-studio");
await rm(out, { recursive: true, force: true });
await rm(join(root, "dist-studio.zip"), { force: true });
await cp(join(root, "dist"), out, { recursive: true });
await cp(join(root, "../docs/contest/studio-README.md"), join(out, "README.md"));

const files = [];
const walk = async (dir) => {
  for (const name of (await readdir(dir)).sort()) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) await walk(p);
    else if (name !== "SHA256SUMS.txt") files.push(p);
  }
};
await walk(out);
const sums = files.map((p) => `${createHash("sha256").update(readFileSync(p)).digest("hex")}  ${relative(out, p)}`).join("\n") + "\n";
await writeFile(join(out, "SHA256SUMS.txt"), sums);

// Entry must use relative paths so the studio can serve it from any sub-path.
const html = readFileSync(join(out, "index.html"), "utf8");
if (/(src|href)="\/(?!\/)/.test(html)) throw new Error("index.html has an absolute asset path");

execFileSync("zip", ["-qr", "-X", "../dist-studio.zip", "."], { cwd: out });
const size = (await stat(join(root, "dist-studio.zip"))).size;
console.log(`dist-studio/: ${files.length + 1} files · dist-studio.zip ${(size / 1048576).toFixed(1)} MB`);

if (process.argv.includes("--flat")) {
  // Asset URLs in the bundle are relative to the JS/CSS files themselves (new URL(x, import.meta.url), url(./x)),
  // so moving assets/ up next to index.html only needs index.html's two references rewritten.
  const flat = join(root, "dist-studio-flat");
  await rm(flat, { recursive: true, force: true });
  await cp(out, flat, { recursive: true });
  for (const name of await readdir(join(flat, "assets"))) await rename(join(flat, "assets", name), join(flat, name));
  for (const name of await readdir(join(flat, "licenses"))) await rename(join(flat, "licenses", name), join(flat, `licenses-${name}`));
  await rm(join(flat, "assets"), { recursive: true }); await rm(join(flat, "licenses"), { recursive: true });
  const fhtml = readFileSync(join(flat, "index.html"), "utf8").replaceAll('"./assets/', '"./');
  if (fhtml.includes("assets/")) throw new Error("flat index.html still references assets/");
  await writeFile(join(flat, "index.html"), fhtml);
  await writeFile(join(flat, "README.md"), readFileSync(join(flat, "README.md"), "utf8").replace("`licenses/`", "`licenses-*.txt`"));
  const ffiles = (await readdir(flat)).filter((n) => n !== "SHA256SUMS.txt").sort();
  await writeFile(join(flat, "SHA256SUMS.txt"), ffiles.map((n) => `${createHash("sha256").update(readFileSync(join(flat, n))).digest("hex")}  ${n}`).join("\n") + "\n");
  console.log(`dist-studio-flat/: ${ffiles.length + 1} files, all top level`);
}
