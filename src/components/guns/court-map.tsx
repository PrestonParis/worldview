"use client";

import { useState } from "react";
import { COURT_ITEMS, COURT_KINDS, type CourtItem } from "@/lib/guns/courts";

const ITEMS = [...COURT_ITEMS].sort((a, b) => a.date.localeCompare(b.date));
const byId = new Map(ITEMS.map((i) => [i.id, i]));
const STEP = 60;
const PAD = 120;
const LANE = 84;
const W = PAD * 2 + STEP * (ITEMS.length - 1);
const H = LANE * COURT_KINDS.length + 30;
const pos = (it: CourtItem): [number, number] => [
  PAD + ITEMS.indexOf(it) * STEP,
  30 + LANE * COURT_KINDS.findIndex((k) => k.id === it.kind) + LANE / 2,
];
const FILL: Record<CourtItem["kind"], string> = {
  ruling: "#b91c1c",
  statute: "var(--viz-muted)",
  regulation: "#d97706",
};

// Rulings, statutes, and ATF rules in date order, one lane each; a line joins
// each item to the earlier ones it interprets, extends, or tests. Selecting an
// item highlights its lineage and opens its holding and source.
export function CourtMap({ justices }: { justices: Record<string, string> }) {
  const [selected, setSelected] = useState<string>("bruen");
  const cur = byId.get(selected)!;
  const later = ITEMS.filter((i) => i.builds.includes(cur.id));
  const linked = new Set([cur.id, ...cur.builds, ...later.map((i) => i.id)]);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto min-w-[1000px] w-full text-slate-950 dark:text-white" role="img" aria-label="Map of gun rulings, statutes, and rules">
          {COURT_KINDS.map((k, i) => (
            <g key={k.id}>
              <line x1={0} x2={W} y1={30 + LANE * (i + 1)} y2={30 + LANE * (i + 1)} stroke="var(--viz-empty)" />
              <text x={8} y={30 + LANE * i + 14} className="fill-slate-400 text-[10px] font-semibold tracking-wider uppercase">
                {k.label}
              </text>
            </g>
          ))}
          {ITEMS.flatMap((it) =>
            it.builds.map((b) => {
              const from = byId.get(b)!;
              const [x1, y1] = pos(from);
              const [x2, y2] = pos(it);
              const on = (it.id === cur.id || b === cur.id) && linked.has(it.id) && linked.has(b);
              const mx = (x1 + x2) / 2;
              return (
                <path
                  key={`${b}-${it.id}`}
                  d={`M${x1},${y1} C${mx},${y1 - (y1 === y2 ? 34 : 0)} ${mx},${y2 - (y1 === y2 ? 34 : 0)} ${x2},${y2}`}
                  fill="none"
                  stroke={on ? "currentColor" : "var(--viz-muted)"}
                  strokeOpacity={on ? 0.9 : 0.18}
                  strokeWidth={on ? 1.75 : 1}
                />
              );
            }),
          )}
          {ITEMS.map((it) => {
            const [x, y] = pos(it);
            const on = it.id === cur.id;
            const dim = !linked.has(it.id);
            return (
              <g
                key={it.id}
                tabIndex={0}
                role="button"
                aria-pressed={on}
                aria-label={`${it.date.slice(0, 4)} ${it.title}`}
                onClick={() => setSelected(it.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelected(it.id);
                  }
                }}
                className="cursor-pointer outline-none"
                opacity={dim ? 0.45 : 1}
              >
                <circle cx={x} cy={y} r={on ? 9 : 6.5} fill={FILL[it.kind]} stroke={on ? "currentColor" : "var(--viz-surface)"} strokeWidth={on ? 2.5 : 1.5} />
                <text x={x} y={y + 22} textAnchor="middle" className="fill-slate-500 font-mono text-[10px]">
                  {it.date.slice(0, 4)}
                </text>
                <text x={x} y={y - (ITEMS.indexOf(it) % 2 ? 26 : 14)} textAnchor="middle" className={`text-[10px] ${on ? "fill-current font-semibold" : "fill-slate-500"}`}>
                  {SHORT[it.id] ?? it.title}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <article className="grid gap-5 rounded-2xl bg-slate-50 p-5 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] dark:bg-slate-900/60" aria-live="polite">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
            {COURT_KINDS.find((k) => k.id === cur.kind)!.label} · {fmt(cur.date)}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">{cur.title}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {cur.cite}
            {cur.vote && ` · ${cur.vote}`}
            {cur.author && (
              <>
                {" · Opinion by "}
                {justices[cur.author] ? (
                  <a href={justices[cur.author]} className="text-red-700 hover:underline dark:text-red-400">
                    Justice {cur.author}
                  </a>
                ) : (
                  `Justice ${cur.author}`
                )}
              </>
            )}
          </p>
          <p className="mt-3 text-sm font-medium text-slate-800 dark:text-slate-200">{cur.question}</p>
          <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{cur.holding}</p>
          <a href={cur.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-slate-500 underline underline-offset-2 hover:text-slate-800 dark:hover:text-slate-200">
            Primary source ↗
          </a>
        </div>
        <div className="space-y-3 text-sm">
          <Lineage title="Builds on" items={cur.builds.map((b) => byId.get(b)!)} onPick={setSelected} />
          <Lineage title="Later developments" items={later} onPick={setSelected} />
        </div>
      </article>
    </div>
  );
}

function Lineage({ title, items, onPick }: { title: string; items: CourtItem[]; onPick: (id: string) => void }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{title}</p>
      {items.length ? (
        <ul className="mt-1 space-y-1">
          {items.map((i) => (
            <li key={i.id}>
              <button type="button" onClick={() => onPick(i.id)} className="text-left text-slate-700 hover:underline dark:text-slate-200">
                <span className="font-mono text-xs text-slate-400">{i.date.slice(0, 4)}</span> {i.title}
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-slate-400">—</p>
      )}
    </div>
  );
}

// Labels on the map; the panel uses full titles.
const SHORT: Record<string, string> = {
  "2a": "2nd Amendment",
  nfa: "NFA",
  miller: "Miller",
  gca: "GCA",
  fopa: "FOPA",
  brady: "Brady Act",
  vcclea: "1994 Crime Act",
  plcaa: "PLCAA",
  heller: "Heller",
  mcdonald: "McDonald",
  caetano: "Caetano",
  "bumpstock-rule": "Bump stocks",
  "frame-rule": "Frames rule",
  bruen: "Bruen",
  bsca: "BSCA",
  cargill: "Cargill",
  rahimi: "Rahimi",
  vanderstok: "VanDerStok",
  mexico: "S&W v. Mexico",
  hemani: "Hemani",
  wolford: "Wolford",
};

const fmt = (d: string) =>
  d.length === 4 ? d : new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
