// Store icon, adaptive-icon layers and splash, marbled by the game's own bath.
import * as A from '../src/game/art';
import { LEVELS, groundOf } from '../src/game/levels';
import { run, TRAY_W, TRAY_H } from '../src/game/sim';
import { marbleUrl } from '../src/ui/marble';

const L = LEVELS.find((l) => l.id === 'cicek-2')!;
const full = run([...groundOf(L), ...L.ops]);
const bloom = full.filter((i) => i.c < 50);

/** Paint the tulip so that tray point (cx, cy) lands at (x, y) at the given scale. */
function bath(g: CanvasRenderingContext2D, x: number, y: number, k: number, cx: number, cy: number, which = full, pal = L.palette) {
  g.save(); g.translate(x - cx * k, y - cy * k); g.scale(k, k); A.paintBath(g, which, pal, k); g.restore();
}
export function icon() {
  const { c, g } = A.canvas(1024, 1024);
  bath(g, 512, 512, 3.3, 160, 214);
  // a soft vignette and a fine gold hairline, as on a framed sheet
  const v = g.createRadialGradient(512, 512, 300, 512, 512, 760); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,12,6,0.35)');
  g.fillStyle = v; g.fillRect(0, 0, 1024, 1024);
  return c;
}
export function adaptive() {
  const { c, g } = A.canvas(1024, 1024);
  // only the tulip and its leaf, on transparency; the launcher supplies the ground layer
  g.save(); g.translate(512 - 160 * 2.2, 512 - 216 * 2.2); g.scale(2.2, 2.2);
  for (const ink of bloom) {
    g.beginPath(); g.moveTo(ink.p[0], ink.p[1]); for (let i = 2; i < ink.p.length; i += 2) g.lineTo(ink.p[i], ink.p[i + 1]); g.closePath();
    g.fillStyle = L.palette.inks[ink.c]; g.fill(); g.strokeStyle = 'rgba(40,20,10,0.4)'; g.lineWidth = 1; g.stroke();
  }
  g.restore();
  return c;
}
export function adaptiveBg() {
  const { c, g } = A.canvas(1024, 1024);
  bath(g, 512, 512, 3.2, 160, 200, full.filter((i) => i.c >= 50));
  return c;
}
export async function splash() {
  const W = 1284, H = 2778;
  const { c, g } = A.canvas(W, H);
  const bg = g.createRadialGradient(W / 2, H * 0.5, 50, W / 2, H * 0.5, H * 0.7);
  bg.addColorStop(0, '#1e3c44'); bg.addColorStop(1, '#0a1418');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const pw = 820, ph = pw * (TRAY_H / TRAY_W) * 1.05;
  const print = A.printCanvas(full, L.palette, pw, ph, 1, 4);
  g.save(); g.translate(W / 2, H * 0.58); g.rotate(-0.025); g.drawImage(print, -pw / 2, -ph / 2); g.restore();
  // marbled title, cut from the same paper as the buttons
  const img = new Image(); img.src = marbleUrl(['#a8322a', '#c4553a', '#7d2220', '#d9a441'], '#5e1c18', 7);
  await img.decode();
  const { c: t, g: tg } = A.canvas(W, 420);
  tg.font = '400 330px Gloock, serif'; tg.textAlign = 'center'; tg.textBaseline = 'alphabetic';
  tg.fillStyle = '#000'; tg.fillText('Ebru', W / 2, 340);
  tg.globalCompositeOperation = 'source-in'; tg.drawImage(img, 0, -200, W, W * 1.25);
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
  g.font = '400 330px Gloock, serif'; g.textAlign = 'center'; g.fillStyle = '#c9a24a'; g.fillText('Ebru', W / 2 + 3, H * 0.19 + 343); g.restore();
  g.drawImage(t, 0, H * 0.19);
  g.textAlign = 'center'; g.save(); g.shadowBlur = 0; g.font = '600 58px "Instrument Sans", sans-serif'; g.fillStyle = '#c9a24a'; try { g.letterSpacing = '34px'; } catch { /* */ } g.fillText('MAGNOLIA', W / 2 + 17, H * 0.19 + 20); g.restore();
  return c;
}
/** The Play Store feature graphic: a pulled tulip print on the right, lamp-lit; the words on the left. */
export function feature() {
  const W = 1024, H = 500, { c, g } = A.canvas(W, H);
  const bg = g.createRadialGradient(780, 250, 30, 780, 250, 700); bg.addColorStop(0, '#24464f'); bg.addColorStop(1, '#0a1418');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const pw = 330, ph = pw * (TRAY_H / TRAY_W) * 1.05;
  const print = A.printCanvas(full, L.palette, pw, ph, 1, 4);
  const s = Math.min(1, 420 / ph);
  g.save(); g.translate(785, 250); g.rotate(-0.035); g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 26; g.shadowOffsetY = 10; g.drawImage(print, -pw * s / 2, -ph * s / 2, pw * s, ph * s); g.restore();
  const shade = g.createLinearGradient(0, 0, 580, 0); shade.addColorStop(0, 'rgba(8,16,20,0.92)'); shade.addColorStop(0.75, 'rgba(8,16,20,0.6)'); shade.addColorStop(1, 'rgba(8,16,20,0)'); g.fillStyle = shade; g.fillRect(0, 0, 580, H);
  g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.save(); g.shadowBlur = 0; g.font = '600 22px "Instrument Sans", sans-serif'; g.fillStyle = '#c9a24a'; try { g.letterSpacing = '13px'; } catch { /* */ } g.fillText('MAGNOLIA', 58, 112); g.restore();
  const tg = g.createLinearGradient(0, 130, 0, 230); tg.addColorStop(0, '#f6d58a'); tg.addColorStop(0.5, '#c9a24a'); tg.addColorStop(1, '#8a5f22');
  g.save(); g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 18; g.fillStyle = tg; g.font = '400 132px Gloock, serif'; g.fillText('Ebru', 50, 236); g.restore();
  g.fillStyle = '#b0352b'; g.fillRect(58, 262, 52, 3);
  g.fillStyle = '#f2e8d5'; g.font = '600 27px "Instrument Sans", sans-serif'; g.fillText('Pour, comb, and pull the print.', 58, 308);
  g.fillStyle = 'rgba(242,232,213,0.8)'; g.font = '500 19px "Instrument Sans", sans-serif'; g.fillText('24 patterns · stone, comb and tulip ebru', 58, 344);
  return c;
}
(window as unknown as { brand: unknown }).brand = { icon, adaptive, adaptiveBg, splash, feature };
