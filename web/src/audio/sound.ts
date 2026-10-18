/**
 * Ebru sound, synthesised with Web Audio: a breathy ney over a soft drone, the occasional kanun pluck,
 * and the bath itself — a drip as each colour lands, a trickle while it pours, the hiss of the stylus
 * through the size, and paper laid on and peeled from the water. Nothing is downloaded.
 */
const semis = (root: number, n: number) => root * Math.pow(2, n / 12);
// one makam-flavoured mode per chapter: Rast, Hicaz, Uşşak (approximated in twelve-tone)
const MODES = [
  { root: 196.0, scale: [0, 2, 4, 5, 7, 9, 10, 12, 14, 16] },
  { root: 220.0, scale: [0, 1, 4, 5, 7, 8, 10, 12, 13, 16] },
  { root: 207.65, scale: [0, 1, 3, 5, 7, 8, 10, 12, 13, 15] },
];

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private verb!: ConvolverNode;
  private noise!: AudioBuffer;
  private timer: number | null = null;
  private next = 0;
  private beatN = 0;
  private chapter = 0;
  private seed = 5;
  private deg = 4;
  private musicVol = 0.6;
  private sfxVol = 0.8;
  private ducked = false;
  private trickle: { src: AudioBufferSourceNode; gain: GainNode; bp: BiquadFilterNode } | null = null;

  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain(); this.master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
      this.master.connect(comp).connect(ctx.destination);
      this.music = ctx.createGain(); this.sfx = ctx.createGain();
      this.verb = ctx.createConvolver(); this.verb.buffer = this.impulse(2.6);
      const wet = ctx.createGain(); wet.gain.value = 0.35;
      this.verb.connect(wet).connect(this.master);
      this.music.connect(this.master); this.music.connect(this.verb);
      this.sfx.connect(this.master); this.sfx.connect(this.verb);
      this.noise = this.makeNoise();
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
  setVolumes(music: number, sfx: number) { this.musicVol = music; this.sfxVol = sfx; this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.musicVol * 0.55 * (this.ducked ? 0.4 : 1), t, 0.2);
    this.sfx.gain.setTargetAtTime(this.sfxVol, t, 0.05);
  }
  duck(on: boolean) { this.ducked = on; this.applyVolumes(); }
  suspend() { this.pour(false); void this.ctx?.suspend(); }
  resume() { if (this.ctx?.state === 'suspended') void this.ctx.resume(); }

  // ── music ──────────────────────────────────────────────────────────────
  startMusic(chapter: number) {
    if (!this.ctx) return;
    if (this.timer !== null && chapter === this.chapter) return;
    this.chapter = chapter;
    this.next = this.ctx.currentTime + 0.4;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 150);
  }
  private rnd() { this.seed = (this.seed * 9301 + 49297) % 233280; return this.seed / 233280; }
  private schedule() {
    const ctx = this.ctx!;
    const step = 60 / 66 / 2;
    const mode = MODES[this.chapter % MODES.length];
    while (this.next < ctx.currentTime + 0.8) {
      const t = this.next;
      if (this.beatN % 48 === 0) this.drone(t, mode.root / 2, step * 48);
      // the ney: long breathed notes, a phrase then a rest
      const inPhrase = this.beatN % 64 < 44;
      if (inPhrase && this.beatN % 4 === 0 && this.rnd() < 0.7) {
        this.deg = Math.max(0, Math.min(mode.scale.length - 1, this.deg + [-2, -1, -1, 0, 1, 1, 2][Math.floor(this.rnd() * 7)]));
        const len = step * (this.rnd() < 0.3 ? 8 : 4);
        this.ney(t, semis(mode.root, mode.scale[this.deg]), len);
      }
      // kanun: a sparse plucked answer an octave up
      if (!inPhrase && this.beatN % 2 === 0 && this.rnd() < 0.35) this.pluck(t, semis(mode.root * 2, mode.scale[Math.floor(this.rnd() * 6)]), 0.05, this.music);
      // def: a soft frame-drum heartbeat
      if (this.beatN % 16 === 0) this.def(t, true);
      else if (this.beatN % 16 === 10) this.def(t, false);
      this.next += step;
      this.beatN++;
    }
  }
  private ney(t: number, f: number, d: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.12;
    const vib = ctx.createOscillator(); vib.frequency.value = 5.2; const vg = ctx.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.008, t + d * 0.6);
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.05, t + Math.min(0.35, d * 0.3)); env.gain.setValueAtTime(0.05, t + d * 0.7); env.gain.linearRampToValueAtTime(0, t + d);
    o.connect(env); o2.connect(g2).connect(env); env.connect(this.music);
    // breath
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 2.5;
    const bg = ctx.createGain(); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(0.018, t + 0.1); bg.gain.linearRampToValueAtTime(0.006, t + d * 0.5); bg.gain.linearRampToValueAtTime(0, t + d);
    src.connect(bp).connect(bg).connect(this.music);
    for (const n of [o, o2, vib]) { n.start(t); n.stop(t + d + 0.05); }
    src.start(t, Math.random()); src.stop(t + d + 0.05);
  }
  private drone(t: number, f: number, d: number) {
    const ctx = this.ctx!;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.035, t + 2); env.gain.setValueAtTime(0.035, t + d - 1.5); env.gain.linearRampToValueAtTime(0, t + d);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    for (const [m, det] of [[1, -4], [1, 4], [1.5, 0], [2, -3]] as const) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * m; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + d + 0.05);
    }
    lp.connect(env).connect(this.music);
  }
  private pluck(t: number, f: number, vol: number, bus: GainNode) {
    const ctx = this.ctx!;
    for (const [m, a, d] of [[1, 1, 1.6], [2.002, 0.4, 0.9], [3.003, 0.15, 0.5]] as const) {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f * m;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol * a, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(bus); o.start(t); o.stop(t + d + 0.05);
    }
  }
  private def(t: number, low: boolean) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(low ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(low ? 50 : 110, t + 0.2);
    g.gain.setValueAtTime(low ? 0.09 : 0.04, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    o.connect(g).connect(this.music); o.start(t); o.stop(t + 0.45);
    this.hiss(t, 0.08, low ? 0.015 : 0.025, 1800, 1, this.music);
  }

  // ── effects ─────────────────────────────────────────────────────────────
  private hiss(t: number, dur: number, vol: number, freq: number, q = 1, bus?: GainNode) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.value = freq;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp).connect(g).connect(bus ?? this.sfx); src.start(t, Math.random()); src.stop(t + dur + 0.05);
    return bp;
  }
  tap() { if (this.ctx) this.pluck(this.ctx.currentTime, 660, 0.045, this.sfx); }
  /** A drop landing on the size: a water 'plip', pitched by colour. */
  drip(color: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = 900 + (color % 5) * 140;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f * 0.6, t); o.frequency.exponentialRampToValueAtTime(f * 1.6, t + 0.06);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.2);
  }
  /** The soft trickle while ink is poured; it deepens as the drop widens. */
  pour(on: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (on && !this.trickle) {
      const src = this.ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.value = 2400;
      const gain = this.ctx.createGain(); gain.gain.setValueAtTime(0.0001, t); gain.gain.linearRampToValueAtTime(0.05, t + 0.12);
      bp.frequency.exponentialRampToValueAtTime(700, t + 3);
      src.connect(bp).connect(gain).connect(this.sfx); src.start(t);
      this.trickle = { src, gain, bp };
    } else if (!on && this.trickle) {
      const tr = this.trickle; this.trickle = null;
      tr.gain.gain.cancelScheduledValues(t); tr.gain.gain.setTargetAtTime(0.0001, t, 0.05); tr.src.stop(t + 0.3);
      this.pluck(t, 523.25, 0.03, this.sfx);
    }
  }
  /** The stylus or comb drawn through the size. */
  stroke(len: number, tines: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, d = Math.max(0.4, Math.min(0.9, len / 420));
    const bp = this.hiss(t, d + 0.15, 0.05 + tines * 0.012, 1400, 2.2);
    bp.frequency.setValueAtTime(1800, t); bp.frequency.exponentialRampToValueAtTime(700, t + d);
  }
  undo() { if (this.ctx) { const t = this.ctx.currentTime; this.pluck(t, 392, 0.04, this.sfx); this.pluck(t + 0.08, 330, 0.04, this.sfx); } }
  paper(down: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (down) this.hiss(t, 0.6, 0.06, 500, 0.8);
    else { this.hiss(t, 0.5, 0.05, 3200, 1.5); for (let i = 0; i < 6; i++) this.hiss(t + 0.05 + Math.random() * 0.4, 0.04, 0.03, 4500 + Math.random() * 2000, 4); }
  }
  finish(stars: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const mode = MODES[this.chapter % MODES.length];
    [0, 2, 4, 6, 7].slice(0, 2 + stars).forEach((d, i) => this.pluck(t + i * 0.13, semis(mode.root * 2, mode.scale[d]), 0.09, this.sfx));
  }
  star(i: number) { if (this.ctx) this.pluck(this.ctx.currentTime, [784, 988, 1175][i] ?? 1175, 0.08, this.sfx); }

  private makeNoise() {
    const ctx = this.ctx!;
    const b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  private impulse(seconds: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    return b;
  }
}

export const sound = new Sound();
