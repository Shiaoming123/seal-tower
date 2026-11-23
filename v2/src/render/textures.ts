// Procedural 64×64 pixel textures for the three floors. Kept in code so the palette stays consistent
// and every floor can be tuned without image editing.

export const TEX = 64;
export type Tex = Uint32Array;

export interface Theme {
  name: string;
  walls: Tex[];
  floor: Tex;
  ceiling: Tex | null;
  sky: [string, string] | null;
  fog: [number, number, number];
  light: number;
}

const rgb = (r: number, g: number, b: number) => (255 << 24) | (b << 16) | (g << 8) | r;
function hex(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as [number, number, number]; }

function hash(x: number, y: number, s: number) {
  let h = Math.imul(x * 374761393 + y * 668265263 + s * 2147483647, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

class Painter {
  px = new Uint32Array(TEX * TEX);
  constructor(public seed: number) {}
  set(x: number, y: number, c: [number, number, number], jitter = 0) {
    if (x < 0 || y < 0 || x >= TEX || y >= TEX) return;
    const j = jitter ? (hash(x, y, this.seed) - 0.5) * jitter : 0;
    this.px[y * TEX + x] = rgb(clamp(c[0] + j), clamp(c[1] + j), clamp(c[2] + j));
  }
  rect(x0: number, y0: number, w: number, h: number, c: [number, number, number], jitter = 0) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, c, jitter);
  }
  shade(x0: number, y0: number, w: number, h: number, f: number) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
      if (x < 0 || y < 0 || x >= TEX || y >= TEX) continue;
      const p = this.px[y * TEX + x];
      this.px[y * TEX + x] = rgb(clamp((p & 255) * f), clamp(((p >> 8) & 255) * f), clamp(((p >> 16) & 255) * f));
    }
  }
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

/** Rows of offset blocks with mortar and a highlight on the top edge. */
function blocks(p: Painter, y0: number, y1: number, bw: number, bh: number, stone: string, mortar: string, jitter = 26) {
  const s = hex(stone), m = hex(mortar);
  for (let row = 0, y = y0; y < y1; row++, y += bh) {
    const off = row % 2 ? bw / 2 : 0;
    for (let x = -off; x < TEX; x += bw) {
      const tone = 0.85 + hash(x, row, p.seed) * 0.3;
      p.rect(Math.max(0, x), y, Math.min(bw, TEX - x), Math.min(bh, y1 - y), [s[0] * tone, s[1] * tone, s[2] * tone], jitter);
      p.rect(Math.max(0, x), y, Math.min(bw, TEX - x), 1, [s[0] * tone * 1.2, s[1] * tone * 1.2, s[2] * tone * 1.2]);
      p.rect(Math.max(0, x), y + bh - 1, Math.min(bw, TEX - x), 1, m);
      if (x >= 0) p.rect(x, y, 1, Math.min(bh, y1 - y), m);
    }
  }
}

function moss(p: Painter, y0: number, y1: number, color: string, density: number) {
  const c = hex(color);
  for (let y = y0; y < y1; y++) for (let x = 0; x < TEX; x++) if (hash(x, y, p.seed + 7) < density * ((y - y0) / (y1 - y0))) p.set(x, y, c, 30);
}

function lattice(p: Painter, x0: number, y0: number, w: number, h: number, frame: string, paper: string, glow: boolean) {
  const f = hex(frame), pa = hex(paper);
  p.rect(x0, y0, w, h, pa, 14);
  if (glow) for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const dx = (x - (x0 + w / 2)) / w, dy = (y - (y0 + h / 2)) / h;
    const g = 1.25 - Math.sqrt(dx * dx + dy * dy);
    p.set(x, y, [pa[0] * g, pa[1] * g, pa[2] * g * 0.9], 8);
  }
  for (let x = x0; x < x0 + w; x += 5) p.rect(x, y0, 1, h, f);
  for (let y = y0; y < y0 + h; y += 6) p.rect(x0, y, w, 1, f);
  p.rect(x0 - 1, y0 - 1, w + 2, 2, f); p.rect(x0 - 1, y0 + h - 1, w + 2, 2, f);
  p.rect(x0 - 1, y0, 2, h, f); p.rect(x0 + w - 1, y0, 2, h, f);
}

