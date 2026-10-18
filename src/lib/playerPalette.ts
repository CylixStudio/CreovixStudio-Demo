import { useEffect, useState } from "react";

/** Four theme colors extracted from the current track's album art. */
export type Palette = { vibrant: string; muted: string; dark: string; light: string };

export const DEFAULT_PALETTE: Palette = { vibrant: "#53fc18", muted: "#4c5568", dark: "#0b0d12", light: "#e8ecf5" };

const hex = (r: number, g: number, b: number) => `#${[r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
const lum = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sat = (r: number, g: number, b: number) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx === 0 ? 0 : (mx - mn) / mx; };
const mix = (c: [number, number, number], t: [number, number, number], k: number): [number, number, number] => [c[0] + (t[0] - c[0]) * k, c[1] + (t[1] - c[1]) * k, c[2] + (t[2] - c[2]) * k];

/** Quantizes pixels into 4-bit-per-channel buckets and picks vibrant/muted/dark/light tones. */
export function paletteFromPixels(data: Uint8ClampedArray): Palette {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3] ?? 0; if (a < 125) continue;
    const r = data[i] ?? 0, g = data[i + 1] ?? 0, b = data[i + 2] ?? 0;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const cur = buckets.get(key);
    if (cur) { cur.r += r; cur.g += g; cur.b += b; cur.n += 1; } else buckets.set(key, { r, g, b, n: 1 });
  }
  const list = [...buckets.values()].map(v => { const r = v.r / v.n, g = v.g / v.n, b = v.b / v.n; return { rgb: [r, g, b] as [number, number, number], n: v.n, l: lum(r, g, b), s: sat(r, g, b) }; });
  if (!list.length) return DEFAULT_PALETTE;
  const total = list.reduce((a, c) => a + c.n, 0);
  const best = (score: (c: (typeof list)[number]) => number) => list.reduce((a, c) => (score(c) > score(a) ? c : a));
  const vib = best(c => c.s * (1 - Math.abs(c.l - 0.55)) * (0.4 + (c.n / total)));
  const mut = best(c => (1 - c.s) * (1 - Math.abs(c.l - 0.45)) * (0.4 + (c.n / total)));
  const drk = best(c => (1 - c.l) * (0.3 + (c.n / total)));
  const lgt = best(c => c.l * (0.3 + (c.n / total)));
  return {
    vibrant: hex(...mix(vib.rgb, [255, 255, 255], vib.l < 0.35 ? 0.35 : 0.05)),
    muted: hex(...mut.rgb),
    dark: hex(...mix(drk.rgb, [8, 10, 16], 0.45)),
    light: hex(...mix(lgt.rgb, [255, 255, 255], lgt.l < 0.7 ? 0.55 : 0.15)),
  };
}

const cache = new Map<string, Palette>();

/** Loads the album art in the browser and derives its theme colors. */
export function usePlayerPalette(imageUrl: string | null | undefined): Palette {
  const [palette, setPalette] = useState<Palette>(() => (imageUrl && cache.get(imageUrl)) || DEFAULT_PALETTE);
  useEffect(() => {
    if (!imageUrl || typeof window === "undefined") { setPalette(DEFAULT_PALETTE); return; }
    const cached = cache.get(imageUrl);
    if (cached) { setPalette(cached); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement("canvas"); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, size, size);
        const next = paletteFromPixels(ctx.getImageData(0, 0, size, size).data);
        cache.set(imageUrl, next);
        if (alive) setPalette(next);
      } catch { /* tainted canvas — keep defaults */ }
    };
    img.src = imageUrl;
    return () => { alive = false; };
  }, [imageUrl]);
  return palette;
}

/** CSS custom properties consumed by every media request layout. */
export const paletteVars = (p: Palette) => ({
  "--player-color-vibrant": p.vibrant,
  "--player-color-muted": p.muted,
  "--player-color-dark": p.dark,
  "--player-color-light": p.light,
}) as React.CSSProperties;

export const PLAYER_LAYOUTS = ["VERTICAL_CARD", "COMPACT_SLIM", "MINIMAL_ROW"] as const;
export type PlayerLayout = (typeof PLAYER_LAYOUTS)[number];
export const isPlayerLayout = (v: unknown): v is PlayerLayout => PLAYER_LAYOUTS.includes(v as PlayerLayout);
export const PLAYER_LAYOUT_OPTIONS = [
  { value: "VERTICAL_CARD", label: "Vertical info card" },
  { value: "COMPACT_SLIM", label: "Compact slim bar" },
  { value: "MINIMAL_ROW", label: "Minimalist row" },
];
