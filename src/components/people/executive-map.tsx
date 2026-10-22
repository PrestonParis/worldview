import Link from "next/link";
import { PortraitImage } from "@/components/people/portrait-image";
import { FAMILY_FILL } from "@/lib/people/family-colors";
import { SECTOR_LABEL, monthYear, type ExecutiveCard, type ExecutiveMapData } from "@/lib/people/executive";

// The executive branch as an org chart: the President and Vice President,
// then the White House, the departments in line-of-succession order, and
// the cabinet-level agencies. Every person and office links to its profile.

function initials(name: string): string {
  const words = name.replace(/[^\p{L}\s]/gu, " ").split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase() || "?";
}

function Portrait({ person, size }: { person: ExecutiveCard; size: string }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${size}`}
      style={{ background: FAMILY_FILL[person.family] }}
      aria-hidden
    >
      {initials(person.name)}
      {person.imageUrl ? <PortraitImage src={person.imageUrl} /> : null}
    </span>
  );
}

// "Department of the Treasury" → "Treasury"; agencies keep their name.
const shortOrg = (name: string) => name.replace(/^Department of (the )?/, "");

function Leader({ person, label }: { person: ExecutiveCard; label: string }) {
  return (
    <Link
      href={person.href}
      className="flex min-w-0 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pr-5 transition hover:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600"
    >
      <Portrait person={person} size="h-14 w-14 text-base" />
      <span className="min-w-0">
        <span className="block text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{label}</span>
        <span className="block truncate text-base font-semibold text-slate-950 dark:text-white">{person.name}</span>
        {person.since ? <span className="block text-xs text-slate-500 dark:text-slate-400">Since {monthYear(person.since)}</span> : null}
      </span>
    </Link>
  );
}

function PostCard({ person, eyebrow }: { person: ExecutiveCard; eyebrow: string }) {
  return (
    <li className="flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-950">
      {person.org ? (
        <Link href={person.org.href} className="truncate text-[11px] font-semibold tracking-wide text-slate-400 uppercase hover:text-slate-700 dark:hover:text-slate-200" title={person.org.name}>
          {eyebrow}
        </Link>
      ) : (
        <span className="truncate text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{eyebrow}</span>
      )}
      <Link href={person.href} className="group mt-2 flex min-w-0 items-center gap-2.5">
        <Portrait person={person} size="h-9 w-9 text-xs" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900 group-hover:underline dark:text-slate-100">{person.name}</span>
          <span className="block text-xs leading-snug text-slate-500 dark:text-slate-400">{person.title}</span>
        </span>
      </Link>
      <span className="mt-auto pt-2 text-[11px] text-slate-400">
        {[person.since ? `Since ${monthYear(person.since)}` : "", person.priorSector ? SECTOR_LABEL[person.priorSector] ?? person.priorSector : ""]
          .filter(Boolean)
          .join(" · ")}
      </span>
    </li>
  );
}

function Band({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="relative pt-6">
      {/* The connector from the President down through each band. */}
      <span className="absolute top-0 left-1/2 h-6 w-px bg-slate-300 dark:bg-slate-700" aria-hidden />
      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-900/40">
        <h3 className="mb-3 flex items-baseline justify-between gap-3 text-sm font-semibold text-slate-900 dark:text-white">
          {title}
          <span className="text-xs font-normal text-slate-400 tabular-nums">{count}</span>
        </h3>
        {children}
      </div>
    </section>
  );
}

export function ExecutiveMap({ data }: { data: ExecutiveMapData }) {
  const { president, vp, eop, departments, agencies, former, sectors } = data;
  return (
    <div>
      <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Leader person={president} label="President" />
        {vp ? (
          <>
            <span className="hidden h-px w-6 bg-slate-300 sm:block dark:bg-slate-700" aria-hidden />
            <Leader person={vp} label="Vice President" />
          </>
        ) : null}
      </div>

      {eop.length ? (
        <Band title="White House" count={eop.length}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {eop.map((p) => <PostCard key={p.id} person={p} eyebrow={p.org?.name === "Executive Office of the President" ? "Executive Office" : p.org?.name ?? ""} />)}
          </ul>
        </Band>
      ) : null}

      {departments.length ? (
        <Band title="Executive departments, in line of succession" count={departments.length}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {departments.map((p) => <PostCard key={p.id} person={p} eyebrow={p.org ? shortOrg(p.org.name) : p.title} />)}
          </ul>
        </Band>
      ) : null}

      {agencies.length ? (
        <Band title="Cabinet-level officials" count={agencies.length}>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {agencies.map((p) => <PostCard key={p.id} person={p} eyebrow={p.org?.name ?? p.title} />)}
          </ul>
        </Band>
      ) : null}

      <div className="mt-5 grid gap-4 text-xs text-slate-500 md:grid-cols-2 dark:text-slate-400">
        {sectors.length ? (
          <div>
            <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">Where the cabinet came from</p>
            <ul className="flex flex-wrap gap-1.5">
              {sectors.map(([sector, n]) => (
                <li key={sector} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <span className="font-semibold tabular-nums">{n}</span> {SECTOR_LABEL[sector] ?? sector}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {former.length ? (
          <div>
            <p className="mb-2 font-semibold text-slate-700 dark:text-slate-300">Departed this term</p>
            <ul className="space-y-1">
              {former.map((p) => (
                <li key={p.id}>
                  <Link href={p.href} className="font-medium text-slate-700 hover:underline dark:text-slate-200">{p.name}</Link>
                  {", "}
                  {p.title} <span className="tabular-nums">({monthYear(p.since)} – {monthYear(p.until)})</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
