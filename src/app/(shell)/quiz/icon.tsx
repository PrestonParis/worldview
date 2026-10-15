import { ImageResponse } from "next/og";
import { FAMILIES } from "@/lib/quiz/families";
import type { IdeologyFamily } from "@/lib/quiz/types";

// The Worldview Atlas mark as the quiz section's favicon: the five-dot small
// version from components/quiz/atlas-mark.tsx on a white tile.
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const STARS: { family: IdeologyFamily; x: number; y: number }[] = [
  { family: "libertarian", x: 16, y: 4.5 },
  { family: "right", x: 27.5, y: 19 },
  { family: "religious", x: 21.5, y: 27 },
  { family: "left", x: 4.5, y: 19 },
  { family: "liberal", x: 7, y: 8.5 },
];

export default function Icon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", borderRadius: 7 }}>
        <svg width="32" height="32" viewBox="0 0 32 32">
          {STARS.map((s) => (
            <circle key={s.family} cx={s.x} cy={s.y} r={3} fill={FAMILIES[s.family].color} />
          ))}
          <circle cx={16} cy={16.5} r={7} fill="none" stroke="#020617" strokeOpacity={0.25} strokeWidth={1.5} />
          <circle cx={16} cy={16.5} r={4} fill="#020617" />
        </svg>
      </div>
    ),
    size,
  );
}
