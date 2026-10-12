import { ImageResponse } from "next/og";
import { SLOGAN } from "@/lib/site";

export const alt = `Worldview. ${SLOGAN}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Default link preview for every page without its own card.
export default function Image() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%", height: "100%", background: "#080b12", color: "#f8fafc", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 28, letterSpacing: 4, color: "#94a3b8", textTransform: "uppercase" }}>Worldview</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, fontWeight: 800, letterSpacing: -4 }}>{SLOGAN}</div>
          <div style={{ fontSize: 32, color: "#cbd5e1", marginTop: 20 }}>Public records on immigration, crime, elections, demographics, and political money.</div>
        </div>
      </div>
    ),
    size,
  );
}
