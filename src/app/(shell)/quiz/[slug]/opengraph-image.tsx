import { ImageResponse } from "next/og";
import { getQuizSession } from "@/lib/db/quizSessions";
import { SLUG_PATTERN } from "@/lib/quiz/access";
import { computeResult } from "@/lib/quiz/results";
import { axes, axisById } from "@/lib/quiz/axes";
import { issues } from "@/lib/quiz/bank";
import { ideologies } from "@/lib/quiz/ideologies";
import { familyColor, FAMILIES } from "@/lib/quiz/families";

export const alt = "Political quiz results";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Link previews are fetched without the viewer's session, so only quizzes
// visible to anyone with the link show their results; private ones get the
// generic card.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = SLUG_PATTERN.test(slug) ? await getQuizSession(slug) : null;
  const shareable = session && (!session.ownerId || session.visibility === "public") && session.answers.length > 0;
  const result = shareable ? computeResult(session.answers, session.refine) : null;

  const top = result?.ideologies.slice(0, 3) ?? [];
  const strongest = result
    ? [...result.axes].sort((a, b) => Math.abs(b.mean) - Math.abs(a.mean)).slice(0, 4)
    : [];

  const accent = top[0] ? familyColor(top[0].ideology.family) : "#94a3b8";

  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: "#0f172a", backgroundImage: `radial-gradient(ellipse 70% 90% at 0% 0%, ${accent}55, transparent 60%)`, color: "#f8fafc", padding: 64, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 22, letterSpacing: 4, color: "#94a3b8", textTransform: "uppercase" }}>Worldview · Political quiz</div>
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 32 }}>
            <div style={{ display: "flex", fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: accent }}>My ideology is</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 28, marginTop: 8 }}>
              <div style={{ display: "flex", fontSize: 84, fontWeight: 800, color: "#f8fafc" }}>{top[0].ideology.name}</div>
              <div style={{ display: "flex", fontSize: 48, fontWeight: 700, color: accent }}>{`${top[0].match}%`}</div>
            </div>
            <div style={{ display: "flex", fontSize: 26, color: "#94a3b8", marginTop: 8 }}>
              {`${FAMILIES[top[0].ideology.family].label} · then ${top
                .slice(1)
                .map((m) => `${m.ideology.name} ${m.match}%`)
                .join(" · ")}`}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 40 }}>
              {strongest.map((a) => (
                <div key={a.axis} style={{ display: "flex", fontSize: 24, padding: "10px 18px", borderRadius: 999, background: `${accent}2e`, border: `2px solid ${accent}66`, color: "#f8fafc" }}>
                  {axisById[a.axis][a.mean < 0 ? "negative" : "positive"].label}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 48 }}>
            <div style={{ fontSize: 72, fontWeight: 700 }}>Where do you stand?</div>
            <div style={{ fontSize: 32, color: "#cbd5e1", marginTop: 16 }}>{`${axes.length} axes · ${issues.length} issues · ${ideologies.length} ideological traditions`}</div>
          </div>
        )}
      </div>
    ),
    size,
  );
}