function pillar(p: Painter, x0: number, w: number, color: string) {
  const c = hex(color);
  for (let x = x0; x < x0 + w; x++) {
    const t = (x - x0) / w;
    const f = 0.7 + Math.sin(t * Math.PI) * 0.45;
    for (let y = 0; y < TEX; y++) p.set(x, y, [c[0] * f, c[1] * f, c[2] * f], 10);
  }
}

function lantern(p: Painter, cx: number, cy: number) {
  const body = hex("#e2a04a"), rim = hex("#4a1d14"), tassel = hex("#b8322a");
  for (let y = -9; y <= 9; y++) for (let x = -7; x <= 7; x++) {
    const r = (x * x) / 49 + (y * y) / 81;
    if (r <= 1) { const g = 1.3 - r * 0.6; p.set(cx + x, cy + y, [body[0] * g, body[1] * g, body[2] * g * 0.8], 10); }
  }
  p.rect(cx - 5, cy - 10, 11, 2, rim); p.rect(cx - 5, cy + 9, 11, 2, rim);
  p.rect(cx, cy - 14, 1, 4, rim);
  p.rect(cx - 1, cy + 11, 3, 6, tassel);
  for (let y = -8; y <= 8; y += 4) p.rect(cx - 6, cy + y, 13, 1, [body[0] * 0.75, body[1] * 0.6, body[2] * 0.4]);
}

function wood(p: Painter, color: string, plank: number, vertical = false) {
  const c = hex(color);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const a = vertical ? x : y, b = vertical ? y : x;
    const n = Math.floor(a / plank);
    const tone = 0.8 + hash(n, 0, p.seed) * 0.35 + Math.sin(b * 0.4 + n * 3) * 0.04;
    const seam = a % plank === 0 ? 0.55 : 1;
    p.set(x, y, [c[0] * tone * seam, c[1] * tone * seam, c[2] * tone * seam], 12);
  }
}

function tiles(p: Painter, size: number, a: string, b: string, line: string) {
  const ca = hex(a), cb = hex(b), cl = hex(line);
  for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) {
    const tx = Math.floor(x / size), ty = Math.floor(y / size);
    const base = (tx + ty) % 2 ? ca : cb;
    const tone = 0.9 + hash(tx, ty, p.seed) * 0.2;
    p.set(x, y, x % size === 0 || y % size === 0 ? cl : [base[0] * tone, base[1] * tone, base[2] * tone], 16);
  }
}

// ---------------------------------------------------------------- floor themes

function corridorWalls(): Tex[] {
  // 照影廊: teal stone base, lacquered pillars, warm paper windows.
  const make = (variant: number) => {
    const p = new Painter(11 + variant);
    p.rect(0, 0, TEX, TEX, hex("#3b1714"), 10);
    pillar(p, 0, 7, "#8e2a1f"); pillar(p, 57, 7, "#8e2a1f");
    if (variant === 0) lattice(p, 10, 6, 44, 30, "#3a1810", "#e9c98a", true);
    else if (variant === 1) { p.rect(7, 4, 50, 34, hex("#24110d"), 12); lantern(p, 32, 22); }
    else { lattice(p, 10, 6, 20, 30, "#3a1810", "#cfb27a", false); lattice(p, 34, 6, 20, 30, "#3a1810", "#e9c98a", true); }
    p.rect(0, 0, TEX, 3, hex("#5a1f16")); p.rect(0, 38, TEX, 3, hex("#2c1410"));
    blocks(p, 41, 64, 16, 8, "#2f5552", "#162a29", 22);
    p.shade(0, 41, TEX, 2, 0.6);
    return p.px;
  };
  return [make(0), make(1), make(2)];
}

