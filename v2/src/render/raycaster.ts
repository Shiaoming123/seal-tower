// First-person grid view: textured walls, floor and ceiling casting, distance light, billboard sprites.
// Draws into a small buffer (pixel look) that CSS scales up with nearest-neighbour filtering.
import type { Dungeon } from "../game/types";
import { shadedSprite } from "./assets";
import { TEX, type Theme } from "./textures";

export const VIEW_W = 384;
export const VIEW_H = 216;

export interface Billboard { x: number; y: number; sprite: string; scale: number; bob?: boolean; glow?: string }
interface Pose { x: number; y: number; a: number }

const FOV = 0.7;

export class Raycaster {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private img: ImageData;
  private buf: Uint32Array;
  private zbuf = new Float32Array(VIEW_W);
  private dungeon: Dungeon | null = null;
  private theme: Theme | null = null;
  private sprites: Billboard[] = [];
  private pose: Pose = { x: 1.5, y: 1.5, a: 0 };
  private anim: { from: Pose; to: Pose; t0: number; dur: number; resolve: () => void; move: boolean } | null = null;
  private raf = 0;
  private idleTimer = 0;
  private bob = 0;
  private skyCache: Uint32Array | null = null;
  dim = 0;

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = VIEW_W;
    this.canvas.height = VIEW_H;
    this.canvas.className = "view3d";
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.img = this.ctx.createImageData(VIEW_W, VIEW_H);
    this.buf = new Uint32Array(this.img.data.buffer);
  }

  setScene(d: Dungeon, theme: Theme, sprites: Billboard[]) {
    if (this.theme !== theme) this.skyCache = null;
    this.dungeon = d;
    this.theme = theme;
    this.sprites = sprites;
    this.requestFrame();
  }

  setSprites(sprites: Billboard[]) { this.sprites = sprites; this.requestFrame(); }

  /** Jump without animation. */
  place(x: number, y: number, dir: number) {
    this.pose = { x: x + 0.5, y: y + 0.5, a: dirAngle(dir) };
    this.finishAnim();
    this.requestFrame();
  }

  /** Animate to a tile / facing. Resolves when done. */
  moveTo(x: number, y: number, dir: number, dur = 170): Promise<void> {
    const to = { x: x + 0.5, y: y + 0.5, a: dirAngle(dir) };
    // take the short way round
    while (to.a - this.pose.a > Math.PI) to.a -= Math.PI * 2;
    while (to.a - this.pose.a < -Math.PI) to.a += Math.PI * 2;
    this.finishAnim();
    const move = Math.abs(to.x - this.pose.x) + Math.abs(to.y - this.pose.y) > 0.01;
    return new Promise((resolve) => {
      this.anim = { from: { ...this.pose }, to, t0: performance.now(), dur, resolve, move };
      this.requestFrame();
    });
  }

  /** Resolve whatever animation is running so nobody awaiting it is left hanging. */
  private finishAnim() {
    const a = this.anim;
    this.anim = null;
    a?.resolve();
  }

  /** Small forward lurch when bumping into a wall. */
  bump(dir: number) {
    if (this.anim) return; // never interrupt a real move
    const [dx, dy] = [[0, -1], [1, 0], [0, 1], [-1, 0]][dir];
    const base = { ...this.pose };
    const to = { x: base.x + dx * 0.12, y: base.y + dy * 0.12, a: base.a };
    this.anim = { from: base, to, t0: performance.now(), dur: 90, move: false, resolve: () => {
      this.anim = { from: to, to: base, t0: performance.now(), dur: 110, move: false, resolve: () => {} };
    } };
    this.requestFrame();
  }

  start() {
    // A slow idle tick makes lantern light breathe without burning battery.
    this.idleTimer = window.setInterval(() => this.requestFrame(), 140);
  }
  stop() { clearInterval(this.idleTimer); cancelAnimationFrame(this.raf); this.raf = 0; }

  private requestFrame() {
    if (this.raf) return;
    this.raf = requestAnimationFrame((t) => { this.raf = 0; this.frame(t); });
  }

  private frame(now: number) {
    if (this.anim) {
      const k = Math.min(1, (now - this.anim.t0) / this.anim.dur);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      const { from, to } = this.anim;
      this.pose = { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, a: from.a + (to.a - from.a) * e };
      this.bob = this.anim.move ? Math.sin(k * Math.PI) * 3 : 0;
      if (k >= 1) {
        const done = this.anim;
        this.anim = null;
        this.pose.a = normalise(this.pose.a);
        done.resolve();
      }
      this.requestFrame();
    }
    this.render(now);
  }

  private render(now: number) {
    const d = this.dungeon, th = this.theme;
    if (!d || !th) return;
    const W = VIEW_W, H = VIEW_H, buf = this.buf;
    const px = this.pose.x, py = this.pose.y;
    const dirX = Math.cos(this.pose.a), dirY = Math.sin(this.pose.a);
    const planeX = -dirY * FOV, planeY = dirX * FOV;
    const pitch = Math.round(this.bob);
    const horizon = (H >> 1) + pitch;
    const flicker = 0.96 + Math.sin(now / 230) * 0.025 + Math.sin(now / 97) * 0.015;
    const [fr, fg, fb] = th.fog;
    const light = th.light * flicker;
    const shadeOf = (dist: number) => Math.min(1.05, (1.5 / (1 + dist * dist * 0.11)) * light);
    const put = (i: number, c: number, b: number) => {
      const r = c & 255, g = (c >> 8) & 255, bl = (c >> 16) & 255;
      const inv = 1 - Math.min(1, b);
      buf[i] = 0xff000000 | (clampByte(bl * b + fb * inv) << 16) | (clampByte(g * b + fg * inv) << 8) | clampByte(r * b + fr * inv);
    };

    // Sky or ceiling.
    if (th.sky) {
      if (!this.skyCache) this.skyCache = skyGradient(th.sky[0], th.sky[1]);
      for (let y = 0; y < horizon && y < H; y++) buf.fill(this.skyCache[Math.max(0, Math.min(H - 1, y + (H >> 1) - horizon))], y * W, y * W + W);
    }
    // Floor and ceiling casting.
    const rdx0 = dirX - planeX, rdy0 = dirY - planeY, rdx1 = dirX + planeX, rdy1 = dirY + planeY;
    for (let y = horizon + 1; y < H; y++) {
      const p = y - horizon;
      const rowDist = (0.5 * H) / p;
      const stepX = (rowDist * (rdx1 - rdx0)) / W, stepY = (rowDist * (rdy1 - rdy0)) / W;
      let fx = px + rowDist * rdx0, fy = py + rowDist * rdy0;
      const b = shadeOf(rowDist);
      const cy = horizon - p;
      for (let x = 0; x < W; x++) {
        const tx = (Math.floor(TEX * (fx - Math.floor(fx)))) & (TEX - 1);
        const ty = (Math.floor(TEX * (fy - Math.floor(fy)))) & (TEX - 1);
        put(y * W + x, th.floor[ty * TEX + tx], b);
        if (th.ceiling && cy >= 0) put(cy * W + x, th.ceiling[ty * TEX + tx], b * 0.8);
        fx += stepX; fy += stepY;
      }
    }
    // Walls.
    for (let x = 0; x < W; x++) {
      const cam = (2 * x) / W - 1;
      const rx = dirX + planeX * cam, ry = dirY + planeY * cam;
      let mx = Math.floor(px), my = Math.floor(py);
      const ddx = Math.abs(1 / rx), ddy = Math.abs(1 / ry);
      const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? px - mx : mx + 1 - px) * ddx;
      let sdy = (ry < 0 ? py - my : my + 1 - py) * ddy;
      let side = 0, hit = false;
      for (let i = 0; i < 64 && !hit; i++) {
        if (sdx < sdy) { sdx += ddx; mx += sx; side = 0; } else { sdy += ddy; my += sy; side = 1; }
        if (mx < 0 || my < 0 || mx >= d.w || my >= d.h || d.tiles[my * d.w + mx] === 1) hit = true;
      }
      const perp = Math.max(0.05, side === 0 ? sdx - ddx : sdy - ddy);
      this.zbuf[x] = perp;
      const lineH = H / perp;
      const top = -lineH / 2 + horizon;
      const y0 = Math.max(0, Math.floor(top)), y1 = Math.min(H - 1, Math.floor(top + lineH));
      let wallX = side === 0 ? py + perp * ry : px + perp * rx;
      wallX -= Math.floor(wallX);
      let tx = Math.floor(wallX * TEX);
      if ((side === 0 && rx > 0) || (side === 1 && ry < 0)) tx = TEX - tx - 1;
      const h = variantHash(mx, my, side);
      const tex = th.walls[h < 0.62 ? 0 : h < 0.82 ? 1 : 2] ?? th.walls[0];
      const b = shadeOf(perp) * (side === 1 ? 0.78 : 1);
      const step = TEX / lineH;
      let texPos = (y0 - top) * step;
      for (let y = y0; y <= y1; y++) {
        put(y * W + x, tex[(Math.min(TEX - 1, Math.floor(texPos)) * TEX) + tx], b);
        texPos += step;
      }
    }
    this.ctx.putImageData(this.img, 0, 0);

    // Sprites, far to near.
    const list = this.sprites.map((s) => ({ s, dx: s.x + 0.5 - px, dy: s.y + 0.5 - py }))
      .map((o) => ({ ...o, dist: o.dx * o.dx + o.dy * o.dy })).sort((a, b) => b.dist - a.dist);
    const invDet = 1 / (planeX * dirY - dirX * planeY);
    const ctx = this.ctx;
    for (const { s, dx, dy, dist } of list) {
      const tX = invDet * (dirY * dx - dirX * dy);
      const tY = invDet * (-planeY * dx + planeX * dy);
      if (tY <= 0.2) continue;
      const level = Math.round((1 - shadeOf(Math.sqrt(dist))) * 8);
      const src = shadedSprite(s.sprite, level);
      if (!src) continue;
      const sw = (src as HTMLCanvasElement).width, sh = (src as HTMLCanvasElement).height;
      const screenX = (W / 2) * (1 + tX / tY);
      const unit = H / tY;
      const bob = s.bob ? Math.sin(now / 400 + s.x * 3) * unit * 0.02 : 0;
      const hgt = unit * s.scale;
      const wid = hgt * (sw / sh);
      const floorY = horizon + unit * 0.5;
      const top = floorY - hgt - unit * 0.04 + bob;
      const left = screenX - wid / 2;
      // contact shadow
      const cx = Math.round(screenX);
      if (cx >= 0 && cx < W && tY < this.zbuf[cx]) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath();
        ctx.ellipse(screenX, floorY - unit * 0.02, wid * 0.32, unit * 0.04, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      const x0 = Math.max(0, Math.floor(left)), x1 = Math.min(W - 1, Math.ceil(left + wid));
      for (let x = x0; x <= x1; x++) {
        if (tY >= this.zbuf[x]) continue;
        const u = ((x - left) / wid) * sw;
        if (u < 0 || u >= sw) continue;
        ctx.drawImage(src, Math.floor(u), 0, 1, sh, x, top, 1, hgt);
      }
    }
    // Lantern glow and vignette.
    const g = ctx.createRadialGradient(W / 2, H * 0.62, H * 0.15, W / 2, H * 0.55, H * 0.95);
    g.addColorStop(0, "rgba(255,190,110,0.06)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    if (this.dim > 0) { ctx.fillStyle = `rgba(4,6,8,${this.dim})`; ctx.fillRect(0, 0, W, H); }
  }
}

const dirAngle = (dir: number) => ((dir - 1) * Math.PI) / 2;
const normalise = (a: number) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const clampByte = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
function variantHash(x: number, y: number, side: number) {
  let h = Math.imul(x * 73856093 ^ y * 19349663 ^ side * 83492791, 2654435761);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
function skyGradient(a: string, b: string): Uint32Array {
  const ca = parseInt(a.slice(1), 16), cb = parseInt(b.slice(1), 16);
  const out = new Uint32Array(VIEW_H);
  for (let y = 0; y < VIEW_H; y++) {
    const t = Math.min(1, y / (VIEW_H / 2));
    const r = ((ca >> 16) & 255) * (1 - t) + ((cb >> 16) & 255) * t;
    const g = ((ca >> 8) & 255) * (1 - t) + ((cb >> 8) & 255) * t;
    const bl = (ca & 255) * (1 - t) + (cb & 255) * t;
    out[y] = 0xff000000 | (clampByte(bl) << 16) | (clampByte(g) << 8) | clampByte(r);
  }
  return out;
}
