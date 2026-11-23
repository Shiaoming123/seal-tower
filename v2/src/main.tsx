import { render } from "preact";
import "./styles/main.css";
import "./styles/materials.css";
import { installMaterials } from "./ui/materials";
import { loadAll } from "./render/assets";
import { findPath } from "./game/dungeon";
import { App, useOverlayKeys } from "./ui/App";
import { commit, overlay, page, runSig, savedRun } from "./ui/store";

// Read-only handle for automated play tests (tests/e2e.mjs).
(window as unknown as { __seal: unknown }).__seal = { runSig, commit, page, findPath, overlay };

// While developing, hot reloads drop you back into the run you were testing.
if (import.meta.env.DEV) {
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
