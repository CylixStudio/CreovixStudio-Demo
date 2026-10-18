export type LogoPalette = {
  dominant: string;
  accent: string;
  background: string;
  muted: string;
  foreground: string;
};

function toHex(r: number, g: number, b: number) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`;
}

function luminance(r: number, g: number, b: number) {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function saturation(r: number, g: number, b: number) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === 0) return 0;
  return (max - min) / max;
}

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function darken(r: number, g: number, b: number, amount: number) {
  return {
    r: mix(r, 0, amount),
    g: mix(g, 0, amount),
    b: mix(b, 0, amount),
  };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith("data:") && !src.startsWith("blob:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("logo_image_failed"));
    image.src = src;
  });
}

/**
 * Samples `avatarUrl` on a 48px canvas. Data/blob URLs work.
 * Remote HTTPS may taint the canvas (CORS) and returns null.
 */
export async function extractLogoPalette(src: string): Promise<LogoPalette | null> {
  const url = src.trim();
  if (!url || typeof document === "undefined") return null;
  try {
    const image = await loadImage(url);
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const buckets = new Map<string, { count: number; r: number; g: number; b: number; sat: number }>();

    for (let i = 0; i < pixels.length; i += 4) {
      const alpha = pixels[i + 3] ?? 0;
      if (alpha < 40) continue;
      const r = pixels[i] ?? 0;
      const g = pixels[i + 1] ?? 0;
      const b = pixels[i + 2] ?? 0;
      const key = `${r >> 4}:${g >> 4}:${b >> 4}`;
      const current = buckets.get(key);
      if (current) {
        current.count += 1;
        current.r += r;
        current.g += g;
        current.b += b;
        current.sat += saturation(r, g, b);
      } else {
        buckets.set(key, { count: 1, r, g, b, sat: saturation(r, g, b) });
      }
    }

    const ranked = [...buckets.values()]
      .map((bucket) => ({
        count: bucket.count,
        r: bucket.r / bucket.count,
        g: bucket.g / bucket.count,
        b: bucket.b / bucket.count,
        sat: bucket.sat / bucket.count,
      }))
      .sort((a, b) => b.count - a.count);

    const dominant = ranked[0];
    if (!dominant) return null;
    const accent =
      ranked.find((item) => item.sat > dominant.sat + 0.08 && item.count > 4) ??
      ranked.find((item) => Math.abs(item.r - dominant.r) + Math.abs(item.g - dominant.g) + Math.abs(item.b - dominant.b) > 80) ??
      dominant;

    const bg = darken(dominant.r, dominant.g, dominant.b, 0.62);
    const muted = {
      r: mix(accent.r, bg.r, 0.45),
      g: mix(accent.g, bg.g, 0.45),
      b: mix(accent.b, bg.b, 0.45),
    };
    const lightPage = luminance(bg.r, bg.g, bg.b) > 0.55;

    return {
      dominant: toHex(dominant.r, dominant.g, dominant.b),
      accent: toHex(accent.r, accent.g, accent.b),
      background: toHex(bg.r, bg.g, bg.b),
      muted: toHex(muted.r, muted.g, muted.b),
      foreground: lightPage ? "#1a1814" : "#f4f4f5",
    };
  } catch {
    return null;
  }
}
