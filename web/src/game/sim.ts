/**
 * Ebru, as mathematics. Ink floats on the bath as closed boundaries that never overlap; every action is
 * an exact, invertible deformation of the whole surface (after Jaffer & Lu, "Mathematical Marbling"):
 *
 *  - a drop of radius r at c pushes every point p outward:  p' = c + (p − c)·√(1 + r²/|p − c|²)
 *  - a stylus (or rake of tines) drawn from A to B slides points along its direction by
 *    z · g(distance from the tine) · w(position along the stroke), which is a shear and so never tears.
 *
 * Boundaries are polylines refined adaptively (in the pre-image, so curves stay smooth however far they
 * are stretched). Scoring rasterises both baths and compares the colour of every cell.
 */
export const TRAY_W = 320;
export const TRAY_H = 400;

export type Drop = { k: 'drop'; c: number; x: number; y: number; r: number };
export type Stroke = { k: 'stroke'; x1: number; y1: number; x2: number; y2: number; z: number; tines: number; gap: number; fall: number };
export type Op = Drop | Stroke;
export type Ink = { c: number; p: Float64Array };
export type Bath = Ink[];

const MAXSEG = 2.2;
const MINSEG = 0.55;
const LN2 = Math.LN2;

type Map2 = (x: number, y: number, out: Float64Array) => void;

/** Map a closed polyline through f, inserting points wherever an edge would be stretched too far. */
function mapPoly(p: Float64Array, f: Map2): Float64Array {
  const n = p.length / 2;
  const out: number[] = [];
  const fa = new Float64Array(2), fb = new Float64Array(2), first = new Float64Array(2);
  f(p[0], p[1], first);
  fa[0] = first[0]; fa[1] = first[1];
  for (let i = 0; i < n; i++) {
    const ax = p[i * 2], ay = p[i * 2 + 1];
    const j = (i + 1) % n, bx = p[j * 2], by = p[j * 2 + 1];
    if (j === 0) { fb[0] = first[0]; fb[1] = first[1]; } else f(bx, by, fb);
    out.push(fa[0], fa[1]);
    refine(ax, ay, bx, by, fa[0], fa[1], fb[0], fb[1], f, 0, out);
    fa[0] = fb[0]; fa[1] = fb[1];
  }
  return simplify(out);
}
function refine(ax: number, ay: number, bx: number, by: number, fax: number, fay: number, fbx: number, fby: number, f: Map2, depth: number, out: number[]) {
  const dx = fbx - fax, dy = fby - fay;
  if (depth >= 8 || dx * dx + dy * dy <= MAXSEG * MAXSEG) return;
  const mx = (ax + bx) / 2, my = (ay + by) / 2;
  const fm = new Float64Array(2);
  f(mx, my, fm);
  refine(ax, ay, mx, my, fax, fay, fm[0], fm[1], f, depth + 1, out);
  out.push(fm[0], fm[1]);
  refine(mx, my, bx, by, fm[0], fm[1], fbx, fby, f, depth + 1, out);
}
/** Drop points that crowd their predecessor (compressed ink would otherwise grow without limit). */
function simplify(a: number[]): Float64Array {
  const out: number[] = [a[0], a[1]];
  for (let i = 2; i < a.length; i += 2) {
    const dx = a[i] - out[out.length - 2], dy = a[i + 1] - out[out.length - 1];
    if (dx * dx + dy * dy >= MINSEG * MINSEG) out.push(a[i], a[i + 1]);
  }
  return Float64Array.from(out);
}

export function circle(x: number, y: number, r: number): Float64Array {
  const n = Math.max(28, Math.min(480, Math.ceil((2 * Math.PI * r) / 1.6)));
  const p = new Float64Array(n * 2);
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; p[i * 2] = x + Math.cos(a) * r; p[i * 2 + 1] = y + Math.sin(a) * r; }
  return p;
}

export function dropMap(cx: number, cy: number, r: number): Map2 {
  const r2 = r * r;
  return (x, y, out) => {
    let dx = x - cx, dy = y - cy;
    let d2 = dx * dx + dy * dy;
    if (d2 < 1e-12) { dx = 1e-6; dy = 0; d2 = 1e-12; }
    const k = Math.sqrt(1 + r2 / d2);
    out[0] = cx + dx * k; out[1] = cy + dy * k;
  };
}

const smooth = (a: number, b: number, t: number) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
/** The strongest combined pull of a rake, which sets how gently the stroke must start and stop. */
export function rakePeak(tines: number, gap: number, fall: number) {
  let best = 0;
  for (let s = -gap; s <= gap; s += gap / 40) {
    let g = 0;
    for (let k = 0; k < tines; k++) g += Math.exp((-Math.abs(s - (k - (tines - 1) / 2) * gap) * LN2) / fall);
    best = Math.max(best, g);
  }
  return best;
}
/** progress < 1 is the stylus partway along its path (for animation); progress = 1 is the finished stroke. */
export function strokeMap(s: Stroke, progress = 1): Map2 {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const L = Math.max(1e-6, Math.hypot(dx, dy));
  const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  const R = Math.max(26, 1.9 * s.z * rakePeak(s.tines, s.gap, s.fall));
  const Le = L * progress;
  const amp = s.z * smooth(0, 0.12, progress);
  const offs = Array.from({ length: s.tines }, (_, k) => (k - (s.tines - 1) / 2) * s.gap);
  const kf = LN2 / s.fall;
  return (x, y, out) => {
    const px = x - s.x1, py = y - s.y1;
    const t = px * ux + py * uy, q = px * nx + py * ny;
    const w = smooth(-R * 0.15, R * 0.85, t) * (1 - smooth(Le, Le + R, t));
    let g = 0;
    if (w > 0) for (const o of offs) g += Math.exp(-Math.abs(q - o) * kf);
    const d = amp * g * w;
    out[0] = x + ux * d; out[1] = y + uy * d;
  };
}

