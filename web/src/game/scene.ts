import Phaser from 'phaser';
import * as A from './art';
import { groundOf, LEVELS, type Level } from './levels';
import { apply, grade, likeness, pourRadius, raster, TRAY_H, TRAY_W, type Bath, type Drop, type Op, type Result, type Stroke } from './sim';
import { sound } from '../audio/sound';

export type Finish = { level: Level; result: Result; ops: Op[]; bath: Bath };
type Hooks = {
  onFinish?: (f: Finish) => void;
  onFirstAction?: () => void;
  onStep?: (step: number) => void;
  onHaptic?: (style: 'light' | 'medium' | 'success' | 'warning') => void;
};

/** Bridge between React and the Phaser scene. */
export const studio = {
  hooks: {} as Hooks,
  scene: null as StudioScene | null,
  reducedMotion: false,
  /** likeness of the bath so far to the pattern at the same step */
  likeness: 1,
  step: 0,
  busy: false,
  menuInsets: { top: 210, bottom: 200 },
  show(mode: 'menu' | 'play', level: Level) { this.scene?.show(mode, level); },
  setPaused(p: boolean) { this.scene?.setPaused(p); },
  undo() { this.scene?.undo(); },
  setMenuInsets(top: number, bottom: number) {
    if (Math.abs(top - this.menuInsets.top) < 4 && Math.abs(bottom - this.menuInsets.bottom) < 4) return;
    this.menuInsets = { top, bottom }; if (this.scene?.isMenu()) this.scene.relayout();
  },
  /** How much room the play HUD takes (CSS px), so the tray sits between. */
  playInsets: { top: 96, bottom: 150 },
  setPlayInsets(top: number, bottom: number) {
    if (Math.abs(top - this.playInsets.top) < 4 && Math.abs(bottom - this.playInsets.bottom) < 4) return;
    this.playInsets = { top, bottom }; if (this.scene && !this.scene.isMenu()) this.scene.relayout();
  },
  debug() { return this.scene?.debugState(); },
  /** QA only: finish the piece instantly, exactly ('win') or badly ('fail'). */
  qa(kind: 'win' | 'fail') { this.scene?.qaRun(kind); },
};
(window as unknown as { __studio: typeof studio }).__studio = studio;

const W = 360;
const SHOWCASE = ['cicek-2', 'tarak-1', 'cicek-4', 'battal-8', 'tarak-5', 'cicek-3'];

type Anim =
  | { kind: 'pour'; x: number; y: number; t: number; t0: number; c: number }
  | { kind: 'stroke'; op: Stroke; t: number; dur: number }
  | { kind: 'auto-pour'; op: Drop; t: number; dur: number };

export class StudioScene extends Phaser.Scene {
  level: Level = LEVELS[0];
  private mode: 'menu' | 'play' = 'menu';
  private paused = false;
  private finished = false;
  private acted = false;
  private runId = 0;
  private texSeq = 0;
  private r = 2;
  private H = 700;
  private T!: A.Tray;
  /** history[i] is the bath after i player steps; history[0] holds just the ground */
  private history: Bath[] = [];
  private ops: Op[] = [];
  private shown: Bath = [];
  private dirty = true;
  private anim: Anim | null = null;
  private drag: { x0: number; y0: number; x1: number; y1: number } | null = null;
  private bathTex!: Phaser.Textures.CanvasTexture;
  private guide!: Phaser.GameObjects.Graphics;
  private stylus!: Phaser.GameObjects.Image;
  private printBath: Bath = [];
  private targets: Uint8Array[] = [];
  private demoWait = 0;
  private demoIdx = 0;
  private clock = 0;

  constructor() { super('studio'); }

