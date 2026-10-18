import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CHAPTERS, LEVELS, levelIndex, type Level } from './game/levels';
import { studio, startGame, type Finish } from './game/scene';
import { sound } from './audio/sound';
import { haptic, onNative, toNative } from './bridge';
import { decodePrint, freshSave, isUnlocked, loadSave, recordResult, totalStars, writeSave, type Save } from './state/save';
import { Print } from './ui/Print';
import * as I from './ui/icons';

type Screen = 'home' | 'folio' | 'play' | 'settings';

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [save, setSave] = useState<Save>(() => loadSave());
  const [screen, setScreen] = useState<Screen>('home');
  const [chapter, setChapter] = useState(0);
  const [level, setLevel] = useState<Level>(LEVELS[0]);
  const [paused, setPaused] = useState(false);
  const [finish, setFinish] = useState<Finish | null>(null);
  const [coach, setCoach] = useState(false);
  const [settingsFrom, setSettingsFrom] = useState<Screen>('home');
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    if (!host.current) return;
    studio.reducedMotion = save.settings.reducedMotion;
    return startGame(host.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { writeSave(save); }, [save]);
  useEffect(() => {
    sound.setVolumes(save.settings.music, save.settings.sfx);
    studio.reducedMotion = save.settings.reducedMotion;
    document.documentElement.dataset.motion = save.settings.reducedMotion ? 'reduced' : 'full';
  }, [save.settings]);

  const buzz = useCallback((s: 'light' | 'medium' | 'success' | 'warning') => haptic(s, saveRef.current.settings.haptics), []);
  useEffect(() => {
    const unlock = () => { sound.unlock(); sound.startMusic(chapter); };
    window.addEventListener('pointerdown', unlock, { once: true });
    return () => window.removeEventListener('pointerdown', unlock);
  }, [chapter]);

  const startLevel = useCallback((l: Level) => {
    sound.unlock(); sound.startMusic(l.chapter); sound.duck(true);
    setLevel(l); setChapter(l.chapter); setFinish(null); setPaused(false);
    setCoach(Boolean(l.hint) && !saveRef.current.seenHints.includes(l.id));
    setScreen('play');
    studio.show('play', l);
  }, []);

  useEffect(() => {
    studio.hooks = {
      onFinish: (f) => {
        setFinish(f);
        if (f.result.success) setSave((s) => recordResult(s, f.level.id, f.result.stars, f.result.likeness, f.ops));
      },
      onFirstAction: () => { setCoach(false); setSave((s) => (s.seenHints.includes(level.id) ? s : { ...s, seenHints: [...s.seenHints, level.id] })); },
      onHaptic: buzz,
    };
  }, [buzz, level.id]);

  const showMenu = useCallback(() => { if (!studio.scene?.isMenu()) studio.show('menu', LEVELS.find((l) => l.id === 'cicek-2')!); }, []);
  const goHome = useCallback(() => { setScreen('home'); setFinish(null); setPaused(false); sound.duck(false); showMenu(); }, [showMenu]);
  const goFolio = useCallback(() => { setScreen('folio'); setFinish(null); setPaused(false); sound.duck(false); showMenu(); }, [showMenu]);
  const pause = useCallback((p: boolean) => { setPaused(p); studio.setPaused(p); }, []);

  useEffect(() => onNative((e) => {
    if (e.type === 'native.lifecycle') {
      if (e.state === 'background') { sound.suspend(); if (screen === 'play' && !finish) pause(true); }
      else sound.resume();
      return;
    }
    if (screen === 'play') { if (finish) goFolio(); else if (!paused) pause(true); else goFolio(); }
    else if (screen === 'folio') goHome();
    else if (screen === 'settings') setScreen(settingsFrom);
    else toNative({ type: 'exit' });
  }), [screen, paused, finish, pause, goHome, goFolio, settingsFrom]);

  useEffect(() => {
    const vis = () => { if (document.hidden) { sound.suspend(); if (screen === 'play' && !finish) pause(true); } else sound.resume(); };
    document.addEventListener('visibilitychange', vis);
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && screen === 'play' && !finish) pause(!paused);
      if ((e.key === 'z' || e.key === 'Backspace') && screen === 'play' && !paused && !finish) studio.undo();
    };
    window.addEventListener('keydown', key);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('keydown', key); };
  }, [screen, paused, finish, pause]);

  const nextLevel = useMemo(() => { const i = levelIndex(level.id); return i >= 0 && i < LEVELS.length - 1 ? LEVELS[i + 1] : null; }, [level]);
  const firstOpen = useMemo(() => { const i = LEVELS.findIndex((l, idx) => isUnlocked(save, idx) && !save.stars[l.id]); return LEVELS[i >= 0 ? i : 0]; }, [save]);

  return (
    <div className={`app ch-${chapter}`}>
      <div className="stage" ref={host} />
      {screen === 'home' && (
        <Home tulips={totalStars(save)} prints={Object.keys(save.prints).length} resume={save.stars[LEVELS[0].id] ? firstOpen : null} onPlay={() => startLevel(firstOpen)}
          onFolio={() => { setChapter(firstOpen.chapter); setScreen('folio'); }}
          onSettings={() => { setSettingsFrom('home'); setScreen('settings'); }} />
      )}
      {screen === 'folio' && <Folio save={save} chapter={chapter} onChapter={(c) => { setChapter(c); sound.startMusic(c); }} onPick={startLevel} onBack={goHome} />}
      {screen === 'play' && <Hud level={level} coach={coach} dim={paused || !!finish} onPause={() => pause(true)} />}
      {screen === 'play' && paused && !finish && (
        <PauseCard level={level} onResume={() => pause(false)} onRestart={() => startLevel(level)} onFolio={goFolio}
          onSettings={() => { setSettingsFrom('play'); setScreen('settings'); }} />
      )}
      {screen === 'play' && finish && (
        <ResultCard finish={finish} best={save.best[finish.level.id]} next={nextLevel && isUnlocked(save, levelIndex(nextLevel.id)) ? nextLevel : null}
          onNext={startLevel} onRetry={() => startLevel(level)} onFolio={goFolio} />
      )}
      {screen === 'settings' && (
        <Settings save={save} onChange={(st) => setSave((s) => ({ ...s, settings: st }))} onReset={() => setSave((s) => ({ ...freshSave(), settings: s.settings }))}
          onBack={() => { setScreen(settingsFrom); if (settingsFrom === 'play') pause(true); }} />
      )}
    </div>
  );
}

