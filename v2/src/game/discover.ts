import type { RunState } from "./types";

/** Note something for the 图鉴 (e: enemy, g: good, r: relic, c: character, v: event). Merged into the profile on save. */
export function discover(run: RunState, key: string) {
  if (!run.discovered.includes(key)) run.discovered.push(key);
}

export const ORDER_CHARACTER: Record<string, string> = { clasp: "feixiao", lamp: "lamp", herbs: "herbs", scholar: "scholar", bell: "mayor" };
