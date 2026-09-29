/*
 * The About house for the phone version: one simple Mohammadpur house in
 * green lines, every window dark but one. In the lit window someone sits at a
 * laptop, and a ceiling fan's shadow turns slowly above (still when motion is
 * reduced; see .fan-spin in globals.css).
 */

const W = 240;
const H = 300;
const X0 = 50;
const X1 = 190;
const GROUND = 290;
const FLOOR = 48;
const FLOORS = 5;
const TOP = GROUND - FLOOR * FLOORS;
const WINDOWS = [
  [62, 104],
  [132, 174],
] as const;
const LIT = { floor: 2, col: 0 };

const floorTop = (k: number) => GROUND - FLOOR * (k + 1);

export function AboutHouse() {
  const litX = WINDOWS[LIT.col][0];
  const litY = floorTop(LIT.floor) + 10;
  const lw = WINDOWS[LIT.col][1] - WINDOWS[LIT.col][0];
  const lh = 28;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="mx-auto block w-full max-w-[280px]"
      role="img"
      aria-label="A house in Mohammadpur at night, one window still lit"
    >
      <defs>
        <radialGradient id="about-halo">
          <stop offset="0" stopColor="#f5e6c8" stopOpacity="0.32" />
          <stop offset="1" stopColor="#f5e6c8" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="about-spill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f5e6c8" stopOpacity="0.14" />
          <stop offset="1" stopColor="#f5e6c8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Solid walls: the skyline behind never shows through the house. */}
      <rect x={X0} y={TOP} width={X1 - X0} height={GROUND - TOP} fill="#0a0f0c" />
      <rect x="140" y={TOP - 28} width="40" height="28" fill="#0a0f0c" />
      <rect x="62" y={TOP - 16} width="24" height="16" fill="#0a0f0c" />

      {/* Warm light around the window and spilling down the wall. */}
      <ellipse cx={litX + lw / 2} cy={litY + lh / 2} rx="56" ry="44" fill="url(#about-halo)" />
      <rect x={litX - 8} y={litY + lh} width={lw + 16} height="40" fill="url(#about-spill)" />

      {/* Details: floor lines, windows with grills, balconies, the gate. */}
      <g fill="none" stroke="#22c55e" strokeOpacity="0.3" strokeWidth="0.8">
        {Array.from({ length: FLOORS - 1 }, (_, k) => (
          <line key={k} x1={X0} x2={X1} y1={floorTop(k)} y2={floorTop(k)} />
        ))}
        {Array.from({ length: FLOORS - 1 }, (_, i) => i + 1).flatMap((k) =>
          WINDOWS.map(([a, b], c) => {
            if (k === LIT.floor && c === LIT.col) return null;
            const y = floorTop(k) + 10;
            return (
              <g key={`${k}-${c}`}>
                <rect x={a} y={y} width={b - a} height={lh} />
                {[1, 2, 3].map((j) => (
                  <line key={j} x1={a + ((b - a) * j) / 4} x2={a + ((b - a) * j) / 4} y1={y} y2={y + lh} />
                ))}
                {c === 1 && (
                  <>
                    <rect x={a - 4} y={y + lh + 2} width={b - a + 8} height="7" />
                    {[0.25, 0.5, 0.75].map((f) => (
                      <line key={f} x1={a - 4 + (b - a + 8) * f} x2={a - 4 + (b - a + 8) * f} y1={y + lh + 2} y2={y + lh + 9} />
                    ))}
                  </>
                )}
              </g>
            );
          })
        )}
        {/* Ground floor gate */}
        <rect x="66" y={GROUND - 38} width="108" height="38" />
        {Array.from({ length: 11 }, (_, i) => (
          <line key={i} x1={66 + i * 10.8} x2={66 + i * 10.8} y1={GROUND - 38} y2={GROUND} />
        ))}
        {/* Water tank */}
        <rect x="62" y={TOP - 16} width="24" height="16" />
        <line x1="62" x2="86" y1={TOP - 12} y2={TOP - 12} />
      </g>

      {/* Main outline: walls, roof parapet, stair room. */}
      <g fill="none" stroke="#22c55e" strokeOpacity="0.85" strokeWidth="1.2" strokeLinejoin="round">
        <rect x={X0} y={TOP} width={X1 - X0} height={GROUND - TOP} />
        <line x1={X0 - 4} x2={X1 + 4} y1={TOP} y2={TOP} />
        <rect x="140" y={TOP - 28} width="40" height="28" />
        <line x1="20" x2="220" y1={GROUND} y2={GROUND} strokeOpacity="0.4" />
      </g>

      {/* The one lit window. */}
      <g transform={`translate(${litX} ${litY})`}>
        <rect width={lw} height={lh} fill="#f5e6c8" />
        {/* Fan shadow on the ceiling, turning slowly. */}
        <line x1="21" y1="0" x2="21" y2="4" stroke="#0a0f0c" strokeOpacity="0.45" strokeWidth="0.8" />
        <g transform="translate(21 4.5) scale(1 0.32)">
          <g className="fan-spin" fill="#0a0f0c" fillOpacity="0.38">
            {[0, 120, 240].map((r) => (
              <ellipse key={r} cx="7.5" cy="0" rx="7" ry="1.9" transform={`rotate(${r})`} />
            ))}
            <circle r="1.8" />
          </g>
        </g>
        {/* Someone at a desk with a laptop, as a dark silhouette. */}
        <g fill="#0a0f0c" fillOpacity="0.85">
          <circle cx="28" cy="12.5" r="2.8" />
          <path d="M23 24 L23.5 18 Q24 15.6 28 15.6 Q32 15.6 32.5 18 L33 24 Z" />
          <rect x="6" y="23.6" width="32" height="1.2" />
          <rect x="11" y="22.4" width="8" height="1.2" />
          <path d="M11.2 22.6 L9.6 16.4 L10.8 16.2 L12.4 22.4 Z" />
        </g>
        {/* Grill bars over the glass */}
        <g stroke="#0a0f0c" strokeOpacity="0.35" strokeWidth="0.7">
          {[1, 2, 3].map((j) => (
            <line key={j} x1={(lw * j) / 4} x2={(lw * j) / 4} y1="0" y2={lh} />
          ))}
        </g>
        <rect width={lw} height={lh} fill="none" stroke="#22c55e" strokeOpacity="0.6" strokeWidth="0.8" />
      </g>
    </svg>
  );
}
