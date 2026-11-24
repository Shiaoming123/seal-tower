import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("../../", import.meta.url));
const git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
const list = (args) => git(args).split("\0").filter(Boolean);
const files = new Set(list(["ls-files", "-z", "--cached", "--others", "--exclude-standard"]));
const read = (file) => readFileSync(path.join(root, file), "utf8");
const json = (file) => JSON.parse(read(file));
const fail = (reason) => { problems.push(reason); };

const manifest = json("docs/资料索引.json");
const exports = json("v2/art/exports.json");
const audit = json("v2/docs/美术清单.json");
const roster = read("docs/协作任务.md");
const logIndex = read("docs/dev-log/README.md");
const map = "docs/开发导航.md";
const navigation = read(map);
const problems = [];
const counts = new Map(manifest.groups.map(({ id }) => [id, 0]));

if (manifest.schemaVersion !== 1 || counts.size !== manifest.groups.length) {
  fail("资料索引版本或分组 ID 无效");
}

const knownFile = (file) => files.has(file) && statSync(path.join(root, file), { throwIfNoEntry: false })?.isFile();
const belongs = (group, file) => group.files?.includes(file) || group.directories?.some((dir) => file.startsWith(dir));
const scopedMedia = /\.(md|pdf|png|jpe?g|webp|avif|apng|gif|svg|bmp|ico|otf|ttf|woff2?|eot|mp3|wav|ogg|flac|m4a|aac|mp4|webm|mov|zip|aseprite|psd|blend)$/i;
for (const file of files) {
  const groups = manifest.groups.filter((group) => belongs(group, file));
  const isDevelopmentDocument = /^(docs|v2\/docs)\//.test(file) && /\.(md|txt|json|pdf|html|csv|tsv)$/i.test(file);
  if (!groups.length) {
    if (scopedMedia.test(file) || isDevelopmentDocument) fail("资料未归类 " + file);
  } else if (groups.length > 1) {
    fail("资料归属重复 " + file);
  } else {
    counts.set(groups[0].id, counts.get(groups[0].id) + 1);
  }
}

