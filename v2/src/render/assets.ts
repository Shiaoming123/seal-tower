const urls = import.meta.glob("../assets/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(urls)) ART[path.split("/").pop()!.replace(".webp", "")] = url;

const images: Record<string, HTMLImageElement> = {};

/** The teleport array is drawn in code: a ring of runes on the floor with a column of light. */
function portalSprite(): string {
  const c = document.createElement("canvas");
  c.width = 120; c.height = 180;
  const g = c.getContext("2d")!;
  const beam = g.createLinearGradient(0, 0, 0, 160);
  beam.addColorStop(0, "rgba(120,220,255,0)");
  beam.addColorStop(0.6, "rgba(140,230,255,0.45)");
  beam.addColorStop(1, "rgba(220,250,255,0.85)");
  g.fillStyle = beam;
  g.fillRect(30, 0, 60, 160);
  g.fillStyle = "rgba(240,255,255,0.7)";
  g.fillRect(52, 10, 16, 150);
  g.strokeStyle = "#7fe3ff"; g.lineWidth = 3;
  g.beginPath(); g.ellipse(60, 160, 56, 16, 0, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = "#c9a24e"; g.lineWidth = 2;
  g.beginPath(); g.ellipse(60, 160, 44, 11, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#e8fbff";
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.fillRect(60 + Math.cos(a) * 50 - 2, 160 + Math.sin(a) * 14 - 2, 4, 4);
  }
  for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(200,245,255,${0.4 + (i % 3) * 0.2})`; g.fillRect(36 + ((i * 37) % 48), 20 + ((i * 53) % 120), 3, 3); }
  return c.toDataURL();
}

export function loadAll(): Promise<void> {
  ART.portal = portalSprite();
  return Promise.all(Object.entries(ART).map(([id, url]) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = url;
    images[id] = img;
  }))).then(() => undefined);
}

export const image = (id: string) => images[id];

/** Darkened copies of a sprite for distance lighting, 8 levels. */
const shaded: Record<string, HTMLCanvasElement[]> = {};
export function shadedSprite(id: string, level: number): CanvasImageSource | null {
  const img = images[id];
  if (!img || !img.naturalWidth) return null;
  if (!shaded[id]) {
    shaded[id] = [];
    // Cap source size: sprites are drawn into a low-res buffer anyway.
    const scale = Math.min(1, 160 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale)), h = Math.max(1, Math.round(img.naturalHeight * scale));
    for (let i = 0; i < 8; i++) {
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      const ctx = cv.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, w, h);
      const dark = 1 - (i + 1) / 9;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(8,10,14,${1 - dark})`;
      ctx.fillRect(0, 0, w, h);
      shaded[id].push(cv);
    }
  }
  return shaded[id][Math.max(0, Math.min(7, level))];
}
