import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EGO_RX, EGO_RY, type EgoPreview } from "@/lib/people/ego-preview";
import { relationshipCategoryColors } from "@/lib/relationships";
import { FAMILY_FILL } from "@/lib/people/family-colors";

const LABEL_MAX = 24;
const clip = (s: string) => (s.length > LABEL_MAX ? `${s.slice(0, LABEL_MAX - 1).trimEnd()}…` : s);

/** `moreHref` adds a footer link to the subject's full relationship list. */
export function NetworkPreview({ preview, moreHref }: { preview: EgoPreview; moreHref?: string }) {
  const { root, nodes, total } = preview;
  const padX = 190;
  const padY = 70;

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <svg
        viewBox={`${-EGO_RX - padX} ${-EGO_RY - padY} ${2 * (EGO_RX + padX)} ${2 * (EGO_RY + padY)}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${root.name} and ${nodes.length} direct connections`}
      >
        {nodes.map((n) => (
          <line
            key={`edge-${n.id}`}
            x1={0}
            y1={0}
            x2={n.x}
            y2={n.y}
            stroke={n.category ? relationshipCategoryColors[n.category] : "#94A3B8"}
            strokeWidth={1.75}
            opacity={0.75}
          />
        ))}

        {nodes.map((n) => {
          const cos = n.x / EGO_RX;
          const anchor = cos > 0.25 ? "start" : cos < -0.25 ? "end" : "middle";
          const dx = anchor === "start" ? 14 : anchor === "end" ? -14 : 0;
          const dy = anchor === "middle" ? (n.y < 0 ? -26 : 24) : -2;
          return (
            <a key={n.id} href={n.href} aria-label={`${n.name}: ${n.relation}`}>
              <circle cx={n.x} cy={n.y} r={8} style={{ fill: FAMILY_FILL[n.family] }} className="stroke-white dark:stroke-slate-950" strokeWidth={2} />
              <text x={n.x + dx} y={n.y + dy} textAnchor={anchor} className="fill-slate-900 text-[13px] font-semibold dark:fill-white">
                {clip(n.name)}
              </text>
              <text x={n.x + dx} y={n.y + dy + 15} textAnchor={anchor} className="fill-slate-500 text-[11px] dark:fill-slate-400">
                {clip(n.relation)}
              </text>
            </a>
          );
        })}

        <a href={root.href} aria-label={root.name}>
          <defs>
            <clipPath id="ego-root-clip">
              <circle r={34} />
            </clipPath>
          </defs>
          <circle r={38} style={{ fill: FAMILY_FILL[root.family] }} />
          {root.imageUrl ? (
            <image href={root.imageUrl} x={-34} y={-34} width={68} height={68} clipPath="url(#ego-root-clip)" preserveAspectRatio="xMidYMid slice" />
          ) : null}
          <text y={58} textAnchor="middle" className="fill-slate-950 text-[15px] font-bold dark:fill-white">
            {root.name}
          </text>
        </a>
      </svg>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-3 text-sm dark:border-slate-800">
        <span className="text-slate-500 dark:text-slate-400">
          {nodes.length < total ? `${nodes.length} of ${total} direct ties shown` : `${total} direct ties`}
        </span>
        {moreHref ? (
          <Link
            href={moreHref}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:underline dark:text-white"
          >
            All relationships <ArrowRight className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
