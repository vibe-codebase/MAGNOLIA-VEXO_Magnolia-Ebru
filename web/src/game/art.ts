import { TRAY_H, TRAY_W, type Bath } from './sim';

export function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return { c, g: c.getContext('2d')! };
}
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
export function mix(a: string, b: string, t: number) {
  const x = parseInt(a.slice(1), 16), y = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((x >> s) & 255) * (1 - t) + ((y >> s) & 255) * t);
  return `#${((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1)}`;
}

export type Palette = { size: string; inks: string[]; ground?: string[] };
export const inkColor = (pal: Palette, c: number) => (c >= 50 ? pal.ground?.[c - 50] ?? pal.size : pal.inks[c]);

const grainCache = new Map<string, HTMLCanvasElement>();
/** Pigment grain: soft blotches and fine speckle, multiplied over the ink so flat colour reads as paint. */
function grain(scale: number) {
  const key = String(scale);
  let c = grainCache.get(key);
  if (c) return c;
  const w = Math.ceil(TRAY_W * scale), h = Math.ceil(TRAY_H * scale);
  const { c: cv, g } = canvas(w, h);
  g.fillStyle = '#fff'; g.fillRect(0, 0, w, h);
  const r = rng(77);
  for (let i = 0; i < 200; i++) {
    const x = r() * w, y = r() * h, rad = (8 + r() * 40) * scale;
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const a = 0.012 + r() * 0.03;
    gr.addColorStop(0, `rgba(80,60,40,${a})`); gr.addColorStop(1, 'rgba(80,60,40,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  const img = g.getImageData(0, 0, w, h), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (r() - 0.5) * 16;
    d[i] = Math.max(0, Math.min(255, d[i] + n)); d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n)); d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  g.putImageData(img, 0, 0);
  // the faint peppering of ink that never quite spread
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(40,30,20,${0.05 + r() * 0.12})`; g.beginPath(); g.arc(r() * w, r() * h, (0.3 + r() * 0.8) * scale, 0, Math.PI * 2); g.fill(); }
  grainCache.set(key, cv);
  c = cv;
  return c;
}

function trace(g: CanvasRenderingContext2D, p: Float64Array) {
  g.moveTo(p[0], p[1]);
  for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]);
  g.closePath();
}

/**
 * Paint a bath (in tray units) at the context's current transform, which maps tray units to pixels by
 * `scale`. Each ink is laid flat, its rim darkened where pigment gathers, then the whole sheet is grained.
 */
export function paintBath(g: CanvasRenderingContext2D, bath: Bath, pal: Palette, scale: number, opts: { grain?: boolean; rim?: number } = {}) {
  g.save();
  g.beginPath(); g.rect(0, 0, TRAY_W, TRAY_H); g.clip();
  g.fillStyle = pal.size; g.fillRect(0, 0, TRAY_W, TRAY_H);
  const rim = opts.rim ?? 1;
  g.lineJoin = 'round';
  for (const ink of bath) {
    const col = inkColor(pal, ink.c);
    g.beginPath(); trace(g, ink.p);
    g.fillStyle = col; g.fill();
    if (rim > 0) {
      g.strokeStyle = hexA(mix(col, '#1a1410', 0.45), 0.55 * rim); g.lineWidth = Math.max(0.6, 1.3 / Math.max(1, scale / 2)); g.stroke();
    }
  }
  if (opts.grain !== false) {
    g.globalCompositeOperation = 'multiply';
    g.drawImage(grain(Math.min(2, scale)), 0, 0, TRAY_W, TRAY_H);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

/** Thin dashed outline of a bath's boundaries, used as the faint guide of the finished pattern. */
export function outlineBath(g: CanvasRenderingContext2D, bath: Bath, color: string, width: number, dash: number[]) {
  g.save();
  g.beginPath(); g.rect(0, 0, TRAY_W, TRAY_H); g.clip();
  g.strokeStyle = color; g.lineWidth = width; g.setLineDash(dash); g.lineJoin = 'round';
  for (const ink of bath) { g.beginPath(); trace(g, ink.p); g.stroke(); }
  g.restore();
}

/** A finished print: the bath on laid paper with a deckled edge and a soft shadow. */
export function printCanvas(bath: Bath, pal: Palette, w: number, h: number, dpr: number, seed = 3) {
  const { c, g } = canvas(w * dpr, h * dpr);
  g.scale(dpr, dpr);
  const r = rng(seed);
  const m = Math.max(3, w * 0.035);
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.45)'; g.shadowBlur = m * 1.6; g.shadowOffsetY = m * 0.6;
  g.fillStyle = '#f3ecdc';
  deckle(g, m * 0.4, m * 0.4, w - m * 0.8, h - m * 0.8, r);
  g.fill();
  g.restore();
  const iw = w - m * 2, ih = h - m * 2, k = Math.min(iw / TRAY_W, ih / TRAY_H);
  g.save();
  g.translate(m + (iw - TRAY_W * k) / 2, m + (ih - TRAY_H * k) / 2);
  g.scale(k, k);
  paintBath(g, bath, pal, k * dpr, { rim: 0.8 });
  g.restore();
  return c;
}
function deckle(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: () => number) {
  const j = Math.max(0.6, w * 0.006);
  const pts: [number, number][] = [];
  const n = 26;
  for (let i = 0; i < n; i++) pts.push([x + (w * i) / n, y + (r() - 0.5) * j]);
  for (let i = 0; i < n; i++) pts.push([x + w + (r() - 0.5) * j, y + (h * i) / n]);
  for (let i = 0; i < n; i++) pts.push([x + w - (w * i) / n, y + h + (r() - 0.5) * j]);
  for (let i = 0; i < n; i++) pts.push([x + (r() - 0.5) * j, y + h - (h * i) / n]);
  g.beginPath(); pts.forEach(([a, b], i) => (i ? g.lineTo(a, b) : g.moveTo(a, b))); g.closePath();
}

// ── workshop ──────────────────────────────────────────────────────────────
export type Tray = { x: number; y: number; k: number; w: number; h: number };

/** Dark tiled workshop wall with a pool of lamplight over the trough. */
export function workshopTexture(W: number, H: number, t: Tray, r: number, seed: number) {
  const { c, g } = canvas(W * r, H * r);
  g.scale(r, r);
  g.fillStyle = '#0e1a1f'; g.fillRect(0, 0, W, H);
  // İznik-ish tile lattice, barely there
  const rand = rng(seed);
  g.strokeStyle = 'rgba(160,200,200,0.045)'; g.lineWidth = 1;
  const s = 44;
  for (let y = -s; y < H + s; y += s) for (let x = -s; x < W + s; x += s) {
    g.beginPath(); g.moveTo(x + s / 2, y); g.lineTo(x + s, y + s / 2); g.lineTo(x + s / 2, y + s); g.lineTo(x, y + s / 2); g.closePath(); g.stroke();
    g.beginPath(); g.arc(x + s / 2, y + s / 2, 5, 0, Math.PI * 2); g.stroke();
  }
  const cx = t.x + t.w / 2, cy = t.y + t.h * 0.45;
  const lamp = g.createRadialGradient(cx, cy, 10, cx, cy, Math.max(W, H) * 0.7);
  lamp.addColorStop(0, 'rgba(255,214,150,0.22)'); lamp.addColorStop(0.45, 'rgba(255,190,120,0.06)'); lamp.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = lamp; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(255,240,220,${rand() * 0.03})`; g.fillRect(rand() * W, rand() * H, 1, 1); }
  // the trough: walnut frame, copper lip, cast shadow
  const f = 13;
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 26; g.shadowOffsetY = 12;
  g.fillStyle = '#3b2416'; roundRect(g, t.x - f, t.y - f, t.w + f * 2, t.h + f * 2, 10); g.fill();
  g.restore();
  const wood = g.createLinearGradient(0, t.y - f, 0, t.y + t.h + f);
  wood.addColorStop(0, '#6a4128'); wood.addColorStop(0.5, '#4a2c1a'); wood.addColorStop(1, '#2e1b10');
  g.fillStyle = wood; roundRect(g, t.x - f, t.y - f, t.w + f * 2, t.h + f * 2, 10); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.8;
  for (let i = 0; i < 40; i++) {
    const yy = t.y - f + rand() * (t.h + f * 2);
    g.beginPath(); g.moveTo(t.x - f + 2, yy); g.bezierCurveTo(t.x - f / 2, yy + 3, t.x - f / 2, yy - 3, t.x - 1, yy + rand() * 2); g.stroke();
    g.beginPath(); g.moveTo(t.x + t.w + 1, yy); g.bezierCurveTo(t.x + t.w + f / 2, yy - 3, t.x + t.w + f / 2, yy + 3, t.x + t.w + f - 2, yy); g.stroke();
  }
  g.strokeStyle = 'rgba(255,220,180,0.25)'; g.lineWidth = 1; roundRect(g, t.x - f + 1, t.y - f + 1, t.w + f * 2 - 2, t.h + f * 2 - 2, 9); g.stroke();
  const cu = g.createLinearGradient(t.x, t.y, t.x + t.w, t.y + t.h);
  cu.addColorStop(0, '#d79a5c'); cu.addColorStop(0.5, '#8a4f28'); cu.addColorStop(1, '#c48450');
  g.strokeStyle = cu; g.lineWidth = 3.2; g.strokeRect(t.x - 1.6, t.y - 1.6, t.w + 3.2, t.h + 3.2);
  return c;
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