export function apply(bath: Bath, op: Op, progress = 1): Bath {
  if (op.k === 'drop') {
    const r = op.r * (progress < 1 ? progress : 1);
    if (r <= 0.01) return bath;
    const f = dropMap(op.x, op.y, r);
    return [...bath.map((ink) => ({ c: ink.c, p: mapPoly(ink.p, f) })), { c: op.c, p: circle(op.x, op.y, r) }];
  }
  const f = strokeMap(op, progress);
  return bath.map((ink) => ({ c: ink.c, p: mapPoly(ink.p, f) }));
}
export function run(ops: Op[]): Bath {
  let b: Bath = [];
  for (const o of ops) b = apply(b, o);
  return b;
}

// ── scoring ────────────────────────────────────────────────────────────
export const CELL = 4;
export const GW = TRAY_W / CELL;
export const GH = TRAY_H / CELL;

/** Paint the bath into a grid of colour labels (0 = bare bath). Later inks sit inside earlier ones, so painter's order is exact. */
export function raster(bath: Bath): Uint8Array {
  const g = new Uint8Array(GW * GH);
  const xs: number[] = [];
  for (const ink of bath) {
    const p = ink.p, n = p.length / 2, lab = ink.c + 1;
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) { const y = p[i * 2 + 1]; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    const r0 = Math.max(0, Math.floor(minY / CELL - 0.5)), r1 = Math.min(GH - 1, Math.ceil(maxY / CELL));
    for (let row = r0; row <= r1; row++) {
      const yc = (row + 0.5) * CELL;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const ay = p[i * 2 + 1], j = (i + 1) % n, by = p[j * 2 + 1];
        if ((ay <= yc) !== (by <= yc)) { const ax = p[i * 2], bx = p[j * 2]; xs.push(ax + ((yc - ay) / (by - ay)) * (bx - ax)); }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil(xs[k] / CELL - 0.5)), c1 = Math.min(GW - 1, Math.floor(xs[k + 1] / CELL - 0.5));
        for (let c = c0; c <= c1; c++) g[row * GW + c] = lab;
      }
    }
  }
  return g;
}

/** Of every cell where either bath has ink, the share where both agree on its colour. */
export const GROUND = 50;
export function likeness(a: Uint8Array, b: Uint8Array) {
  // the pre-laid ground is the same in both baths and does not count
  const lab = (g: Uint8Array, i: number) => (g[i] > GROUND ? 0 : g[i]);
  /** does colour v appear in the 3×3 neighbourhood of cell i? (a boundary one cell out is forgiven) */
  const near = (g: Uint8Array, i: number, v: number) => {
    const x = i % GW, y = (i - x) / GW;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < GW && yy < GH && lab(g, yy * GW + xx) === v) return true;
    }
    return false;
  };
  let same = 0, any = 0;
  for (let i = 0; i < a.length; i++) {
    const x = lab(a, i), y = lab(b, i);
    if (!x && !y) continue;
    any++;
    if (x === y || (near(b, i, x) && near(a, i, y))) same++;
  }
  return any ? same / any : 1;
}

export type Result = { likeness: number; stars: number; success: boolean };
export function grade(l: number, stars: [number, number, number]): Result {
  const s = l >= stars[2] ? 3 : l >= stars[1] ? 2 : l >= stars[0] ? 1 : 0;
  return { likeness: l, stars: s, success: s > 0 };
}

// ── pouring ────────────────────────────────────────────────────────────
/** Ink spreads at a steady rate while the finger is held down. */
export const POUR_R0 = 4;
export const POUR_RATE = 34;
export const POUR_MAX = 96;
export const pourRadius = (seconds: number) => Math.min(POUR_MAX, POUR_R0 + POUR_RATE * Math.max(0, seconds));
export const pourTime = (r: number) => (r - POUR_R0) / POUR_RATE;

/** A field of ground stones laid before the player begins (colours GROUND + i). */
export function groundOps(seed: number, n: number, rmin: number, rmax: number, colors: number): Drop[] {
  let st = seed >>> 0 || 1;
  const r = () => { st ^= st << 13; st >>>= 0; st ^= st >> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const pts: Drop[] = [];
  const cols = 5, rows = Math.ceil(n / cols);
  for (let i = 0; i < n; i++) {
    const cx = ((i % cols) + 0.5) / cols, cy = (Math.floor(i / cols) + 0.5) / rows;
    pts.push({ k: 'drop', c: GROUND + Math.floor(r() * colors), x: (cx + (r() - 0.5) * 0.18) * TRAY_W, y: (cy + (r() - 0.5) * 0.18) * TRAY_H, r: rmin + r() * (rmax - rmin) });
  }
  // shuffle so the stones settle unevenly, as poured by hand
  for (let i = pts.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return pts;
}

export function vertexCount(b: Bath) { return b.reduce((a, i) => a + i.p.length / 2, 0); }
