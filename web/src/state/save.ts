import { LEVELS, type Level } from '../game/levels';
import type { Op } from '../game/sim';

export type Settings = { music: number; sfx: number; haptics: boolean; reducedMotion: boolean };
/** Stars and best likeness per pattern, plus the best print's own strokes so the portfolio can re-marble it. */
export type Save = { v: 1; stars: Record<string, number>; best: Record<string, number>; prints: Record<string, number[]>; seenHints: string[]; settings: Settings };

const KEY = 'ebru.save.v1';
export const DEFAULT_SETTINGS: Settings = { music: 0.6, sfx: 0.8, haptics: true, reducedMotion: false };
export const freshSave = (): Save => ({ v: 1, stars: {}, best: {}, prints: {}, seenHints: [], settings: { ...DEFAULT_SETTINGS } });
const clamp01 = (n: unknown, d: number) => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : d);

const width = (op: Op) => (op.k === 'drop' ? 3 : 4);
const r1 = (n: number) => Math.round(n * 10) / 10;
/** Only where the player's hand differed is stored: drop centre and size, stroke ends. */
export function encodePrint(ops: Op[]): number[] {
  return ops.flatMap((o) => (o.k === 'drop' ? [r1(o.x), r1(o.y), r1(o.r)] : [r1(o.x1), r1(o.y1), r1(o.x2), r1(o.y2)]));
}
export function decodePrint(level: Level, data: unknown): Op[] | null {
  if (!Array.isArray(data) || !data.every((n) => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) < 2000)) return null;
  if (data.length !== level.ops.reduce((a, o) => a + width(o), 0)) return null;
  let i = 0;
  return level.ops.map((o) => {
    if (o.k === 'drop') { const op: Op = { ...o, x: data[i], y: data[i + 1], r: Math.max(1, Math.min(120, data[i + 2])) }; i += 3; return op; }
    const op: Op = { ...o, x1: data[i], y1: data[i + 1], x2: data[i + 2], y2: data[i + 3] }; i += 4; return op;
  });
}

export function parseSave(raw: string | null): Save {
  const out = freshSave();
  if (!raw) return out;
  try {
    const d = JSON.parse(raw);
    if (!d || typeof d !== 'object' || d.v !== 1) return out;
    const byId = new Map(LEVELS.map((l) => [l.id, l]));
    for (const [k, v] of Object.entries(d.stars ?? {})) if (byId.has(k) && Number.isInteger(v) && (v as number) > 0) out.stars[k] = Math.min(3, v as number);
    for (const [k, v] of Object.entries(d.best ?? {})) if (byId.has(k) && typeof v === 'number' && Number.isFinite(v)) out.best[k] = Math.min(1, Math.max(0, v));
    for (const [k, v] of Object.entries(d.prints ?? {})) { const l = byId.get(k); if (l && decodePrint(l, v)) out.prints[k] = v as number[]; }
    if (Array.isArray(d.seenHints)) out.seenHints = d.seenHints.filter((h: unknown) => typeof h === 'string' && byId.has(h));
    const s = d.settings ?? {};
    out.settings = { music: clamp01(s.music, DEFAULT_SETTINGS.music), sfx: clamp01(s.sfx, DEFAULT_SETTINGS.sfx), haptics: s.haptics !== false, reducedMotion: s.reducedMotion === true };
  } catch { /* corrupted: start fresh */ }
  return out;
}
export function loadSave(): Save { try { return parseSave(localStorage.getItem(KEY)); } catch { return freshSave(); } }
export function writeSave(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ } }

/** Record a finished print. Stars only go up; the portfolio keeps the truest print. */
export function recordResult(s: Save, id: string, stars: number, like: number, ops: Op[]): Save {
  if (stars <= 0) return s;
  const better = s.best[id] === undefined || like > s.best[id];
  return {
    ...s,
    stars: { ...s.stars, [id]: Math.max(s.stars[id] ?? 0, stars) },
    best: better ? { ...s.best, [id]: like } : s.best,
    prints: better ? { ...s.prints, [id]: encodePrint(ops) } : s.prints,
  };
}
export function isUnlocked(s: Save, index: number) { return index === 0 || (s.stars[LEVELS[index - 1].id] ?? 0) > 0; }
export const totalStars = (s: Save) => Object.values(s.stars).reduce((a, b) => a + b, 0);
