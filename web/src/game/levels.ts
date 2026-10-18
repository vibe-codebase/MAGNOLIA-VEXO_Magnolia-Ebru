import { groundOps, type Op, type Stroke } from './sim';
import type { Palette } from './art';

export type Level = {
  id: string;
  name: string;
  chapter: number;
  palette: Palette;
  ops: Op[];
  /** likeness needed for one, two and three stars */
  stars: [number, number, number];
  hint?: string;
  /** a field of pale stones poured before the player begins */
  ground?: { seed: number; n: number; rmin: number; rmax: number };
};

export const CHAPTERS = [
  { name: 'Battal', blurb: 'Stone ebru: drops of colour crowding one another on the bath.' },
  { name: 'Tarak', blurb: 'The stylus and the comb: pull the ink into hearts, chevrons and waves.' },
  { name: 'Çiçek', blurb: 'Flower ebru: tulips, carnations and hyacinths drawn out of single drops.' },
];

const C = {
  red: '#b0352b', indigo: '#26467a', ochre: '#d39b2b', teal: '#2c7c78', black: '#2a2420', rose: '#d9838c',
  leaf: '#557a36', white: '#f8f2e4', lilac: '#7d63a3', sky: '#6f9fc4', plum: '#6b2a4a', saffron: '#e7b84a', blush: '#efc7bf',
};
const SIZE = { cream: '#efe5cf', paper: '#f4ecda', sand: '#e6d6b4', blue: '#d9e1df', dusk: '#e9dccb', ink: '#24303a' };
const pal = (size: string, ...inks: string[]): Palette => ({ size, inks });
/** A palette with a stone ground: the size shows as fine veins between the pale stones. */
const palG = (size: string, ground: string[], ...inks: string[]): Palette => ({ size, inks, ground });
const G = {
  wheat: ['#cdb68c', '#f1e6cf', '#e7d6b6'] as const,
  mist: ['#8fa3a6', '#e3e9e5', '#cfdbd8'] as const,
  blush: ['#b99582', '#f2e4d5', '#e8d0c0'] as const,
  night: ['#1b2733', '#2f4152', '#3a4f5f'] as const,
  sage: ['#93a083', '#e9ead9', '#d6dcc4'] as const,
};
const ground = (g: readonly string[], ...inks: string[]) => palG(g[0], [g[1], g[2]], ...inks);
const field = (seed: number, n = 45, rmin = 25, rmax = 35) => ({ seed, n, rmin, rmax });

// ── recipe helpers ──────────────────────────────────────────────────────
const D = (c: number, x: number, y: number, r: number): Op => ({ k: 'drop', c, x, y, r });
/** Concentric drops at one spot, outermost colour first. */
const rings = (x: number, y: number, cs: number[], rs: number[]): Op[] => cs.map((c, i) => D(c, x, y, rs[i]));
const S = (x1: number, y1: number, x2: number, y2: number, z = 50, o: Partial<Pick<Stroke, 'tines' | 'gap' | 'fall'>> = {}): Op =>
  ({ k: 'stroke', x1, y1, x2, y2, z, tines: o.tines ?? 1, gap: o.gap ?? 40, fall: o.fall ?? 10 });
const rake = (x1: number, y1: number, x2: number, y2: number, tines: number, gap: number, z = 40, fall = 9) => S(x1, y1, x2, y2, z, { tines, gap, fall });
/** n strokes pointing in towards (cx, cy), starting at radius r0 and stopping at radius r1. */
const star = (cx: number, cy: number, n: number, r0: number, r1: number, z: number, a0 = -Math.PI / 2): Op[] =>
  Array.from({ length: n }, (_, i) => {
    const a = a0 + (i / n) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    return S(Math.round(cx + c * r0), Math.round(cy + s * r0), Math.round(cx + c * r1), Math.round(cy + s * r1), z);
  });
const ring = (cx: number, cy: number, n: number, rr: number, c: number, r: number, a0 = -Math.PI / 2): Op[] =>
  Array.from({ length: n }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return D(c, Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), r); });

type Draft = Omit<Level, 'stars' | 'chapter'> & { stars?: [number, number, number] };