/** Wet sheen: a soft reflected window and inner shadow along the copper lip. */
export function sheenTexture(w: number, h: number, r: number) {
  const { c, g } = canvas(w * r, h * r);
  g.scale(r, r);
  const s = g.createLinearGradient(0, 0, w, h);
  s.addColorStop(0, 'rgba(255,255,255,0.14)'); s.addColorStop(0.18, 'rgba(255,255,255,0.03)'); s.addColorStop(0.5, 'rgba(255,255,255,0)'); s.addColorStop(0.85, 'rgba(255,255,255,0.03)'); s.addColorStop(1, 'rgba(255,255,255,0.08)');
  g.fillStyle = s; g.fillRect(0, 0, w, h);
  const e = 14;
  for (const [x0, y0, x1, y1, x, y, ww, hh] of [[0, 0, 0, e, 0, 0, w, e], [0, h, 0, h - e, 0, h - e, w, e], [0, 0, e, 0, 0, 0, e, h], [w, 0, w - e, 0, w - e, 0, e, h]] as const) {
    const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(30,15,5,0.28)'); gr.addColorStop(1, 'rgba(30,15,5,0)');
    g.fillStyle = gr; g.fillRect(x, y, ww, hh);
  }
  return c;
}

/** A sheet of laid paper (chain and laid lines) for pulling the print. */
export function paperTexture(w: number, h: number, r: number, seed = 5) {
  const { c, g } = canvas(w * r, h * r);
  g.scale(r, r);
  g.fillStyle = '#f5eedd'; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(140,110,70,0.08)'; g.lineWidth = 0.5;
  for (let y = 0; y < h; y += 2.2) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  g.strokeStyle = 'rgba(140,110,70,0.12)'; g.lineWidth = 0.8;
  for (let x = 12; x < w; x += 26) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  const rand = rng(seed);
  for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(120,90,60,${rand() * 0.12})`; g.lineWidth = 0.4; const x = rand() * w, y = rand() * h, a = rand() * 6; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); g.stroke(); }
  return c;
}

/** The stylus: a long thin awl with a turned wooden handle, drawn pointing down (tip at the bottom centre). */
export function stylusTexture(r: number) {
  const w = 14, h = 96;
  const { c, g } = canvas(w * r, h * r);
  g.scale(r, r);
  const metal = g.createLinearGradient(5, 0, 9, 0); metal.addColorStop(0, '#9aa3a6'); metal.addColorStop(0.5, '#eef2f2'); metal.addColorStop(1, '#6f787b');
  g.fillStyle = metal; g.beginPath(); g.moveTo(5.6, 48); g.lineTo(8.4, 48); g.lineTo(7, h - 1); g.closePath(); g.fill();
  const wood = g.createLinearGradient(2, 0, 12, 0); wood.addColorStop(0, '#5a3218'); wood.addColorStop(0.45, '#b77a45'); wood.addColorStop(1, '#4a2812');
  g.fillStyle = wood; g.beginPath(); g.ellipse(7, 26, 5, 24, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#c99a4a'; g.fillRect(4.5, 47, 5, 2.5);
  return c;
}
export function dotTexture(color: string, rad: number, r: number) {
  const { c, g } = canvas(rad * 2 * r + 2, rad * 2 * r + 2);
  const gr = g.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, rad * r);
  gr.addColorStop(0, color); gr.addColorStop(1, hexA(color.length === 7 ? color : '#ffffff', 0));
  g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  return c;
}
