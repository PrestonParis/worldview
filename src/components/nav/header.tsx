"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/can-edit";
import {
  ArrowRight,
  Baby,
  Banknote,
  Briefcase,
  ChevronDown,
  Church,
  Compass,
  Crosshair,
  Gavel,
  Globe2,
  GraduationCap,
  Handshake,
  HeartPulse,
  House,
  Landmark,
  LayoutGrid,
  Map as MapIcon,
  Menu,
  Network,
  PersonStanding,
  Receipt,
  Scroll,
  Search,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
  Users,
  Vote,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { navGroups as baseNavGroups, ownerNavItems } from "@/lib/nav";
import { GlobalSearch } from "@/components/search/global-search";
import { NewMenu } from "@/components/nav/new-menu";
import { SettingsMenu } from "@/components/nav/settings-menu";
import type { NavPreviews } from "@/lib/nav-previews";

const ICONS: Record<string, LucideIcon> = {
  "/immigration": PersonStanding,
  "/crime": ShieldAlert,
  "/abortion": Stethoscope,
  "/guns": Crosshair,
  "/healthcare": HeartPulse,
  "/energy": Zap,
  "/economy": TrendingUp,
  "/housing": House,
  "/spending": Receipt,
  "/education": GraduationCap,
  "/states": MapIcon,
  "/demographics": Users,
  "/religion": Church,
  "/family": Baby,
  "/people": Network,
  "/money": Banknote,
  "/foreign-policy": Globe2,
  "/israel": Handshake,
  "/legislation": Gavel,
  "/elections": Vote,
  "/my-government": Landmark,
  "/atlas": Compass,
  "/geography": Globe2,
  "/subpoena": Briefcase,
  "/writ": Scroll,
  "/issueview": LayoutGrid,
};

interface PillRect {
  left: number;
  width: number;
}

const isOn = (pathname: string, href: string) => pathname === href || pathname.startsWith(`${href}/`);

const GROUP_FEATURES: Record<string, { eyebrow: string; title: string; body: string; href: string }> = {
  issues: { eyebrow: "Start with immigration", title: "The issues, by the numbers", body: "Trends across years and states, with definitions and primary sources attached.", href: "/immigration" },
  economy: { eyebrow: "Start with jobs and prices", title: "How Americans are doing", body: "Paychecks, prices, homes, and the federal budget — official figures, updated as agencies publish them.", href: "/economy" },
  society: { eyebrow: "Explore the evidence", title: "Who we are, and where we're headed", body: "Population, schooling, belief, and family life — measured over decades and projected forward.", href: "/demographics" },
  power: { eyebrow: "Explore the network", title: "See how influence moves", body: "Connect people, institutions, money, legislation, and the relationships between them.", href: "/people" },
  government: { eyebrow: "Midterms Nov 3", title: "Where the races are close", body: "Ratings, results, and county maps for every Senate and governor race, plus the bills and budget behind them.", href: "/elections" },
  tools: { eyebrow: "Analytical Workspaces", title: "Unconstrained tools over public data", body: "Investigate money in Subpoena, track government action in Writ, and map ideology in Atlas.", href: "/tools" },
};

// accountLabel overrides the client session for pages outside the shell that
// already know who is signed in.
export function Header({ accountLabel: knownLabel, owner, previews }: { accountLabel?: string | null; owner?: boolean; previews?: NavPreviews }) {
  const session = useSession();
  const accountLabel = knownLabel ?? session.accountLabel;
  const navGroups = (owner ?? session.isOwner)
    ? baseNavGroups.map((g) => (ownerNavItems[g.id] ? { ...g, items: [...g.items, ...ownerNavItems[g.id]] } : g))
    : baseNavGroups;
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const activeKey = navGroups.find((g) => g.items.some((i) => isOn(pathname, i.page.href)))?.id;

  useLayoutEffect(() => {
    const measure = () => {
      const el = activeKey ? triggerRefs.current.get(activeKey) : undefined;
      const nav = navRef.current;
      if (!el || !nav) return setPill(null);
      // Group triggers sit inside a `relative` wrapper, so offsetLeft would be 0;
      // measure against the nav itself.
      const rect = el.getBoundingClientRect();
      setPill({ left: rect.left - nav.getBoundingClientRect().left, width: rect.width });
    };
    measure();
    // Trigger widths change once the web font swaps in, and with the viewport.
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeKey]);

  const closeMenus = () => {
    setOpenGroup(null);
    setMobileOpen(false);
  };

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const setTrigger = (key: string) => (el: HTMLElement | null) => {
    if (el) triggerRefs.current.set(key, el);
    else triggerRefs.current.delete(key);
  };

  const triggerClass = (active: boolean) =>
    `relative z-10 flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${
      active
        ? "text-slate-900 dark:text-slate-100"
        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
    }`;

  return (
    <header className="header-enter sticky top-0 z-40 border-b border-slate-200/80 bg-[#f7f8fa]/90 backdrop-blur-xl dark:border-slate-800 dark:bg-[#080b12]/90">
      <div className="grid h-14 grid-cols-[1fr_auto] items-center gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr]">
        <Link href="/" className="flex shrink-0 items-center gap-2 justify-self-start">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200/90 dark:ring-slate-700">
            <Image
              src="/worldview-mark-red.svg"
              alt=""
              width={32}
              height={32}
              loading="eager"
              className="h-full w-full object-contain"
            />
          </span>
          <span className="text-base font-semibold tracking-tight text-slate-900 dark:text-slate-100">Worldview</span>
        </Link>

        <nav ref={navRef} aria-label="Main" className="relative hidden items-center gap-1 lg:flex">
          {pill ? (
            <span
              aria-hidden
              className="absolute top-1/2 h-8 -translate-y-1/2 rounded-md bg-slate-100 transition-[left,width] duration-300 ease-out dark:bg-slate-800"
              style={{ left: pill.left, width: pill.width }}
            />
          ) : null}

          {navGroups.map((group) => {
            const open = openGroup === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  ref={setTrigger(group.id)}
                  aria-haspopup="menu"
                  aria-expanded={open}
                  onClick={() => setOpenGroup(open ? null : group.id)}
                  // Once one menu is open, hovering another switches to it.
                  onPointerEnter={() => openGroup && openGroup !== group.id && setOpenGroup(group.id)}
                  className={triggerClass(activeKey === group.id)}
                >
                  {group.label}
                  <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                </button>

                {open ? (
                  <div
                    role="menu"
                    className="absolute top-full left-1/2 z-30 mt-3 grid w-[42rem] -translate-x-1/2 grid-cols-[1.05fr_.95fr] gap-2 rounded-3xl border border-slate-200/80 bg-white p-2 shadow-2xl shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40"
                  >
                    <div className="p-1">
                      <p className="px-3 pb-2 pt-1 text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">{group.label}</p>
                      {group.items.map(({ page, blurb }) => {
                        const Icon = ICONS[page.href] ?? Compass;
                        const active = isOn(pathname, page.href);
                        return (
                          <Link
                            key={page.href}
                            href={page.href}
                            role="menuitem"
                            onClick={closeMenus}
                            className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors ${active ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900"}`}
                          >
                            <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors ${active ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 group-hover:bg-slate-900 group-hover:text-white dark:bg-slate-900 dark:text-slate-300 dark:group-hover:bg-white dark:group-hover:text-slate-950"}`}>
                              <Icon size={16} aria-hidden />
                            </span>
                            <span>
                              <span className="block text-sm font-semibold text-slate-900 dark:text-slate-100">{page.label}</span>
                              <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">{blurb}</span>
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                    <MegaMenuFeature groupId={group.id} previews={previews} closeMenus={closeMenus} />
                  </div>
                ) : null}
              </div>
            );
          })}

        </nav>

        <div className="flex items-center gap-1 justify-self-end">
          <div className="hidden w-48 shrink-0 xl:block 2xl:w-64">
            <GlobalSearch placeholder="Search Worldview…" />
          </div>
          <div className="relative shrink-0 xl:hidden">
            <button
              type="button"
              onClick={() => setSearchOpen((o) => !o)}
              aria-label="Search"
              className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {searchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
            {searchOpen ? (
              <div className="absolute top-full right-0 z-30 mt-2 w-[min(20rem,calc(100vw-2rem))]">
                <GlobalSearch placeholder="Search Worldview…" autoFocus />
              </div>
            ) : null}
          </div>

          <SettingsMenu />

          {accountLabel ? <NewMenu /> : null}

          {accountLabel ? (
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/account"
                className="hidden max-w-48 truncate rounded-md xl:max-w-32 2xl:max-w-48 px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                {accountLabel}
              </Link>
              <form action="/auth/signout" method="post">
                <button
                  type="submit"
                  className="rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                >
                  Sign out
                </button>
              </form>
            </div>
          ) : (
            <Link
              href={`/login?next=${encodeURIComponent(pathname)}`}
              className="shrink-0 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              Sign in
            </Link>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <nav
          aria-label="Main"
          className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto border-t border-slate-200 px-4 pt-4 pb-6 lg:hidden dark:border-slate-800"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            {navGroups.map((group) => (
              <section key={group.id}>
                <p className="px-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">{group.label}</p>
                <ul className="mt-2 space-y-0.5">
                  {group.items.map(({ page, blurb }) => {
                    const Icon = ICONS[page.href] ?? Compass;
                    const active = isOn(pathname, page.href);
                    return (
                      <li key={page.href}>
                        <Link
                          href={page.href}
                          onClick={closeMenus}
                          className={`flex items-center gap-3 rounded-xl px-2 py-2 ${
                            active ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900"
                          }`}
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                            <Icon size={16} aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900 dark:text-slate-100">{page.label}</span>
                            <span className="block truncate text-xs text-slate-500 dark:text-slate-400">{blurb}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        </nav>
      ) : null}
    </header>
  );
}

function MegaMenuFeature({
  groupId,
  previews,
  closeMenus,
}: {
  groupId: string;
  previews?: NavPreviews;
  closeMenus: () => void;
}) {
  const feature = GROUP_FEATURES[groupId];
  if (!feature) return null;
  const accents: Record<string, string> = {
    issues: "from-indigo-700 to-blue-700",
    economy: "from-emerald-700 to-teal-700",
    society: "from-blue-700 to-cyan-600",
    power: "from-violet-700 to-fuchsia-700",
    // Neutral, so the red and blue state tiles read clearly.
    government: "from-slate-800 to-slate-900",
    tools: "from-teal-700 to-cyan-700",
  };
  const preview = previews ? <MegaMenuPreview groupId={groupId} previews={previews} /> : null;
  return (
    <Link href={feature.href} role="menuitem" onClick={closeMenus} className={`group relative flex min-h-64 flex-col overflow-hidden rounded-[1.15rem] bg-gradient-to-br p-5 text-white ${accents[groupId]}`}>
      {preview && <div className="mb-5 shrink-0">{preview}</div>}
      <div className="relative mt-auto">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-white/70 uppercase">{feature.eyebrow}</p>
        <p className="mt-2 text-lg font-semibold tracking-tight">{feature.title}</p>
        <p className="mt-2 text-xs leading-5 text-white/75">{feature.body}</p>
        <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold">Explore <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" /></span>
      </div>
    </Link>
  );
}

// A real glimpse of each section, with a one-line caption saying what it is.
function MegaMenuPreview({ groupId, previews }: { groupId: string; previews: NavPreviews }) {
  if (groupId === "issues" && previews.issues) {
    const { points } = previews.issues;
    return <LineChart points={points} caption={`Foreign-born share of the U.S. population, ${points[0][0]}–${points.at(-1)![0]}: ${points.at(-1)![1].toFixed(1)}% today`} />;
  }
  if (groupId === "economy" && previews.economy) {
    const { points } = previews.economy;
    const [lastYear, lastValue] = points.at(-1)!;
    return <LineChart points={points} caption={`Real median household income, ${points[0][0]}–${lastYear}: $${Math.round(lastValue).toLocaleString("en-US")} in ${lastYear}`} />;
  }
  if (groupId === "society" && previews.society) return <ShareChart data={previews.society} />;
  if (groupId === "power") {
    const { total, categories } = previews.power;
    return (
      <figure aria-hidden>
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <span key={c.label} className="rounded-md bg-white/15 px-1.5 py-0.5 text-[11px] font-medium">
              {c.label} <span className="text-white/60 tabular-nums">{c.count}</span>
            </span>
          ))}
        </div>
        <figcaption className="mt-2 text-[11px] text-white/65">
          {total} relationship types across {categories.length} kinds
        </figcaption>
      </figure>
    );
  }
  if (groupId === "government" && previews.government) {
    const { year, highlights } = previews.government;
    const tossups = highlights.filter((race) => race.rating === "tossup");
    return (
      <figure aria-hidden>
        <div className="grid grid-cols-2 gap-1.5">
          {tossups.map((race) => <div key={`${race.office}-${race.state}`} className="rounded-md bg-white/15 px-2 py-1.5"><p className="text-xs font-semibold">{race.state}</p><p className="text-[9px] text-white/60">{race.office} · toss-up</p></div>)}
        </div>
        <figcaption className="mt-2 text-[11px] text-white/65">{year} midterm battlegrounds · {highlights.length} competitive races</figcaption>
      </figure>
    );
  }
  if (groupId === "tools") {
    return (
      <figure aria-hidden className="space-y-2">
        {previews.tools.map((axis, i) => (
          <div key={axis.name}>
            <div className="relative h-1 rounded-full bg-white/25">
              <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white" style={{ left: `${[30, 68, 45][i] ?? 50}%` }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-white/65">
              <span>{axis.negative}</span>
              <span className="font-medium text-white/90">{axis.name}</span>
              <span>{axis.positive}</span>
            </div>
          </div>
        ))}
      </figure>
    );
  }
  return null;
}

function LineChart({ points, caption }: { points: [number, number][]; caption: string }) {
  const W = 260;
  const H = 72;
  const [x0, x1] = [points[0][0], points.at(-1)![0]];
  const values = points.map(([, v]) => v);
  // Income starts far from zero, so scale to the series' own range.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const lo = min > 0 && min / max > 0.4 ? min : 0;
  const x = (year: number) => ((year - x0) / (x1 - x0)) * W;
  const y = (v: number) => H - ((v - lo) / (max - lo)) * (H - 6);
  return (
    <figure aria-hidden>
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="h-20 w-full overflow-visible" preserveAspectRatio="none">
        <path
          d={points.map(([yr, v], i) => `${i ? "L" : "M"}${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("")}
          fill="none"
          stroke="white"
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <figcaption className="mt-2 text-[11px] text-white/65">{caption}</figcaption>
    </figure>
  );
}

function ShareChart({ data }: { data: NonNullable<NavPreviews["society"]> }) {
  const W = 260;
  const H = 72;
  const [y0, y1] = data.years;
  const max = Math.max(...data.lines.flatMap((l) => l.points.map(([, v]) => v)));
  const x = (year: number) => ((year - y0) / (y1 - y0)) * W;
  const y = (v: number) => H - (v / max) * (H - 6);
  const path = (pts: [number, number][]) => pts.map(([yr, v], i) => `${i ? "L" : "M"}${x(yr).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const tones = ["#ffffff", "#fde68a"];
  return (
    <figure aria-hidden>
      <svg viewBox={`0 0 ${W} ${H + 2}`} className="h-20 w-full overflow-visible" preserveAspectRatio="none">
        <line x1={x(data.observedThrough)} x2={x(data.observedThrough)} y1={0} y2={H} stroke="white" strokeOpacity={0.3} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
        {data.lines.map((line, i) => (
          <g key={line.label}>
            <path d={path(line.points.filter(([yr]) => yr <= data.observedThrough))} fill="none" stroke={tones[i]} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            <path d={path(line.points.filter(([yr]) => yr >= data.observedThrough))} fill="none" stroke={tones[i]} strokeWidth={2} strokeDasharray="4 3" strokeOpacity={0.8} vectorEffect="non-scaling-stroke" />
          </g>
        ))}
      </svg>
      <figcaption className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-white/65">
        {data.lines.map((line, i) => (
          <span key={line.label} className="inline-flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: tones[i] }} />
            {line.label} {Math.round(line.points[0][1])}% → {Math.round(line.points.at(-1)![1])}%
          </span>
        ))}
        <span>
          Share of U.S. population, {data.years[0]}–{data.years[1]}, projected after {data.observedThrough}
        </span>
      </figcaption>
    </figure>
  );
}