const BATTAL: Draft[] = [
  { id: 'battal-1', name: 'First Drop', palette: pal(SIZE.cream, C.red), ops: [D(0, 160, 200, 62)],
    hint: 'Hold anywhere on the bath to pour. Let go when the ink fills the dashed ring.' },
  { id: 'battal-2', name: 'Three Rings', palette: pal(SIZE.cream, C.indigo, C.ochre, C.red), ops: rings(160, 200, [0, 1, 2, 0], [44, 40, 34, 22]),
    hint: 'Pour each new drop in the middle of the last. The older ink is pushed out into a ring.' },
  { id: 'battal-3', name: 'Twins', palette: pal(SIZE.paper, C.teal, C.red), ops: [D(0, 112, 200, 48), D(1, 214, 200, 48)],
    hint: 'A new drop shoulders its neighbours aside. Watch the first one flatten.' },
  { id: 'battal-4', name: 'Pomegranate Seeds', palette: pal(SIZE.paper, C.red, C.rose, C.plum),
    ops: [D(0, 160, 150, 40), D(1, 112, 236, 40), D(2, 210, 236, 40), D(0, 160, 212, 26)] },
  { id: 'battal-5', name: 'Two Eyes', palette: pal(SIZE.cream, C.indigo, C.white, C.black, C.sky),
    ops: [...rings(108, 190, [0, 3, 1, 2], [38, 32, 24, 12]), ...rings(214, 214, [0, 3, 1, 2], [38, 32, 24, 12])] },
  { id: 'battal-6', name: 'String of Beads', palette: ground(G.wheat, C.red, C.ochre, C.indigo), ground: field(11),
    ops: [D(0, 160, 74, 30), D(1, 160, 136, 30), D(2, 160, 200, 30), D(1, 160, 264, 30), D(0, 160, 326, 30), D(2, 160, 200, 14)],
    hint: 'The bath is laid with pale stones first. Your drops push them aside.' },
  { id: 'battal-7', name: 'River Stones', palette: ground(G.mist, C.teal, C.ochre, C.black, C.white), ground: field(23),
    ops: [D(0, 120, 130, 44), D(1, 210, 120, 40), D(2, 160, 205, 46), D(3, 92, 276, 40), D(0, 220, 268, 46), D(1, 150, 330, 38), D(3, 168, 206, 18)] },
  { id: 'battal-8', name: 'Battal', palette: ground(G.wheat, C.indigo, C.red, C.ochre, C.black), ground: field(37),
    ops: [D(0, 160, 200, 50), D(1, 80, 110, 44), D(2, 240, 110, 44), D(2, 80, 290, 44), D(1, 240, 290, 44), D(3, 160, 72, 34), D(3, 160, 330, 34),
      D(0, 52, 200, 32), D(0, 268, 200, 32), D(2, 160, 200, 26), D(1, 160, 200, 14)] },
];

