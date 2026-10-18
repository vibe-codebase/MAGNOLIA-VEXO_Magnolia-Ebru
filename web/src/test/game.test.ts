import { describe, expect, it } from 'vitest';
import { CHAPTERS, LEVELS, groundOf } from '../game/levels';
import { apply, circle, likeness, raster, run, grade, pourRadius, pourTime, GROUND, TRAY_W, TRAY_H, vertexCount, type Bath, type Op } from '../game/sim';
import { handLikeness, likenessOf, pour, STEADY } from '../game/bot';
import { decodePrint, encodePrint, freshSave, isUnlocked, parseSave, recordResult, totalStars } from '../state/save';

const area = (p: Float64Array) => { let a = 0; for (let i = 0; i < p.length; i += 2) { const j = (i + 2) % p.length; a += p[i] * p[j + 1] - p[j] * p[i + 1]; } return Math.abs(a / 2); };

describe('marbling', () => {
  it('a drop pushes older ink outward without changing its area', () => {
    let b: Bath = [{ c: 0, p: circle(100, 200, 40) }];
    const before = area(b[0].p);
    b = apply(b, { k: 'drop', c: 1, x: 150, y: 200, r: 50 });
    expect(Math.abs(area(b[0].p) - before) / before).toBeLessThan(0.01);
    expect(b).toHaveLength(2);
    // the old ink wraps around the new drop and never overlaps it
    for (let i = 0; i < b[0].p.length; i += 2) expect(Math.hypot(b[0].p[i] - 150, b[0].p[i + 1] - 200)).toBeGreaterThan(49.9);
  });
  it('concentric drops become rings whose outer radius adds in quadrature', () => {
    const b = run([{ k: 'drop', c: 0, x: 160, y: 200, r: 30 }, { k: 'drop', c: 1, x: 160, y: 200, r: 40 }]);
    const r = Math.hypot(b[0].p[0] - 160, b[0].p[1] - 200);
    expect(r).toBeCloseTo(50, 1);
  });
  it('a stylus stroke is a shear: area is kept and nothing tears', () => {
    const b0 = run([{ k: 'drop', c: 0, x: 160, y: 200, r: 60 }, { k: 'drop', c: 1, x: 160, y: 200, r: 30 }]);
    const s: Op = { k: 'stroke', x1: 160, y1: 40, x2: 160, y2: 360, z: 64, tines: 1, gap: 40, fall: 10 };
    const b1 = apply(b0, s);
    b0.forEach((ink, i) => expect(Math.abs(area(b1[i].p) - area(ink.p)) / area(ink.p)).toBeLessThan(0.02));
    for (const ink of b1) for (let i = 0; i < ink.p.length; i += 2) {
      const j = (i + 2) % ink.p.length;
      expect(Math.hypot(ink.p[j] - ink.p[i], ink.p[j + 1] - ink.p[i + 1])).toBeLessThan(6);
    }
  });
  it('partial strokes animate smoothly into the finished stroke', () => {
    const b0 = run([{ k: 'drop', c: 0, x: 160, y: 200, r: 60 }]);
    const s: Op = { k: 'stroke', x1: 160, y1: 300, x2: 160, y2: 150, z: 60, tines: 1, gap: 40, fall: 10 };
    expect(likeness(raster(apply(b0, s, 1)), raster(apply(b0, s)))).toBe(1);
    expect(likeness(raster(apply(b0, s, 0)), raster(b0))).toBeGreaterThan(0.99);
  });
  it('scores the same bath as identical and ignores the shared ground', () => {
    const l = LEVELS.find((x) => x.ground)!;
    expect(likenessOf(l, l.ops)).toBe(1);
    const g = raster(pour(l, []));
    expect(g.some((v) => v > GROUND)).toBe(true);
    expect(likeness(g, g)).toBe(1);
    expect(likenessOf(l, l.ops.map((o) => (o.k === 'drop' ? { ...o, x: TRAY_W - o.x, r: o.r * 0.6 } : o)))).toBeLessThan(0.7);
  });
  it('pours at a steady rate, and grades by the thresholds', () => {
    expect(pourRadius(pourTime(50))).toBeCloseTo(50);
    expect(grade(0.99, [0.5, 0.7, 0.9]).stars).toBe(3);
    expect(grade(0.4, [0.5, 0.7, 0.9]).success).toBe(false);
  });
});

