import { FAMILIES } from "@/lib/quiz/families";
import type { IdeologyFamily } from "@/lib/quiz/types";

// The Worldview Atlas mark: a constellation of traditions in their family
// colours around one dark, ringed dot — you, placed among them.
// Coordinates are in a 32×32 box.
const STARS: { family: IdeologyFamily; x: number; y: number }[] = [
  { family: "libertarian", x: 16, y: 4.5 },
  { family: "conservative", x: 25, y: 8.5 },
  { family: "right", x: 27.5, y: 19 },
  { family: "religious", x: 21.5, y: 27 },
  { family: "populist", x: 11, y: 27.5 },
  { family: "left", x: 4.5, y: 19 },
  { family: "liberal", x: 7, y: 8.5 },
];
// At favicon sizes the outer ring thins to five, so the dots don't merge.
const SMALL = new Set<IdeologyFamily>(["libertarian", "right", "religious", "left", "liberal"]);

export function AtlasMark({ size = 40, animated = false, className = "" }: { size?: number; animated?: boolean; className?: string }) {
  const small = size <= 20;
  const stars = small ? STARS.filter((s) => SMALL.has(s.family)) : STARS;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={`shrink-0 ${className}`}>
      {stars.map((s, i) => (
        <circle
          key={s.family}
          cx={s.x}
          cy={s.y}
          r={small ? 3 : 2.4}
          fill={FAMILIES[s.family].color}
          className={animated ? "atlas-star" : undefined}
          style={animated ? { animationDelay: `${i * 60}ms` } : undefined}
        />
      ))}
      <g className={animated ? "atlas-you" : undefined} style={animated ? { animationDelay: `${stars.length * 60 + 80}ms` } : undefined}>
        <circle cx={16} cy={16.5} r={small ? 7 : 6} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.5} />
        <circle cx={16} cy={16.5} r={small ? 4 : 3.4} fill="currentColor" />
      </g>
    </svg>
  );
}