const TARAK: Draft[] = [
  { id: 'tarak-1', name: 'Heart', palette: pal(SIZE.paper, C.red, C.blush, C.plum), ops: [...rings(160, 170, [0, 1, 2], [56, 40, 20]), S(160, 70, 160, 330, 64)],
    hint: 'Now the stylus. Drag a straight line along the dashed arrow and the rings follow it into a heart.' },
  { id: 'tarak-2', name: 'Two Hearts', palette: ground(G.mist, C.indigo, C.sky, C.red), ground: field(5),
    ops: [...rings(100, 170, [0, 1], [44, 26]), ...rings(220, 230, [2, 1], [44, 26]), S(100, 90, 100, 300, 56), S(220, 310, 220, 100, 56)],
    hint: 'Which way you drag matters. The point of the heart follows your finger.' },
  { id: 'tarak-3', name: 'Arrowheads', palette: ground(G.wheat, C.teal, C.ochre, C.black), ground: field(17),
    ops: [...rings(160, 90, [0, 1], [38, 22]), ...rings(160, 200, [2, 1], [38, 22]), ...rings(160, 310, [0, 1], [38, 22]), S(160, 20, 160, 380, 48)] },
  { id: 'tarak-4', name: 'Chevrons', palette: ground(G.blush, C.red, C.indigo, C.ochre), ground: field(29),
    ops: [D(0, 80, 130, 40), D(1, 160, 130, 40), D(2, 240, 130, 40), D(1, 80, 260, 40), D(2, 160, 260, 40), D(0, 240, 260, 40), rake(160, 370, 160, 30, 3, 80, 56, 12)],
    hint: 'A comb of three teeth: one drag pulls all three lines at once.' },
  { id: 'tarak-5', name: 'Ripple', palette: ground(G.mist, C.indigo, C.white, C.sky, C.teal), ground: field(41),
    ops: [...rings(160, 200, [0, 1, 2, 1, 3], [70, 60, 48, 36, 20]), S(20, 160, 300, 160, 46), S(300, 240, 20, 240, 46)] },
  { id: 'tarak-6', name: 'Gel-Git', palette: ground(G.wheat, C.red, C.ochre, C.indigo, C.white), ground: field(53),
    ops: [D(0, 160, 200, 60), D(1, 70, 110, 46), D(2, 250, 110, 46), D(2, 70, 290, 46), D(1, 250, 290, 46), D(3, 160, 200, 30), D(0, 160, 70, 34), D(0, 160, 330, 34),
      rake(10, 200, 310, 200, 5, 70, 36, 9)] },
  { id: 'tarak-7', name: 'Back and Forth', palette: ground(G.sage, C.indigo, C.red, C.white, C.ochre), ground: field(61),
    ops: [D(0, 160, 200, 74), D(1, 160, 200, 56), D(2, 160, 200, 40), D(3, 160, 200, 22), S(10, 140, 310, 140, 40), S(310, 200, 10, 200, 40), S(10, 260, 310, 260, 40)] },
  { id: 'tarak-8', name: 'Peacock', palette: ground(G.mist, C.teal, C.indigo, C.ochre, C.red), ground: field(67),
    ops: [D(0, 80, 100, 40), D(1, 240, 100, 40), D(2, 160, 160, 40), D(3, 80, 220, 40), D(0, 240, 220, 40), D(1, 160, 290, 40), D(2, 80, 330, 30), D(3, 240, 330, 30),
      rake(160, 20, 160, 380, 4, 80, 40, 10), rake(10, 200, 310, 200, 5, 64, 34, 8)] },
];

const CICEK: Draft[] = [
  { id: 'cicek-1', name: 'Tulip Bud', palette: ground(G.blush, C.red, C.rose, C.leaf), ground: field(71),
    ops: [...rings(160, 160, [0, 1, 0], [50, 36, 18]), S(160, 300, 160, 150, 70), D(2, 160, 330, 20), S(160, 380, 160, 300, 44)],
    hint: 'Start the stroke below the drop and stop in its middle. The stylus pulls the rings into petals.' },
  { id: 'cicek-2', name: 'Lale', palette: ground(G.wheat, C.red, C.saffron, C.leaf), ground: field(79),
    ops: [...rings(160, 150, [0, 1, 0], [52, 34, 16]), S(160, 70, 160, 170, 62), S(160, 290, 160, 140, 54), D(2, 160, 320, 22), S(160, 380, 160, 290, 42)] },
  { id: 'cicek-3', name: 'Carnation', palette: ground(G.sage, C.rose, C.red, C.white), ground: field(83),
    ops: [...rings(160, 200, [0, 1, 0, 2], [64, 48, 30, 14]), ...star(160, 200, 6, 130, 46, 44)] },
  { id: 'cicek-4', name: 'Daisy', palette: ground(G.night, C.white, C.saffron, C.ochre), ground: field(89),
    ops: [...ring(160, 200, 6, 64, 0, 28), ...rings(160, 200, [2, 1], [30, 18]), ...star(160, 200, 6, 140, 70, 44)] },
  { id: 'cicek-5', name: 'Hyacinth', palette: ground(G.mist, C.lilac, C.sky, C.leaf), ground: field(97),
    ops: [...rings(160, 96, [0, 1], [24, 12]), ...rings(124, 150, [0, 1], [24, 12]), ...rings(196, 150, [0, 1], [24, 12]), ...rings(160, 204, [0, 1], [24, 12]),
      S(124, 60, 124, 250, 36), S(196, 60, 196, 250, 36), S(160, 40, 160, 300, 40), D(2, 160, 320, 22), S(160, 390, 160, 300, 40)] },
  { id: 'cicek-6', name: 'Iris', palette: ground(G.blush, C.plum, C.rose, C.blush, C.leaf), ground: field(101),
    ops: [...rings(160, 170, [0, 1, 2, 1, 0], [60, 50, 40, 28, 14]), S(60, 110, 260, 230, 44), S(260, 110, 60, 230, 44), D(3, 120, 300, 22), D(3, 200, 300, 22), S(120, 360, 150, 260, 40), S(200, 360, 170, 260, 40)] },
  { id: 'cicek-7', name: 'Garden', palette: ground(G.wheat, C.red, C.saffron, C.lilac, C.leaf), ground: field(107),
    ops: [...rings(100, 140, [0, 1, 0], [38, 26, 12]), ...rings(220, 150, [2, 1, 2], [38, 26, 12]), D(3, 100, 280, 20), D(3, 220, 290, 20),
      S(100, 250, 100, 120, 50), S(220, 260, 220, 130, 50), S(100, 380, 100, 270, 40), S(220, 380, 220, 280, 40)] },
  { id: 'cicek-8', name: 'Masterpiece', palette: ground(G.night, C.red, C.saffron, C.white, C.leaf), ground: field(113),
    ops: [...rings(160, 170, [0, 1, 0, 2], [52, 40, 28, 14]), S(160, 70, 160, 180, 56), S(160, 300, 160, 150, 56),
      D(3, 112, 290, 22), D(3, 208, 290, 22), S(160, 380, 140, 280, 40), S(160, 380, 180, 280, 40)] },
];