function Home({ tulips, prints, resume, onPlay, onFolio, onSettings }: { tulips: number; prints: number; resume: Level | null; onPlay: () => void; onFolio: () => void; onSettings: () => void }) {
  const head = useRef<HTMLElement>(null);
  const actions = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const measure = () => { if (head.current && actions.current) studio.setMenuInsets(head.current.getBoundingClientRect().bottom, window.innerHeight - actions.current.getBoundingClientRect().top); };
    measure();
    window.addEventListener('resize', measure);
    const t = window.setTimeout(measure, 800);
    return () => { window.removeEventListener('resize', measure); clearTimeout(t); };
  }, []);
  return (
    <div className="screen home">
      <header className="title" ref={head}>
        <h1><small>Magnolia</small>Ebru</h1>
        <p>Pour colour onto the water, draw it into tulips with a stylus, then lay down the paper and pull the print.</p>
      </header>
      <div className="home-actions" ref={actions}>
        <button className="marbled" onClick={() => { sound.tap(); onPlay(); }} data-testid="play">
          <I.Drop size={22} /> {resume ? <>Continue <small>{resume.name}</small></> : 'Begin at the bath'}
        </button>
        <div className="row">
          <button className="plain" onClick={() => { sound.tap(); onFolio(); }}><I.Folio /> Portfolio</button>
          <button className="plain round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
        <div className="tally"><I.Tulip size={16} on /> {tulips} / {LEVELS.length * 3} tulips · {prints} prints pulled</div>
      </div>
    </div>
  );
}

