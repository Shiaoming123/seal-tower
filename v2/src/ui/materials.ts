// Procedural material textures for the UI: rice paper, lacquered wood, cloth lining, brass trim.
// Generated at start-up into data URLs and exposed as CSS variables, so the look is
// fully original (no third-party texture packs) and costs no download.

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return [c, c.getContext("2d")!] as const;
}

let seed = 1234567;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

/** Fibres and specks on transparent, laid over a paper colour. */
function paperGrain(): string {
  const [c, g] = canvas(256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * 256, y = rnd() * 256, a = rnd() * 0.08;
    g.fillStyle = rnd() < 0.5 ? `rgba(90,60,30,${a})` : `rgba(255,250,235,${a * 1.4})`;
    g.fillRect(x, y, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  g.lineCap = "round";
  for (let i = 0; i < 160; i++) {
    const x = rnd() * 256, y = rnd() * 256, len = 6 + rnd() * 22, ang = rnd() * Math.PI;
    g.strokeStyle = `rgba(110,80,40,${0.04 + rnd() * 0.06})`;
    g.lineWidth = 0.6 + rnd() * 0.8;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(ang) * len * 0.5 + rnd() * 4, y + Math.sin(ang) * len * 0.5 + rnd() * 4, x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  return c.toDataURL();
}

/** Dark lacquered wood with horizontal grain, tileable left-right. */
function wood(base: [number, number, number], light: number): string {
  const W = 512, H = 256;
  const [c, g] = canvas(W, H);
  const img = g.createImageData(W, H);
  const d = img.data;
  const knots = Array.from({ length: 3 }, () => ({ x: rnd() * W, y: rnd() * H, r: 18 + rnd() * 26 }));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = y * 0.11 + Math.sin((x / W) * Math.PI * 2 * 3 + y * 0.02) * 2.2 + Math.sin((x / W) * Math.PI * 2 * 7) * 0.6;
    for (const k of knots) {
      const dx = Math.min(Math.abs(x - k.x), W - Math.abs(x - k.x)), dy = y - k.y;
      const dist = Math.sqrt(dx * dx * 0.25 + dy * dy);
      if (dist < k.r * 2.5) v += (k.r * 2.5 - dist) * 0.12 * Math.sin(dist * 0.5);
    }
    const ring = (Math.sin(v) + 1) / 2;
    const fine = (Math.sin(x * 0.9 + y * 3.1) + 1) * 0.02;
    const f = 0.78 + ring * 0.22 * light + fine + (rnd() - 0.5) * 0.04;
    const i = (y * W + x) * 4;
    d[i] = base[0] * f; d[i + 1] = base[1] * f; d[i + 2] = base[2] * f; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL("image/jpeg", 0.85);
}

/** Woven cloth for the inside of the bag. */
function cloth(): string {
  const [c, g] = canvas(64, 64);
  g.fillStyle = "#3a1c16";
  g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) for (let x = 0; x < 64; x += 2) {
    const over = ((x + y) / 2) % 2 === 0;
    g.fillStyle = over ? `rgba(120,50,40,${0.25 + rnd() * 0.15})` : `rgba(0,0,0,${0.15 + rnd() * 0.1})`;
    g.fillRect(x, y, 2, 2);
  }
  return c.toDataURL();
}

/** 回纹 (key fret) trim, drawn as a tileable SVG strip. */
function fret(color: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='12' viewBox='0 0 24 12'>
    <path d='M0 11 H10 V3 H4 V8 H7' fill='none' stroke='${color}' stroke-width='1.4'/>
    <path d='M12 1 H22 V9 H16 V4 H19' fill='none' stroke='${color}' stroke-width='1.4'/>
    <path d='M10 11 H12 V1' fill='none' stroke='${color}' stroke-width='1.4'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export function installMaterials() {
  const root = document.documentElement.style;
  root.setProperty("--tex-paper", `url(${paperGrain()})`);
  root.setProperty("--tex-wood", `url(${wood([92, 48, 30], 1)})`);
  root.setProperty("--tex-lacquer", `url(${wood([70, 22, 16], 0.7)})`);
  root.setProperty("--tex-cloth", `url(${cloth()})`);
  root.setProperty("--tex-fret", `url("${fret("#c9a24e")}")`);
  root.setProperty("--tex-fret-dark", `url("${fret("#7a5a2a")}")`);
}
