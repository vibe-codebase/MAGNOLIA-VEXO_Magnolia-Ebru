import { apply, likeness, raster, type Bath, type Op } from './sim';
import { groundOf, type Level } from './levels';

export function gauss(r: () => number) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
export function rand(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
/** A human hand: drops land a few units off, pours are a little long or short, strokes wander at both ends. */
export type Hand = { pos: number; radius: number; stroke: number };
export const STEADY: Hand = { pos: 3, radius: 2.2, stroke: 4 };

export function jitter(op: Op, h: Hand, r: () => number): Op {
  if (op.k === 'drop') return { ...op, x: op.x + gauss(r) * h.pos, y: op.y + gauss(r) * h.pos, r: Math.max(5, op.r + gauss(r) * h.radius) };
  return { ...op, x1: op.x1 + gauss(r) * h.stroke, y1: op.y1 + gauss(r) * h.stroke, x2: op.x2 + gauss(r) * h.stroke, y2: op.y2 + gauss(r) * h.stroke };
}

export function pour(l: Level, ops: Op[]): Bath {
  let b: Bath = [];
  for (const o of [...groundOf(l), ...ops]) b = apply(b, o);
  return b;
}
const targets = new Map<string, Uint8Array>();
export function targetRaster(l: Level) {
  let t = targets.get(l.id);
  if (!t) { t = raster(pour(l, l.ops)); targets.set(l.id, t); }
  return t;
}
export function likenessOf(l: Level, ops: Op[]) { return likeness(targetRaster(l), raster(pour(l, ops))); }

/** Mean likeness a hand of the given steadiness achieves over n attempts. */
export function handLikeness(l: Level, h: Hand, n = 12, seed = 1) {
  let sum = 0;
  for (let i = 0; i < n; i++) { const r = rand(seed * 7919 + i * 104729); sum += likenessOf(l, l.ops.map((o) => jitter(o, h, r))); }
  return sum / n;
}
