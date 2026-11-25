// QA-001: every picture the data points at must exist in src/assets, so a typo or a missing export shows up as a
// failing test instead of a blank square in the game. Optional art (artId with a fallback) only needs its fallback.
import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARDS } from "../src/data/cards";
import { ENEMIES } from "../src/data/enemies";
import { EVENTS } from "../src/data/events";
import { GOODS } from "../src/data/goods";
import { RELICS } from "../src/data/relics";
import { CARD_ART } from "../src/ui/parts";

const have = new Set(readdirSync(new URL("../src/assets", import.meta.url)).map((f) => f.replace(/\.(webp|png|jpg)$/, "")));
const missing = (refs: [string, string | undefined][]) => refs.filter(([, id]) => id && !have.has(id)).map(([what, id]) => `${what} → ${id}`);

describe("asset references", () => {
  it("goods icons exist", () => {
    expect(missing(Object.values(GOODS).map((g) => [`goods ${g.id}`, g.icon]))).toEqual([]);
  });
  it("enemy sprites and poses exist", () => {
    expect(missing(Object.values(ENEMIES).flatMap((e) => [[`enemy ${e.id}`, e.sprite], [`enemy ${e.id} attack`, e.spriteAttack], [`enemy ${e.id} stance`, (e as { spriteStance?: string }).spriteStance]] as [string, string | undefined][]))).toEqual([]);
  });
  it("event pictures exist", () => {
    // The portal's map sprite is drawn at runtime, but the event close-up ships as a WebP.
    expect(missing(Object.values(EVENTS).map(ev => [`event ${ev.id}`, ev.sprite === "portal" ? "event-portal" : ev.sprite]))).toEqual([]);
  });
  it("relic icons exist (dedicated art or the fallback)", () => {
    expect(missing(Object.values(RELICS).filter((r) => !have.has(`relic-${r.id}`)).map((r) => [`relic ${r.id}`, r.icon]))).toEqual([]);
  });
  it("card pictures exist (dedicated art or the fallback)", () => {
    expect(missing(Object.keys(CARDS).filter((id) => !have.has(`card-${id}`)).map((id) => [`card ${id}`, CARD_ART[id] ?? "sword"]))).toEqual([]);
  });
});