function bridgeWalls(): Tex[] {
  // 桥驿: big bluestone blocks, moss at the foot, shuttered post windows.
  const make = (variant: number) => {
    const p = new Painter(31 + variant);
    blocks(p, 0, 64, 21, 12, "#4f6470", "#26323a", 30);
    moss(p, 40, 64, "#4d6b3a", 0.35);
    if (variant === 1) {
      p.rect(16, 10, 32, 26, hex("#2b1a12"));
      const plank = hex("#6b4a2e");
      for (let x = 18; x < 47; x++) for (let y = 12; y < 35; y++) {
        const tone = (x - 18) % 5 === 0 ? 0.55 : 0.85 + hash(Math.floor(x / 5), 1, p.seed) * 0.3;
        p.set(x, y, [plank[0] * tone, plank[1] * tone, plank[2] * tone], 12);
      }
      p.rect(31, 11, 2, 24, hex("#2b1a12"));
      p.rect(22, 20, 4, 4, hex("#f0c26a")); p.rect(38, 20, 4, 4, hex("#f0c26a"));
    } else if (variant === 2) {
      lantern(p, 32, 24);
    }
    return p.px;
  };
  return [make(0), make(1), make(2)];
}

function belfryWalls(): Tex[] {
  // 钟楼: dark brick with bronze bands and bell reliefs.
  const make = (variant: number) => {
    const p = new Painter(51 + variant);
    blocks(p, 0, 64, 12, 6, "#6a2a1e", "#2a120c", 26);
    p.rect(0, 22, TEX, 4, hex("#9a7a3a"), 18); p.rect(0, 22, TEX, 1, hex("#d4b05a"));
    p.rect(0, 52, TEX, 3, hex("#7a5e2c"), 18);
    if (variant === 1) {
      const c = hex("#b08a3c");
      for (let y = 0; y < 22; y++) { const w = 4 + Math.round(y * 0.55); p.rect(32 - w, 28 + y, w * 2, 1, [c[0] * (0.8 + y / 60), c[1] * (0.8 + y / 60), c[2] * 0.9], 14); }
      p.rect(22, 49, 20, 2, hex("#5a4420"));
    } else if (variant === 2) {
      lantern(p, 20, 38); lantern(p, 44, 38);
    }
    return p.px;
  };
  return [make(0), make(1), make(2)];
}

let cache: Record<number, Theme> = {};

export function theme(floor: number): Theme {
  if (cache[floor]) return cache[floor];
  let t: Theme;
  if (floor === 1) {
    const f = new Painter(3); tiles(f, 16, "#3a4a48", "#334341", "#1d2827");
    const c = new Painter(4); wood(c, "#3a1a12", 8);
    t = { name: "照影廊", walls: corridorWalls(), floor: f.px, ceiling: c.px, sky: null, fog: [10, 14, 16], light: 1 };
  } else if (floor === 2) {
    const f = new Painter(5); wood(f, "#4a3a2c", 8, true);
    for (let y = 0; y < TEX; y++) for (let x = 0; x < TEX; x++) if (hash(x, y, 9) < 0.04) f.set(x, y, hex("#6a8aa0"), 20);
    t = { name: "桥驿", walls: bridgeWalls(), floor: f.px, ceiling: null, sky: ["#0b1630", "#1d3550"], fog: [12, 20, 34], light: 0.95 };
  } else {
    const f = new Painter(6); tiles(f, 32, "#3a2418", "#33201a", "#1a0e09");
    const c = new Painter(7); wood(c, "#2a120c", 16);
    t = { name: "钟楼", walls: belfryWalls(), floor: f.px, ceiling: c.px, sky: null, fog: [20, 8, 6], light: 0.9 };
  }
  cache[floor] = t;
  return t;
}

export function clearThemeCache() { cache = {}; }
