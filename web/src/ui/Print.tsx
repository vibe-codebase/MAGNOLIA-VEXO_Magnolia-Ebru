import { useEffect, useRef } from 'react';
import { printCanvas, canvas, paintBath, outlineBath } from '../game/art';
import { pour } from '../game/bot';
import type { Level } from '../game/levels';
import type { Op } from '../game/sim';
import { TRAY_W, TRAY_H } from '../game/sim';

const cache = new Map<string, HTMLCanvasElement>();
type Kind = 'print' | 'sketch' | 'blank';
/**
 * A pulled print on laid paper. 'print' marbles the given strokes (or the pattern itself), 'sketch' is the
 * pattern faintly pencilled for a design not yet made, and 'blank' is plain paper for a locked one.
 */
export function Print({ level, ops, kind = 'print', width, label }: { level: Level; ops?: Op[] | null; kind?: Kind; width: number; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const height = Math.round(width * (TRAY_H / TRAY_W) + width * 0.07);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const key = `${level.id}|${kind}|${width}|${dpr}|${ops ? JSON.stringify(ops.map((o) => (o.k === 'drop' ? [o.x, o.y, o.r] : [o.x1, o.y1, o.x2, o.y2]))) : 'target'}`;
    let src = cache.get(key);
    if (!src) {
      if (kind === 'print') src = printCanvas(pour(level, ops ?? level.ops), level.palette, width, height, dpr, level.id.length);
      else {
        src = printCanvas([], { size: '#f3ecdc', inks: [] }, width, height, dpr, level.id.length);
        if (kind === 'sketch') {
          const { c: sk, g } = canvas(src.width, src.height);
          g.drawImage(src, 0, 0);
          const m = Math.max(3, width * 0.035), iw = width - m * 2, ih = height - m * 2, k = Math.min(iw / TRAY_W, ih / TRAY_H);
          g.scale(dpr, dpr); g.translate(m + (iw - TRAY_W * k) / 2, m + (ih - TRAY_H * k) / 2); g.scale(k, k);
          g.globalAlpha = 0.16; paintBath(g, pour(level, level.ops).filter((i) => i.c < 50), { ...level.palette, size: '#f3ecdc' }, k * dpr, { grain: false, rim: 0 }); g.globalAlpha = 1;
          outlineBath(g, pour(level, level.ops).filter((i) => i.c < 50), 'rgba(80,60,40,0.4)', 0.8 / k, [3 / k, 3 / k]);
          src = sk;
        }
      }
      cache.set(key, src);
      if (cache.size > 80) cache.delete(cache.keys().next().value!);
    }
    c.width = src.width; c.height = src.height;
    c.getContext('2d')!.drawImage(src, 0, 0);
  }, [level, ops, kind, width, height]);
  return <canvas ref={ref} className="print" style={{ width, height }} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />;
}