  create() {
    studio.scene = this;
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.down(p));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.move(p));
    this.input.on('pointerup', () => this.up());
    this.input.on('pointerupoutside', () => this.up());
    this.scale.on('resize', () => this.rebuild());
    this.show('menu', LEVELS.find((l) => l.id === SHOWCASE[0])!);
  }

  isMenu() { return this.mode === 'menu'; }
  relayout() { this.rebuild(); }
  debugState() { return { mode: this.mode, step: this.ops.length, of: this.level.ops.length, finished: this.finished, likeness: studio.likeness, anim: this.anim?.kind ?? null, tray: this.T }; }
  setPaused(p: boolean) { this.paused = p; if (p) { this.drag = null; this.finishPourIfAny(); } }

  show(mode: 'menu' | 'play', level: Level) {
    this.mode = mode;
    this.level = level;
    this.paused = false; this.finished = false; this.acted = false;
    this.runId++;
    this.anim = null; this.drag = null;
    let b: Bath = [];
    for (const o of groundOf(level)) b = apply(b, o);
    this.history = [b];
    this.ops = [];
    this.shown = b;
    this.targets = [];
    this.demoWait = 0.8;
    studio.likeness = 1; studio.step = 0; studio.busy = false;
    this.rebuild();
  }

  // ── layout ──────────────────────────────────────────────────────────────
  private tray(): A.Tray {
    const k = W / Math.max(1, this.game.canvas.clientWidth || W);
    const top = this.mode === 'play' ? studio.playInsets.top * k + 16 : studio.menuInsets.top * k + 22;
    const bottom = this.mode === 'play' ? studio.playInsets.bottom * k + 18 : studio.menuInsets.bottom * k + 22;
    const avail = Math.max(160, this.H - top - bottom);
    const s = Math.min(this.mode === 'play' ? 1 : 0.86, avail / TRAY_H, 320 / TRAY_W);
    const w = TRAY_W * s, h = TRAY_H * s;
    return { x: (W - w) / 2, y: top + Math.max(0, (avail - h) / 2), k: s, w, h };
  }

  private tex(prefix: string, c: HTMLCanvasElement) { const k = `${prefix}-${++this.texSeq}`; this.textures.addCanvas(k, c); return k; }

  private rebuild() {
    const stale = this.textures.getTextureKeys().filter((k) => /-\d+$/.test(k));
    this.tweens.killAll();
    this.children.removeAll(true);
    if (stale.length) this.events.once('postrender', () => stale.forEach((k) => this.textures.exists(k) && this.textures.remove(k)));
    const pw = this.scale.width, ph = this.scale.height;
    const zoom = pw / W;
    this.r = Math.min(2, Math.max(1, zoom));
    this.H = Math.max(560, ph / zoom);
    this.cameras.main.setZoom(zoom).centerOn(W / 2, this.H / 2);
    this.cameras.main.setBackgroundColor('#0e1a1f');
    const T = (this.T = this.tray()), r = this.r;

    this.add.image(0, 0, this.tex('shop', A.workshopTexture(W, this.H, T, r, 7))).setOrigin(0, 0).setScale(1 / r);
    const key = `bath-${++this.texSeq}`;
    this.bathTex = this.textures.createCanvas(key, Math.ceil(T.w * r), Math.ceil(T.h * r))!;
    this.add.image(T.x, T.y, key).setOrigin(0, 0).setScale(1 / r);
    this.add.image(T.x, T.y, this.tex('sheen', A.sheenTexture(T.w, T.h, r))).setOrigin(0, 0).setScale(1 / r);
    this.guide = this.add.graphics();
    this.stylus = this.add.image(0, 0, this.tex('stylus', A.stylusTexture(r))).setOrigin(0.5, 1).setScale(1 / r).setVisible(false);
    if (this.finished && this.mode === 'play') this.layPaper(true);
    this.dirty = true;
    this.paint();
  }

  private paint() {
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.bathTex.context, s = this.T.k * this.r;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.bathTex.width, this.bathTex.height);
    g.setTransform(s, 0, 0, s, 0, 0);
    A.paintBath(g, this.shown, this.level.palette, s);
    this.bathTex.refresh();
  }

  // ── input ───────────────────────────────────────────────────────────────
  private toTray(p: Phaser.Input.Pointer) {
    const wp = this.cameras.main.getWorldPoint(p.x, p.y);
    return { x: (wp.x - this.T.x) / this.T.k, y: (wp.y - this.T.y) / this.T.k };
  }
  private nextOp(): Op | undefined { return this.level.ops[this.ops.length]; }

  private down(p: Phaser.Input.Pointer) {
    if (this.mode !== 'play' || this.paused || this.finished || this.anim) return;
    const op = this.nextOp();
    if (!op) return;
    const q = this.toTray(p);
    const inside = q.x >= -4 && q.y >= -4 && q.x <= TRAY_W + 4 && q.y <= TRAY_H + 4;
    if (op.k === 'drop') {
      if (!inside) return;
      this.anim = { kind: 'pour', x: Math.min(TRAY_W - 2, Math.max(2, q.x)), y: Math.min(TRAY_H - 2, Math.max(2, q.y)), t: 0, t0: performance.now(), c: op.c };
      studio.busy = true;
      sound.drip(op.c);
      sound.pour(true);
    } else {
      // strokes may begin a little outside the bath, from the rim
      if (q.x < -30 || q.y < -30 || q.x > TRAY_W + 30 || q.y > TRAY_H + 30) return;
      this.drag = { x0: q.x, y0: q.y, x1: q.x, y1: q.y };
    }
    this.firstAction();
  }
  private move(p: Phaser.Input.Pointer) {
    if (!this.drag || !p.isDown) return;
    const q = this.toTray(p);
    this.drag.x1 = q.x; this.drag.y1 = q.y;
  }
  private up() {
    if (this.anim?.kind === 'pour') { this.finishPourIfAny(); return; }
    if (!this.drag) return;
    const d = this.drag;
    this.drag = null;
    const op = this.nextOp();
    if (!op || op.k !== 'stroke' || this.paused) return;
    const len = Math.hypot(d.x1 - d.x0, d.y1 - d.y0);
    if (len < 18) return; // a tap, not a stroke
    const s: Stroke = { ...op, x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1 };
    this.startStroke(s);
  }
  private firstAction() { if (!this.acted) { this.acted = true; studio.hooks.onFirstAction?.(); } }

  private finishPourIfAny() {
    const a = this.anim;
    if (!a || a.kind !== 'pour') return;
    a.t = (performance.now() - a.t0) / 1000;
    sound.pour(false);
    const op = this.nextOp() as Drop;
    const drop: Drop = { k: 'drop', c: op.c, x: a.x, y: a.y, r: pourRadius(a.t) };
    this.anim = null;
    this.commit(drop);
  }
  private startStroke(s: Stroke) {
    const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1);
    this.anim = { kind: 'stroke', op: s, t: 0, dur: loomDur(L) };
    studio.busy = true;
    sound.stroke(L, s.tines);
  }

  private commit(op: Op) {
    const base = this.history[this.history.length - 1];
    const b = apply(base, op);
    this.history.push(b);
    this.ops.push(op);
    this.shown = b; this.dirty = true;
    studio.busy = false;
    studio.step = this.ops.length;
    if (this.mode !== 'play') return;
    studio.likeness = likeness(this.targetAt(this.ops.length), raster(b));
    studio.hooks.onStep?.(this.ops.length);
    studio.hooks.onHaptic?.('light');
    if (this.ops.length >= this.level.ops.length) this.finish();
  }

  /** Raster of the true pattern after n steps (ground included), cached. */
  private targetAt(n: number) {
    if (!this.targets[n]) {
      let b = this.history[0];
      for (const o of this.level.ops.slice(0, n)) b = apply(b, o);
      this.targets[n] = raster(b);
    }
    return this.targets[n];
  }

  undo() {
    if (this.mode !== 'play' || this.finished || this.anim || this.ops.length === 0) return;
    this.history.pop(); this.ops.pop();
    this.shown = this.history[this.history.length - 1]; this.dirty = true;
    studio.step = this.ops.length;
    studio.likeness = this.ops.length ? likeness(this.targetAt(this.ops.length), raster(this.shown)) : 1;
    studio.hooks.onStep?.(this.ops.length);
    sound.undo();
  }

  // ── finishing: lay the paper and pull the print ─────────────────────────
  private finish() {
    if (this.finished) return;
    this.finished = true;
    const result = grade(likeness(this.targetAt(this.level.ops.length), raster(this.shown)), this.level.stars);
    studio.likeness = result.likeness;
    const run = this.runId, ops = [...this.ops], bath = this.shown;
    this.printBath = bath;
    this.time.delayedCall(450, () => { if (run === this.runId) this.layPaper(false); });
    if (this.mode !== 'play') return;
    window.setTimeout(() => {
      if (run !== this.runId) return;
      sound.finish(result.stars);
      studio.hooks.onHaptic?.(result.success ? 'success' : 'warning');
    }, 1900);
    window.setTimeout(() => { if (run === this.runId) studio.hooks.onFinish?.({ level: this.level, result, ops, bath }); }, 2500);
  }

  private layPaper(instant: boolean) {
    const T = this.T, r = this.r;
    const paper = this.add.image(T.x + T.w / 2, T.y + T.h / 2, this.tex('paper', A.paperTexture(T.w, T.h, r))).setScale(1 / r);
    const printKey = this.tex('print', A.printCanvas(this.printBath, this.level.palette, T.w, T.h, r, 9));
    if (instant || studio.reducedMotion) {
      paper.setTexture(printKey).setScale(1 / r).setY(T.y + T.h / 2 - 8);
      return;
    }
    if (this.mode === 'play') sound.paper(true);
    paper.setAlpha(0).setScale(1.06 / r).setY(paper.y - 26);
    this.tweens.add({ targets: paper, alpha: 1, scale: 1 / r, y: T.y + T.h / 2, duration: 520, ease: 'Sine.out' });
    this.time.delayedCall(1100, () => {
      paper.setTexture(printKey);
      if (this.mode === 'play') sound.paper(false);
      // the bath is left nearly clean once the ink has gone to the paper
      this.shown = this.history[0]; this.dirty = true;
      this.tweens.add({ targets: paper, y: T.y + T.h / 2 - 8, scaleX: 1.02 / r, scaleY: 1.02 / r, duration: 650, ease: 'Back.out' });
    });
  }

  // ── loop ──────────────────────────────────────────────────────────────
  update(_t: number, deltaMs: number) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.clock += dt;
    if (!this.paused) {
      if (this.mode === 'menu') this.demo(dt);
      const a = this.anim;
      if (a?.kind === 'pour') {
        // pouring follows the clock, not the frame rate, so a slow frame never shortens a pour
        a.t = (performance.now() - a.t0) / 1000;
        const r = pourRadius(a.t);
        this.shown = apply(this.history[this.history.length - 1], { k: 'drop', c: a.c, x: a.x, y: a.y, r });
        this.dirty = true;
        if (r >= 96) this.finishPourIfAny();
      } else if (a?.kind === 'auto-pour') {
        a.t += dt;
        const e = Math.min(1, a.t / a.dur);
        this.shown = apply(this.history[this.history.length - 1], a.op, Math.sqrt(e));
        this.dirty = true;
        if (e >= 1) { this.anim = null; this.commit(a.op); }
      } else if (a?.kind === 'stroke') {
        a.t += dt;
        const e = Math.min(1, a.t / a.dur);
        const eased = e < 1 ? 1 - Math.pow(1 - e, 2) : 1;
        this.shown = apply(this.history[this.history.length - 1], a.op, eased);
        this.dirty = true;
        if (e >= 1) { this.anim = null; this.stylus.setVisible(false); this.commit(a.op); }
      }
    }
    this.paint();
    this.drawGuide();
  }

  /** Attract mode: work through a showcase recipe, pull the print, then the next one. */
  private demo(dt: number) {
    if (this.anim) return;
    if (this.finished) {
      this.demoWait -= dt;
      if (this.demoWait <= 0) { this.demoIdx = (this.demoIdx + 1) % SHOWCASE.length; this.show('menu', LEVELS.find((l) => l.id === SHOWCASE[this.demoIdx])!); }
      return;
    }
    this.demoWait -= dt;
    if (this.demoWait > 0) return;
    const op = this.nextOp();
    if (!op) { this.finished = false; this.finish(); this.demoWait = 4.2; return; }
    this.demoWait = 0.28;
    if (op.k === 'drop') this.anim = { kind: 'auto-pour', op, t: 0, dur: Math.max(0.25, (op.r / 34) * 0.7) };
    else this.anim = { kind: 'stroke', op, t: 0, dur: loomDur(Math.hypot(op.x2 - op.x1, op.y2 - op.y1)) };
  }

  qaRun(kind: 'win' | 'fail') {
    if (this.mode !== 'play' || this.finished) return;
    this.anim = null; this.drag = null;
    while (this.ops.length < this.level.ops.length && !this.finished) {
      const op = this.nextOp()!;
      if (kind === 'win') this.commit(op);
      else this.commit(op.k === 'drop' ? { ...op, x: TRAY_W - op.x, y: TRAY_H - op.y * 0.5, r: op.r * 0.5 } : { ...op, x1: op.x2, y1: op.y2, x2: op.x1, y2: op.y1 });
    }
  }

  // ── guides ──────────────────────────────────────────────────────────────
  private drawGuide() {
    const g = this.guide, T = this.T;
    g.clear();
    this.stylus.setVisible(false);
    if (this.finished) return;
    const X = (x: number) => T.x + x * T.k, Y = (y: number) => T.y + y * T.k;
    const a = this.anim;
    if (a?.kind === 'stroke') {
      const e = Math.min(1, a.t / a.dur), eased = 1 - Math.pow(1 - e, 2);
      const x = a.op.x1 + (a.op.x2 - a.op.x1) * eased, y = a.op.y1 + (a.op.y2 - a.op.y1) * eased;
      this.placeStylus(X(x), Y(y), a.op);
      return;
    }
    if (this.mode !== 'play') return;
    const op = this.nextOp();
    if (!op) return;
    const pulse = studio.reducedMotion ? 0.8 : 0.65 + 0.35 * Math.sin(this.clock * 4);
    const dark = isDark(this.level.palette.ground?.[0] ?? this.level.palette.size);
    const ink = dark ? 0xfff6e6 : 0x1d1712, halo = dark ? 0x000000 : 0xffffff;
    if (op.k === 'drop') {
      const col = Phaser.Display.Color.HexStringToColor(this.level.palette.inks[op.c]).color;
      if (a?.kind === 'pour') {
        // compare the spreading ink with the ring
        const rr = pourRadius(a.t);
        dashCircle(g, X(op.x), Y(op.y), op.r * T.k, 2.6, halo, 0.5);
        dashCircle(g, X(op.x), Y(op.y), op.r * T.k, 1.3, rr > op.r + 2 ? 0xd2493a : ink, 0.9);
        return;
      }
      dashCircle(g, X(op.x), Y(op.y), op.r * T.k, 2.6, halo, 0.35 * pulse);
      dashCircle(g, X(op.x), Y(op.y), op.r * T.k, 1.3, ink, 0.8 * pulse);
      g.fillStyle(halo, 0.6); g.fillCircle(X(op.x), Y(op.y), 4.4);
      g.fillStyle(col, 1); g.fillCircle(X(op.x), Y(op.y), 3.2);
    } else {
      const lines = rakeLines(op);
      for (const [x1, y1, x2, y2] of lines) {
        dashLine(g, X(x1), Y(y1), X(x2), Y(y2), 2.8, halo, 0.35 * pulse);
        dashLine(g, X(x1), Y(y1), X(x2), Y(y2), 1.3, ink, 0.85 * pulse);
        arrowHead(g, X(x1), Y(y1), X(x2), Y(y2), ink, halo, 0.9 * pulse);
      }
      g.fillStyle(halo, 0.5); g.fillCircle(X(op.x1), Y(op.y1), 5);
      g.fillStyle(ink, 0.9); g.fillCircle(X(op.x1), Y(op.y1), 3.2);
      if (this.drag) {
        const d = this.drag;
        const s: Stroke = { ...op, x1: d.x0, y1: d.y0, x2: d.x1, y2: d.y1 };
        for (const [x1, y1, x2, y2] of rakeLines(s)) { g.lineStyle(2.2, 0xd8a23c, 0.95); g.lineBetween(X(x1), Y(y1), X(x2), Y(y2)); }
        this.placeStylus(X(d.x1), Y(d.y1), s);
      }
    }
  }
  private placeStylus(x: number, y: number, s: Stroke) {
    const ang = Math.atan2(s.y2 - s.y1, s.x2 - s.x1);
    // lean the stylus back against the direction of travel, like a hand pulling it
    this.stylus.setVisible(true).setPosition(x, y).setRotation(Math.max(-0.5, Math.min(0.5, -Math.cos(ang) * 0.35)));
    if (s.tines > 1) this.stylus.setVisible(false);
    if (s.tines > 1) {
      const g = this.guide, T = this.T;
      const ux = Math.cos(ang), uy = Math.sin(ang), nx = -uy, ny = ux;
      const span = (s.tines - 1) * s.gap * T.k;
      g.lineStyle(5, 0x4a2c1a, 1); g.lineBetween(x - nx * (span / 2 + 8) - ux * 10, y - ny * (span / 2 + 8) - uy * 10, x + nx * (span / 2 + 8) - ux * 10, y + ny * (span / 2 + 8) - uy * 10);
      for (let k = 0; k < s.tines; k++) {
        const o = (k - (s.tines - 1) / 2) * s.gap * T.k;
        g.lineStyle(1.6, 0xe9eef0, 1); g.lineBetween(x + nx * o - ux * 10, y + ny * o - uy * 10, x + nx * o, y + ny * o);
      }
    }
  }
}

