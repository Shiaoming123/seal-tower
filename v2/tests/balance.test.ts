// Plays many full runs with a simple bot and prints how far it gets.
// The bot is mediocre on purpose: a human who reads intents should do clearly better.
import { describe, expect, it } from "vitest";
import { createRun } from "../src/game/run";
import type { WeaponId } from "../src/game/types";
import { playRun } from "./bot";

const SEEDS = Number(process.env.SEEDS ?? 150);

describe("balance", () => {
  for (const weapon of ["sword", "shield", "lamp", "abacus"] as WeaponId[]) {
    it(`${weapon}: runs finish and difficulty is in a sane band`, () => {
      const floors = [0, 0, 0, 0];
      let wins = 0, stuck = 0;
      for (let seed = 1; seed <= SEEDS; seed++) {
        const res = playRun(createRun(seed * 7919, weapon, "lamp"));
        floors[res.floor]++;
        if (res.outcome === "win") wins++;
        if (res.outcome === "stuck") stuck++;
      }
      const rate = wins / SEEDS;
      console.log(`${weapon.padEnd(6)} win ${(rate * 100).toFixed(0)}%  died on floor 1/2/3: ${floors.slice(1).join("/")}  stuck ${stuck}`);
      expect(stuck).toBe(0);
      expect(rate).toBeGreaterThan(0.05);
      expect(rate).toBeLessThan(0.85);
    });
  }
});
