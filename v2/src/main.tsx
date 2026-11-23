import { render } from "preact";
import "./styles/main.css";
import "./styles/materials.css";
import { installMaterials } from "./ui/materials";
import { loadAll } from "./render/assets";
import { findPath } from "./game/dungeon";
import { openEntity } from "./game/run";
import type { Entity } from "./game/types";
import { App, useOverlayKeys } from "./ui/App";
import { commit, overlay, page, runSig, savedRun } from "./ui/store";

// Read-only handle for automated play tests (tests/e2e.mjs).
(window as unknown as { __seal: unknown }).__seal = { runSig, commit, page, findPath, overlay };

// While developing, hot reloads drop you back into the run you were testing.
// __seal.fight("fallen") / __seal.event("portal") open any monster or event on the spot (art review, tests).
if (import.meta.env.DEV) {
  const open = (patch: Partial<Entity>) => {
    const run = runSig.value;
    if (!run) return;
    // Fights stand one tile ahead (like a real encounter); events open where you are.
    let at = { x: run.pos.x, y: run.pos.y };
    if (patch.kind !== "event") {
      const d = run.dungeon, dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
      const order = [run.pos.dir, (run.pos.dir + 1) % 4, (run.pos.dir + 3) % 4, (run.pos.dir + 2) % 4];
      const dir = order.find((k) => !d.tiles[(run.pos.y + dirs[k][1]) * d.w + run.pos.x + dirs[k][0]]) ?? run.pos.dir;
      run.pos.dir = dir;
      at = { x: run.pos.x + dirs[dir][0], y: run.pos.y + dirs[dir][1] };
    }
    const e: Entity = { id: 9000 + run.nextUid++, kind: "fight", x: at.x, y: at.y, done: false, ...patch };
    run.dungeon.entities.push(e);
    openEntity(run, e);
    commit();
  };
  Object.assign((window as unknown as { __seal: object }).__seal, {
    fight: (enemy: string, kind: Entity["kind"] = "fight") => open({ enemy, kind }),
    event: (event: string) => open({ kind: "event", event }),
  });
  const saved = savedRun();
  if (saved) { runSig.value = saved; page.value = "game"; }
}

function Root() {
  useOverlayKeys();
  return <App />;
}

installMaterials();
const root = document.getElementById("app")!;
Promise.all([loadAll(), document.fonts?.ready]).finally(() => {
  root.innerHTML = "";
  render(<Root />, root);
});