describe('levels', () => {
  it('has 24 named patterns, 8 per chapter, with sensible recipes', () => {
    expect(LEVELS).toHaveLength(24);
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(24);
    CHAPTERS.forEach((_, c) => expect(LEVELS.filter((l) => l.chapter === c)).toHaveLength(8));
    for (const l of LEVELS) {
      expect(l.ops.length).toBeGreaterThan(0);
      expect(l.ops.length).toBeLessThanOrEqual(16);
      expect(l.stars[0]).toBeLessThan(l.stars[1]); expect(l.stars[1]).toBeLessThan(l.stars[2]);
      for (const o of l.ops) {
        if (o.k === 'drop') {
          expect(o.r).toBeGreaterThanOrEqual(10); expect(o.r).toBeLessThanOrEqual(80);
          expect(o.x).toBeGreaterThan(0); expect(o.x).toBeLessThan(TRAY_W); expect(o.y).toBeGreaterThan(0); expect(o.y).toBeLessThan(TRAY_H);
          expect(o.c).toBeLessThan(l.palette.inks.length);
        } else expect(Math.hypot(o.x2 - o.x1, o.y2 - o.y1)).toBeGreaterThan(40);
      }
    }
    // the stroke and comb arrive in chapter two, the flowers' partial strokes in chapter three
    expect(LEVELS.filter((l) => l.chapter === 0).every((l) => l.ops.every((o) => o.k === 'drop'))).toBe(true);
  });
  it.each(LEVELS.map((l) => [l.id, l] as const))('%s marbles in good time and a steady hand earns three tulips', (_id, l) => {
    const b = pour(l, l.ops);
    expect(vertexCount(b)).toBeLessThan(20000);
    expect(groundOf(l).length).toBe(l.ground ? l.ground.n : 0);
    expect(handLikeness(l, STEADY, 6, 9)).toBeGreaterThanOrEqual(l.stars[2] - 0.015);
  });
});

describe('save', () => {
  it('round-trips prints and survives garbage', () => {
    const l = LEVELS[9];
    const ops = l.ops.map((o) => (o.k === 'drop' ? { ...o, x: o.x + 1.23 } : o));
    const back = decodePrint(l, encodePrint(ops))!;
    expect(back).toHaveLength(l.ops.length);
    expect(back[0].k === 'drop' && Math.abs(back[0].x - (ops[0] as { x: number }).x) < 0.06).toBe(true);
    expect(decodePrint(l, [1, 2, 3])).toBeNull();
    expect(decodePrint(l, 'x')).toBeNull();
    for (const raw of [null, '', '{', 'null', '[]', '{"v":9}', '{"v":1,"prints":{"battal-1":[1,"a",3]}}']) expect(parseSave(raw)).toEqual(expect.objectContaining({ v: 1 }));
    expect(parseSave('{"v":1,"prints":{"battal-1":[1,"a",3]}}').prints['battal-1']).toBeUndefined();
  });
  it('keeps the truest print and only raises stars; unlocks in order', () => {
    let s = freshSave();
    expect(isUnlocked(s, 0)).toBe(true); expect(isUnlocked(s, 1)).toBe(false);
    s = recordResult(s, 'battal-1', 2, 0.9, LEVELS[0].ops);
    s = recordResult(s, 'battal-1', 1, 0.8, LEVELS[0].ops.map((o) => ({ ...o, x: 1 } as Op)));
    expect(s.stars['battal-1']).toBe(2); expect(s.best['battal-1']).toBe(0.9);
    expect(decodePrint(LEVELS[0], s.prints['battal-1'])![0]).toEqual(LEVELS[0].ops[0]);
    expect(isUnlocked(s, 1)).toBe(true); expect(totalStars(s)).toBe(2);
    expect(recordResult(s, 'battal-2', 0, 0.2, [])).toBe(s);
    expect(parseSave(JSON.stringify(s))).toEqual(s);
  });
});
