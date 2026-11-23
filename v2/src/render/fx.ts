// Atmosphere and impact effects drawn over the 3D view: drifting dust, rain, embers, mist,
// and short-lived sparks for hits. One shared layer, re-parented with the 3D canvas.

export interface FxMode { floor: number; omen: string; combat: boolean }

interface Mote { x: number; y: number; vx: number; vy: number; r: number; a: number; life: number; max: number; color: string; kind: "dust" | "rain" | "ember" | "mist" | "spark" | "ring" }

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export class FxLayer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private motes: Mote[] = [];
  private bursts: Mote[] = [];
  private mode: FxMode = { floor: 1, omen: "calm", combat: false };
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private flash = 0;
  private flashColor = "255,255,255";

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.className = "fx-layer";
    this.ctx = this.canvas.getContext("2d")!;
  }

  setMode(m: FxMode) {
    const changed = m.floor !== this.mode.floor || m.omen !== this.mode.omen;
    this.mode = m;
    if (changed) this.motes = [];
  }

  /** Attach to a container (after the 3D canvas) and start animating. */
  mount(container: HTMLElement) {
    container.appendChild(this.canvas);
    if (!this.raf) this.raf = requestAnimationFrame((t) => this.loop(t));
  }

  /** Sparks and a ring at a point in container pixels. */
  burst(x: number, y: number, o: { color?: string; n?: number; power?: number; ring?: boolean } = {}) {
    const n = o.n ?? 14, p = o.power ?? 1;
    for (let i = 0; i < n; i++) {
      const ang = rand(0, Math.PI * 2), sp = rand(2, 7) * p;
      this.bursts.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 1.5, r: rand(1.5, 3.2) * p, a: 1, life: 0, max: rand(18, 34), color: o.color ?? "255,230,170", kind: "spark" });
    }
    if (o.ring !== false) this.bursts.push({ x, y, vx: 0, vy: 0, r: 8, a: 0.9, life: 0, max: 16, color: o.color ?? "255,240,200", kind: "ring" });
  }

  /** Full-screen tint flash (white for impacts, red when you are hurt). */
  pulse(color = "255,255,255", strength = 0.35) { this.flashColor = color; this.flash = strength; }

  private spawn() {
    const { floor, omen, combat } = this.mode;
    const W = this.w, H = this.h;
    const target = omen === "rain" ? 110 : omen === "fog" ? 26 : combat ? 34 : 48;
    while (this.motes.length < target) {
      let m: Mote;
      if (omen === "rain") m = { x: rand(0, W), y: rand(-H, 0), vx: -1.6, vy: rand(11, 16), r: rand(16, 28), a: rand(0.28, 0.5), life: 0, max: 200, color: "170,200,230", kind: "rain" };
      else if (omen === "fog") m = { x: rand(-100, W), y: rand(H * 0.3, H), vx: rand(0.15, 0.4), vy: rand(-0.05, 0.05), r: rand(60, 140), a: rand(0.04, 0.08), life: 0, max: rand(500, 900), color: "200,210,215", kind: "mist" };
      else if (floor === 3 || omen === "bloodmoon") m = { x: rand(0, W), y: rand(H * 0.5, H + 20), vx: rand(-0.4, 0.4), vy: rand(-1.1, -0.4), r: rand(1.8, 3.6), a: rand(0.55, 1), life: 0, max: rand(160, 320), color: omen === "bloodmoon" ? "255,90,70" : "255,150,60", kind: "ember" };
      else if (floor === 2) m = { x: rand(0, W), y: rand(0, H), vx: rand(-0.15, 0.15), vy: rand(-0.12, 0.12), r: rand(1.2, 2.6), a: rand(0.25, 0.6), life: 0, max: rand(240, 480), color: omen === "moon" ? "200,230,255" : "170,230,190", kind: "dust" };
      else m = { x: rand(0, W), y: rand(0, H), vx: rand(-0.12, 0.12), vy: rand(-0.06, 0.1), r: rand(1.2, 3), a: rand(0.3, 0.7), life: 0, max: rand(260, 520), color: omen === "moon" ? "210,225,255" : "255,215,150", kind: "dust" };
      m.life = omen === "rain" ? 0 : rand(0, m.max * 0.8);
      this.motes.push(m);
    }
  }

  private loop(t: number) {
    this.raf = 0;
    if (!this.canvas.isConnected) return;
    // ~30 fps is plenty for atmosphere and keeps the CPU quiet.
    if (t - this.last >= 32) {
      this.last = t;
      const r = this.canvas.getBoundingClientRect();
      const parent = this.canvas.parentElement!;
      const w = parent.clientWidth, h = parent.clientHeight;
      if (w !== this.w || h !== this.h) { this.w = this.canvas.width = w; this.h = this.canvas.height = h; this.motes = []; }
      void r;
      this.spawn();
      this.draw(t);
    }
    this.raf = requestAnimationFrame((tt) => this.loop(tt));
  }

  private draw(t: number) {
    const g = this.ctx, W = this.w, H = this.h;
    g.clearRect(0, 0, W, H);
    // Omen colour wash.
    const wash = this.mode.omen === "rain" ? "rgba(40,70,110,0.12)" : this.mode.omen === "moon" ? "rgba(120,160,255,0.06)" : this.mode.omen === "bloodmoon" ? "rgba(200,30,20,0.08)" : this.mode.omen === "festival" ? "rgba(255,170,80,0.05)" : "";
    if (wash) { g.fillStyle = wash; g.fillRect(0, 0, W, H); }
    for (const m of this.motes) {
      m.life++;
      m.x += m.vx + Math.sin((t / 1800) + m.y * 0.01) * (m.kind === "dust" ? 0.15 : 0);
      m.y += m.vy;
      const fade = m.kind === "rain" ? 1 : Math.sin(Math.min(1, m.life / m.max) * Math.PI);
      if (m.kind === "rain") {
        g.strokeStyle = `rgba(${m.color},${m.a})`;
        g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(m.x, m.y); g.lineTo(m.x + m.vx * 2, m.y + m.r); g.stroke();
      } else if (m.kind === "mist") {
        const gr = g.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r);
        gr.addColorStop(0, `rgba(${m.color},${m.a * fade})`); gr.addColorStop(1, `rgba(${m.color},0)`);
        g.fillStyle = gr; g.fillRect(m.x - m.r, m.y - m.r, m.r * 2, m.r * 2);
      } else {
        g.fillStyle = `rgba(${m.color},${m.a * fade})`;
        g.fillRect(Math.round(m.x), Math.round(m.y), m.r, m.r);
        if (m.kind === "ember") { g.fillStyle = `rgba(${m.color},${m.a * fade * 0.25})`; g.fillRect(Math.round(m.x) - m.r, Math.round(m.y) - m.r, m.r * 3, m.r * 3); }
      }
    }
    this.motes = this.motes.filter((m) => m.life < m.max && m.y < H + 40 && m.y > -H - 10 && m.x > -160 && m.x < W + 160);
    for (const b of this.bursts) {
      b.life++;
      const k = 1 - b.life / b.max;
      if (b.kind === "ring") {
        g.strokeStyle = `rgba(${b.color},${0.8 * k})`;
        g.lineWidth = 3 * k + 0.5;
        g.beginPath(); g.arc(b.x, b.y, b.r + b.life * 5, 0, Math.PI * 2); g.stroke();
      } else {
        b.x += b.vx; b.y += b.vy; b.vy += 0.35; b.vx *= 0.95;
        g.fillStyle = `rgba(${b.color},${k})`;
        g.fillRect(Math.round(b.x), Math.round(b.y), b.r, b.r);
      }
    }
    this.bursts = this.bursts.filter((b) => b.life < b.max);
    if (this.flash > 0.01) { g.fillStyle = `rgba(${this.flashColor},${this.flash})`; g.fillRect(0, 0, W, H); this.flash *= 0.72; }
  }
}

export const fx = new FxLayer();
