import { LEVELS } from '../src/game/levels';
import { handLikeness, STEADY } from '../src/game/bot';
const out: Record<string, number[]> = {};
for (const l of LEVELS) {
  const steady = handLikeness(l, STEADY, 12);
  const shaky = handLikeness(l, { pos: 7, radius: 5, stroke: 10 }, 12, 3);
  const sloppy = handLikeness(l, { pos: 14, radius: 9, stroke: 20 }, 12, 5);
  out[l.id] = [steady, shaky, sloppy].map((x) => +x.toFixed(3));
  console.log(l.id, out[l.id].join(' '));
}