/** Everything poured into the bath for this level: the ground first, then the recipe. */
export const groundOf = (l: Level): Op[] => (l.ground ? groundOps(l.ground.seed, l.ground.n, l.ground.rmin, l.ground.rmax, l.palette.ground?.length ?? 1) : []);

/** Star thresholds from tools/stars.ts: three for a steady hand, two partway down towards one, one between shaky and sloppy. */
const STARS: Record<string, [number, number, number]> = {
  'battal-1': [0.75, 0.86, 0.95],
  'battal-2': [0.58, 0.78, 0.95],
  'battal-3': [0.73, 0.85, 0.94],
  'battal-4': [0.63, 0.8, 0.93],
  'battal-5': [0.54, 0.76, 0.94],
  'battal-6': [0.6, 0.78, 0.93],
  'battal-7': [0.68, 0.82, 0.94],
  'battal-8': [0.66, 0.81, 0.93],
  'tarak-1': [0.65, 0.81, 0.94],
  'tarak-2': [0.6, 0.78, 0.93],
  'tarak-3': [0.57, 0.76, 0.92],
  'tarak-4': [0.65, 0.8, 0.93],
  'tarak-5': [0.65, 0.81, 0.94],
  'tarak-6': [0.67, 0.81, 0.93],
  'tarak-7': [0.68, 0.82, 0.94],
  'tarak-8': [0.63, 0.78, 0.91],
  'cicek-1': [0.58, 0.77, 0.92],
  'cicek-2': [0.56, 0.75, 0.9],
  'cicek-3': [0.6, 0.78, 0.92],
  'cicek-4': [0.54, 0.73, 0.89],
  'cicek-5': [0.44, 0.69, 0.89],
  'cicek-6': [0.58, 0.77, 0.93],
  'cicek-7': [0.54, 0.74, 0.91],
  'cicek-8': [0.58, 0.75, 0.89],
};
const finish = (d: Draft[], chapter: number): Level[] => d.map((x) => ({ ...x, chapter, stars: x.stars ?? STARS[x.id] ?? [0.6, 0.75, 0.9] }));
export const LEVELS: Level[] = [...finish(BATTAL, 0), ...finish(TARAK, 1), ...finish(CICEK, 2)];
export const levelIndex = (id: string) => LEVELS.findIndex((l) => l.id === id);
