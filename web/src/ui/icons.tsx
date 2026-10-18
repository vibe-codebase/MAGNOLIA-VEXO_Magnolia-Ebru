type P = { size?: number };
const s = (size = 22) => ({ width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const });

export const Pause = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 6.5v11M15 6.5v11" /></svg>;
export const Back = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M14.5 5.5 8 12l6.5 6.5" /></svg>;
export const Next = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9.5 5.5 16 12l-6.5 6.5" /></svg>;
export const Restart = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" /><path d="M4 4.5v3.5h3.5" /></svg>;
export const Undo = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M9 14 4.5 9.5 9 5" /><path d="M5 9.5h9a5.5 5.5 0 0 1 0 11h-3" /></svg>;
export const Gear = ({ size }: P) => (
  <svg {...s(size)} aria-hidden><circle cx="12" cy="12" r="3" /><path d="M12 2.8v2.4M12 18.8v2.4M21.2 12h-2.4M5.2 12H2.8M18.5 5.5l-1.7 1.7M7.2 16.8l-1.7 1.7M18.5 18.5l-1.7-1.7M7.2 7.2 5.5 5.5" /></svg>
);
/** A drop of ink falling. */
export const Drop = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M12 3.5c3 4 5.5 7.2 5.5 10.2a5.5 5.5 0 0 1-11 0C6.5 10.7 9 7.5 12 3.5z" /><path d="M9.5 14.5a2.6 2.6 0 0 0 2 2.4" strokeWidth="1.3" /></svg>;
/** Stacked prints: the portfolio. */
export const Folio = ({ size }: P) => <svg {...s(size)} aria-hidden><rect x="6" y="3.5" width="12.5" height="15.5" rx="1" /><path d="M4 6.5v14h11.5" /><circle cx="12.2" cy="9.5" r="2.4" /><path d="M12.2 11.9v3.5" strokeWidth="1.4" /></svg>;
/** Stars are tulips, the emblem of Ottoman ebru. */
export const Tulip = ({ size = 22, on }: P & { on?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M12 21.5v-8" stroke={on ? '#5f8a3a' : 'rgba(242,232,213,.35)'} strokeWidth="1.5" strokeLinecap="round" />
    <path d="M12 18c-2.2-.2-3.8-1.6-4.6-3.6 2 .1 3.6.9 4.6 2.4" fill={on ? '#5f8a3a' : 'none'} stroke={on ? '#5f8a3a' : 'rgba(242,232,213,.35)'} strokeWidth="1" strokeLinejoin="round" />
    <path d="M12 14c-3.6-.4-5.6-3.4-5.4-8.4 1.4 1.3 2.6 1.9 3.6 2.1C10.5 5.3 11.2 3.6 12 2.5c.8 1.1 1.5 2.8 1.8 5.2 1-.2 2.2-.8 3.6-2.1.2 5-1.8 8-5.4 8.4z"
      fill={on ? '#b0352b' : 'none'} stroke={on ? '#e6c46a' : 'rgba(242,232,213,.45)'} strokeWidth="1.1" strokeLinejoin="round" />
    {on && <path d="M12 4.5v8" stroke="#e6c46a" strokeWidth=".9" strokeLinecap="round" opacity=".8" />}
  </svg>
);
/** The stylus. */
export const Stylus = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M17.5 3.5 20.5 6.5 9 18l-4.5 1.5L6 15z" /><path d="M14.5 6.5l3 3" strokeWidth="1.3" /></svg>;
/** A comb of tines. */
export const Comb = ({ size }: P) => <svg {...s(size)} aria-hidden><path d="M4 6.5h16" strokeWidth="2.4" /><path d="M6 6.5v12M10 6.5v12M14 6.5v12M18 6.5v12" strokeWidth="1.3" /></svg>;