const links = new Set([...navigation.matchAll(/\]\(([^)\n]+)\)/g)].flatMap(([, ref]) => {
  if (/^(?:[a-z]+:|#)/i.test(ref)) return [];
  const dst = path.posix.normalize(path.posix.join(path.posix.dirname(map), ref.split("#")[0]));
  return [dst];
}));
for (const group of manifest.groups) {
  if (!knownFile(group.entry) || !links.has(group.entry)) fail("导航缺分组入口 " + group.entry);
  for (const file of group.files ?? []) if (!knownFile(file)) fail("索引文件不存在 " + file);
}
for (const dst of links) {
  if (!knownFile(dst) && ![...files].some((file) => file.startsWith(dst.endsWith("/") ? dst : dst + "/"))) {
    fail(map + " 链接不存在 " + dst);
  }
}
for (const target of Object.values(manifest.mechanics)) if (!knownFile(target)) fail("机制定义不存在 " + target);

const digest = (file) => createHash("sha256").update(readFileSync(path.join(root, file))).digest("hex");
const codeDrawn = new Set(audit.current.filter(({ status }) => status === "code-drawn").map(({ file }) => file));
const mothers = new Set();
for (const [id, { file, sourceSha256, webpSha256 }] of Object.entries(exports)) {
  const source = "v2/art/" + file;
  const output = "v2/src/assets/" + id + ".webp";
  mothers.add(source);
  if (path.posix.basename(file) !== file || !knownFile(source) || !knownFile(output)) {
    fail("素材导出缺文件 " + id);
  } else if (digest(source) !== sourceSha256 || digest(output) !== webpSha256) {
    fail("素材导出哈希不匹配 " + id);
  }
}
for (const file of files) {
  if (file.startsWith("v2/art/") && /\.(png|webp)$/i.test(file) && !mothers.has(file)) fail("母图缺导出记录 " + file);
}

const taskIds = new Set([...roster.matchAll(/^\|\s*([A-Z]+-\d{3}[A-Z0-9-]*)\s*\|/gm)].map(([, id]) => id));
const traced = new Set();
const logs = [...files].filter((file) => /^docs\/dev-log\/\d{4}-\d{2}-\d{2}-[^/]+\.md$/.test(file));
const traces = [];
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== "--base")) {
  throw new Error("用法 npm run docs:check -- [--base <git revision>]");
}
const added = !args.length ? new Set() : new Set([
  ...list(["diff", "--name-only", "--diff-filter=A", "-z", args[1], "--"]),
  ...list(["ls-files", "-z", "--others", "--exclude-standard"]),
]);
const isList = (value) => Array.isArray(value) && value.every((item) => typeof item === "string") && new Set(value).size === value.length;
for (const file of logs) {
  if (!logIndex.includes("(" + path.posix.basename(file) + ")")) fail("开发日志索引缺入口 " + file);
  const record = [...read(file).matchAll(/<!--\s*task-trace\s+([\s\S]*?)\s*-->/g)];
  if (!record.length) {
    if (added.has(file)) fail(file + " 缺 task-trace");
    continue;
  }
  try {
    if (record.length !== 1) throw new Error("task-trace 重复");
    const trace = JSON.parse(record[0][1]);
    const { schemaVersion, taskId, entities, assets, dependsOn, evidence, sourceRevision } = trace;
    if (schemaVersion !== 1 || !taskIds.has(taskId) || traced.has(taskId) || !file.endsWith("-" + taskId + ".md")) {
      throw new Error("任务 ID 无法对应文件名和协作台账");
    }
    if (![entities, assets, dependsOn, evidence].every(isList) || !evidence.length ||
        !/^[0-9a-f]{7,40}$/i.test(sourceRevision ?? "")) throw new Error("字段、证据清单或基线无效");
    git(["rev-parse", "--verify", "--quiet", sourceRevision + "^{commit}"]);
    traced.add(taskId);
    traces.push({ file, entities, assets });
    for (const dep of dependsOn) if (dep === taskId || !taskIds.has(dep)) fail(file + " 依赖任务无效 " + dep);
    for (const ref of evidence) {
      const dst = path.posix.normalize(path.posix.join(path.posix.dirname(file), ref));
      if (path.posix.isAbsolute(ref) || /[\\:#]/.test(ref) || !knownFile(dst)) fail(file + " 证据路径无效 " + ref);
    }
    for (const id of assets) {
      if (!/^[a-z0-9-]+$/.test(id) || (!codeDrawn.has(id) && !knownFile("v2/src/assets/" + id + ".webp"))) {
        fail(file + " 素材未进入运行目录 " + id);
      }
    }
  } catch (error) {
    fail(file + " 的任务关系无效 " + error.message);
  }
}
for (const id of manifest.requiredTraces) if (!traced.has(id)) fail("已纳管任务缺关系 " + id);
const tracedAssets = new Set(traces.flatMap(({ assets }) => assets));
for (const file of added) {
  const match = /^v2\/src\/assets\/([a-z0-9-]+)\.webp$/.exec(file);
  if (match && !tracedAssets.has(match[1])) fail("新运行素材缺任务关系 " + file);
}
for (const [id, { file }] of Object.entries(exports)) {
  if (added.has("v2/art/" + file) && !tracedAssets.has(id)) fail("新母图缺任务关系 " + id);
}

if (traces.length) {
  const server = await createServer({
    root: path.join(root, "v2"), server: { middlewareMode: true, hmr: false, watch: null },
    appType: "custom", logLevel: "error",
  });
  try {
    const [enemy, event, goods, card, relic, codex, orders] = await Promise.all(
      ["enemies", "events", "goods", "cards", "relics", "codex", "orders"].map((module) => server.ssrLoadModule("/src/data/" + module + ".ts"))
    );
    const ids = { enemy: enemy.ENEMIES, event: event.EVENTS, floor: enemy.FLOOR_SPAWNS,
      goods: goods.GOODS, card: card.CARDS, relic: relic.RELICS, mechanic: manifest.mechanics,
      character: Object.fromEntries(codex.CHARACTERS.map((character) => [character.id, character])), order: orders.ORDERS };
    for (const { file, entities } of traces) {
      for (const entity of entities) {
        const [kind, id, extra] = entity.split(":");
        if (extra !== undefined || !Object.hasOwn(ids, kind) || !Object.hasOwn(ids[kind], id ?? "")) {
          fail(file + " 未知实体 " + entity);
        }
      }
    }
  } finally {
    await server.close();
  }
}

if (problems.length) {
  for (const problem of problems) console.error(problem);
  process.exitCode = 1;
} else {
  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  console.log("资料归属 " + total + " 项 · 分组 " + counts.size + " · 可检查任务关系 " + traced.size +
    " · 导出与母图哈希 " + Object.keys(exports).length + " 组");
  console.log([...counts].map(([id, count]) => id + " " + count).join(" · "));
}
