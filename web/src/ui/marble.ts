import { canvas, paintBath } from '../game/art';
import { run, TRAY_W, TRAY_H, type Op } from '../game/sim';

/** Marbled paper for the buttons, made by the game's own bath: a battal ground combed into gel-git. */
export function marbleUrl(inks: string[], size: string, seed = 3) {
  let s = seed;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  const ops: Op[] = [];
  for (let i = 0; i < 110; i++) ops.push({ k: 'drop', c: i % inks.length, x: r() * TRAY_W, y: r() * TRAY_H, r: 11 + r() * 13 });
  ops.push({ k: 'stroke', x1: 0, y1: 200, x2: 320, y2: 200, z: 30, tines: 9, gap: 36, fall: 7 });
  ops.push({ k: 'stroke', x1: 160, y1: 400, x2: 160, y2: 0, z: 18, tines: 7, gap: 46, fall: 9 });
  const { c, g } = canvas(TRAY_W * 1.5, TRAY_H * 1.5);
  g.scale(1.5, 1.5);
  paintBath(g, run(ops), { size, inks }, 1.5, { rim: 0.7 });
  return c.toDataURL('image/jpeg', 0.86);
}
