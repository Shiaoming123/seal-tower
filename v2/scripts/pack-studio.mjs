// Build the ModelScope Static studio package: dist/ plus the studio card README, zipped.
// Usage: npm run pack:studio   →  dist-studio/ and dist-studio.zip (both git-ignored)
import { cp, rm, readdir, stat, writeFile } from "node:fs/promises";
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