const loomDur = (L: number) => Math.max(0.4, Math.min(0.9, L / 420));
function isDark(hex: string) { const n = parseInt(hex.slice(1), 16); return ((n >> 16) & 255) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11 < 110; }

/** The lines each tine of a rake follows (one line for a stylus). */
function rakeLines(s: Stroke): [number, number, number, number][] {
  const L = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) || 1;
  const nx = -(s.y2 - s.y1) / L, ny = (s.x2 - s.x1) / L;
  return Array.from({ length: s.tines }, (_, k) => {
    const o = (k - (s.tines - 1) / 2) * s.gap;
    return [s.x1 + nx * o, s.y1 + ny * o, s.x2 + nx * o, s.y2 + ny * o];
  });
}
function dashCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, rad: number, w: number, color: number, alpha: number) {
  g.lineStyle(w, color, alpha);
  const n = Math.max(12, Math.round((rad * 2 * Math.PI) / 9));
  for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 2, a1 = a0 + (Math.PI * 2) / n * 0.55; g.beginPath(); g.arc(x, y, rad, a0, a1); g.strokePath(); }
}
function dashLine(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, w: number, color: number, alpha: number) {
  g.lineStyle(w, color, alpha);
  const L = Math.hypot(x2 - x1, y2 - y1), n = Math.max(1, Math.floor(L / 9));
  for (let i = 0; i < n; i++) {
    const a = i / n, b = Math.min(1, a + 0.55 / n);
    g.lineBetween(x1 + (x2 - x1) * a, y1 + (y2 - y1) * a, x1 + (x2 - x1) * b, y1 + (y2 - y1) * b);
  }
}
function arrowHead(g: Phaser.GameObjects.Graphics, x1: number, y1: number, x2: number, y2: number, color: number, halo: number, alpha: number) {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 9;
  const p = (da: number) => [x2 - Math.cos(a + da) * s, y2 - Math.sin(a + da) * s] as const;
  const [ax, ay] = p(0.45), [bx, by] = p(-0.45);
  g.fillStyle(halo, alpha * 0.5); g.fillTriangle(x2 + Math.cos(a) * 2, y2 + Math.sin(a) * 2, ax - Math.cos(a) * 1.5, ay - Math.sin(a) * 1.5, bx - Math.cos(a) * 1.5, by - Math.sin(a) * 1.5);
  g.fillStyle(color, alpha); g.fillTriangle(x2, y2, ax, ay, bx, by);
}

export function startGame(parent: HTMLElement) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: '#0e1a1f',
    scale: { mode: Phaser.Scale.NONE, width: parent.clientWidth * dpr, height: parent.clientHeight * dpr, zoom: 1 / dpr },
    render: { antialias: true, pixelArt: false, powerPreference: 'high-performance' },
    audio: { noAudio: true },
    fps: { target: 60, smoothStep: false },
    input: { activePointers: 1 },
    scene: [StudioScene],
    banner: false,
  });
  const onResize = () => {
    const d = Math.min(window.devicePixelRatio || 1, 2);
    game.scale.setZoom(1 / d);
    game.scale.resize(parent.clientWidth * d, parent.clientHeight * d);
  };
  window.addEventListener('resize', onResize);
  return () => { window.removeEventListener('resize', onResize); game.destroy(true); };
}