function Folio({ save, chapter, onChapter, onPick, onBack }: { save: Save; chapter: number; onChapter: (c: number) => void; onPick: (l: Level) => void; onBack: () => void }) {
  const levels = LEVELS.filter((l) => l.chapter === chapter);
  const got = levels.reduce((a, l) => a + (save.stars[l.id] ?? 0), 0);
  const chapterOpen = (c: number) => isUnlocked(save, LEVELS.findIndex((l) => l.chapter === c));
  const w = Math.floor(Math.max(56, Math.min(84, (Math.min(window.innerWidth, 460) - 36 - 3 * 10) / 4)));
  return (
    <div className="screen folio">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <div className="heading"><span className="eyebrow">portfolio · {got}/24</span><h2>{CHAPTERS[chapter].name}</h2></div>
        <span />
      </div>
      <div className="tabs" role="tablist">
        {CHAPTERS.map((c, i) => (
          <button key={c.name} role="tab" aria-selected={i === chapter} disabled={!chapterOpen(i)} className={`tab t${i} ${i === chapter ? 'on' : ''}`}
            aria-label={`${c.name}${chapterOpen(i) ? '' : ' (locked)'}`} onClick={() => { sound.tap(); onChapter(i); }}><i />{c.name}</button>
        ))}
      </div>
      <p className="blurb">{CHAPTERS[chapter].blurb}</p>
      <div className="sheets">
        {levels.map((l) => {
          const idx = levelIndex(l.id), open = isUnlocked(save, idx), st = save.stars[l.id] ?? 0;
          const ops = save.prints[l.id] ? decodePrint(l, save.prints[l.id]) : null;
          return (
            <button key={l.id} className={`sheet ${open ? '' : 'locked'}`} disabled={!open} onClick={() => { sound.tap(); onPick(l); }}
              aria-label={`${l.name}${open ? '' : ' (locked)'}`} data-testid={`level-${idx + 1}`}>
              <Print level={l} ops={ops} kind={!open ? 'blank' : ops ? 'print' : 'sketch'} width={w} />
              <span className="sheet-name">{l.name}</span>
              <span className="tulips">{[0, 1, 2].map((k) => <I.Tulip key={k} size={14} on={k < st} />)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Hud({ level, coach, dim, onPause }: { level: Level; coach: boolean; dim: boolean; onPause: () => void }) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [like, setLike] = useState(1);
  useEffect(() => {
    const measure = () => { if (top.current && bottom.current) studio.setPlayInsets(top.current.getBoundingClientRect().bottom, window.innerHeight - bottom.current.getBoundingClientRect().top); };
    measure();
    window.addEventListener('resize', measure);
    let raf = 0;
    const tick = () => { setStep(studio.step); setLike(studio.likeness); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener('resize', measure); cancelAnimationFrame(raf); };
  }, []);
  const n = LEVELS.filter((l) => l.chapter === level.chapter).indexOf(level) + 1;
  const op = level.ops[Math.min(step, level.ops.length - 1)];
  const done = step >= level.ops.length;
  const colour = op.k === 'drop' ? level.palette.inks[op.c] : '#c9a24a';
  const verb = op.k === 'drop' ? `Hold to pour ${inkName(level.palette.inks[op.c])}` : op.tines > 1 ? `Drag the comb along the arrows` : `Drag the stylus along the arrow`;
  const maxR = Math.max(...level.ops.map((o) => (o.k === 'drop' ? o.r : 0)));
  return (
    <div className={`hud ${dim ? 'dim' : ''}`}>
      <div className="hud-top" ref={top}>
        <button className="icon-btn" aria-label="Pause" onClick={(e) => { e.stopPropagation(); sound.tap(); onPause(); }} data-testid="pause"><I.Pause /></button>
        <div className="hud-title"><span>{CHAPTERS[level.chapter].name} · {n} of 8</span><strong>{level.name}</strong></div>
        <button className="icon-btn" aria-label="Undo last step" disabled={step === 0 || done} onClick={(e) => { e.stopPropagation(); sound.tap(); studio.undo(); }} data-testid="undo"><I.Undo /></button>
      </div>
      <div className="hud-bottom" ref={bottom}>
        <div className="pattern"><Print level={level} width={58} label={`The pattern: ${level.name}`} /><span>pattern</span></div>
        <div className="recipe">
          <div className="recipe-head">
            <span className="step-no">{done ? 'pulling the print' : `step ${step + 1} of ${level.ops.length}`}</span>
            <span className="true">true <b>{Math.round(like * 100)}%</b></span>
          </div>
          <div className="verb">{!done && <><i className="swatch" style={{ background: colour }}>{op.k === 'stroke' ? (op.tines > 1 ? <I.Comb size={14} /> : <I.Stylus size={14} />) : null}</i>{verb}</>}</div>
          <div className="steps" aria-hidden>
            {level.ops.map((o, i) => (
              <i key={i} className={`${i < step ? 'done' : i === step ? 'now' : ''} ${o.k}`}
                style={o.k === 'drop' ? { background: level.palette.inks[o.c], width: 7 + (o.r / maxR) * 9, height: 7 + (o.r / maxR) * 9 } : undefined} />
            ))}
          </div>
        </div>
      </div>
      {coach && level.hint && <div className="coach" role="note"><I.Drop size={22} /><p>{level.hint}</p></div>}
    </div>
  );
}

const NAMES: Record<string, string> = {
  '#b0352b': 'madder red', '#26467a': 'indigo', '#d39b2b': 'ochre', '#2c7c78': 'verdigris', '#2a2420': 'lamp black', '#d9838c': 'rose', '#557a36': 'leaf green',
  '#f8f2e4': 'chalk white', '#7d63a3': 'lilac', '#6f9fc4': 'sky blue', '#6b2a4a': 'plum', '#e7b84a': 'saffron', '#efc7bf': 'blush',
};
const inkName = (hex: string) => NAMES[hex] ?? 'colour';

function PauseCard({ level, onResume, onRestart, onFolio, onSettings }: { level: Level; onResume: () => void; onRestart: () => void; onFolio: () => void; onSettings: () => void }) {
  return (
    <div className="veil">
      <div className="card" role="dialog" aria-label="Paused">
        <span className="eyebrow">{level.name}</span>
        <h2>The bath waits</h2>
        <button className="marbled" onClick={() => { sound.tap(); onResume(); }} data-testid="resume">Back to the bath</button>
        <div className="row">
          <button className="plain" onClick={() => { sound.tap(); onRestart(); }}><I.Restart /> Restart</button>
          <button className="plain" onClick={() => { sound.tap(); onFolio(); }}><I.Folio /> Portfolio</button>
          <button className="plain round" aria-label="Settings" onClick={() => { sound.tap(); onSettings(); }}><I.Gear /></button>
        </div>
      </div>
    </div>
  );
}

const TITLES = ['A fair print', 'A fine sheet', 'Worthy of a sultan'];
function ResultCard({ finish, best, next, onNext, onRetry, onFolio }: { finish: Finish; best?: number; next: Level | null; onNext: (l: Level) => void; onRetry: () => void; onFolio: () => void }) {
  const r = finish.result;
  const [lit, setLit] = useState(0);
  useEffect(() => {
    const t = [0, 1, 2].filter((i) => i < r.stars).map((i) => window.setTimeout(() => { setLit(i + 1); sound.star(i); }, 420 + i * 330));
    return () => t.forEach(clearTimeout);
  }, [r.stars]);
  const lv = finish.level;
  const w = Math.min(170, Math.max(120, (window.innerHeight - 470) * 0.8));
  return (
    <div className="veil soft">
      <div className={`card result ${r.success ? 'win' : 'lose'}`} role="dialog" aria-label={r.success ? 'Print pulled' : 'Try again'}>
        <span className="eyebrow">{lv.name}</span>
        <h2>{r.success ? TITLES[r.stars - 1] : 'Skim the bath and begin again'}</h2>
        <div className="result-print"><Print level={lv} ops={finish.ops} width={w} label="Your print" /></div>
        {r.success && <div className="big-tulips">{[0, 1, 2].map((i) => <span key={i} className={i < lit ? 'on' : ''}><I.Tulip size={40} on={i < lit} /></span>)}</div>}
        <p className="acc"><b>{Math.round(r.likeness * 100)}%</b> true to the pattern</p>
        <p className="thresholds">{lv.stars.map((s, i) => <span key={i} className={r.likeness >= s ? 'on' : ''}>{Math.round(s * 100)}%</span>)}</p>
        {!r.success && <p className="fail-line">Pour each drop right on its dashed ring and let go as the ink reaches it.</p>}
        {r.success && best !== undefined && best > r.likeness && <p className="note-small">Your best here is {Math.round(best * 100)}%.</p>}
        {r.success && next ? (
          <button className="marbled" onClick={() => { sound.tap(); onNext(next); }} data-testid="next">Next: {next.name} <I.Next size={18} /></button>
        ) : (
          <button className="marbled" onClick={() => { sound.tap(); onRetry(); }} data-testid="retry"><I.Restart size={18} /> {r.success ? 'Marble it again' : 'Try again'}</button>
        )}
        <div className="row">
          {r.success && next && <button className="plain" onClick={() => { sound.tap(); onRetry(); }}><I.Restart /> Again</button>}
          <button className="plain" onClick={() => { sound.tap(); onFolio(); }}><I.Folio /> Portfolio</button>
        </div>
      </div>
    </div>
  );
}

function Settings({ save, onChange, onReset, onBack }: { save: Save; onChange: (s: Save['settings']) => void; onReset: () => void; onBack: () => void }) {
  const st = save.settings;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="screen settings">
      <div className="topbar">
        <button className="icon-btn" aria-label="Back" onClick={() => { sound.tap(); onBack(); }}><I.Back /></button>
        <div className="heading"><span className="eyebrow">settings</span><h2>Atelier</h2></div>
        <span />
      </div>
      <div className="card flat">
        <label className="slider">Music <input type="range" min={0} max={1} step={0.05} value={st.music} onChange={(e) => onChange({ ...st, music: +e.target.value })} /><output>{Math.round(st.music * 100)}</output></label>
        <label className="slider">Sounds <input type="range" min={0} max={1} step={0.05} value={st.sfx} onChange={(e) => onChange({ ...st, sfx: +e.target.value })} /><output>{Math.round(st.sfx * 100)}</output></label>
        <label className="toggle">Vibration <input type="checkbox" checked={st.haptics} onChange={(e) => onChange({ ...st, haptics: e.target.checked })} /><i /></label>
        <label className="toggle">Reduce motion <input type="checkbox" checked={st.reducedMotion} onChange={(e) => onChange({ ...st, reducedMotion: e.target.checked })} /><i /></label>
        <div className="reset">
          {confirm ? (
            <>
              <span>Clear the whole portfolio?</span>
              <button className="plain danger" onClick={() => { onReset(); setConfirm(false); }}>Reset</button>
              <button className="plain" onClick={() => setConfirm(false)}>Keep</button>
            </>
          ) : <button className="plain" onClick={() => setConfirm(true)}>Reset progress</button>}
        </div>
      </div>
      <p className="small-print">Plays fully offline. No ads, accounts or tracking.</p>
    </div>
  );
}
