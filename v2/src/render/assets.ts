const urls = import.meta.glob("../assets/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export const ART: Record<string, string> = {};
for (const [path, url] of Object.entries(urls)) ART[path.split("/").pop()!.replace(".webp", "")] = url;

const images: Record<string, HTMLImageElement> = {};

export function loadAll(): Promise<void> {
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
