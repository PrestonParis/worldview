"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Baby,
  Banknote,
  ChevronDown,
  Church,
  Compass,
  Crosshair,
  Gavel,
  Globe2,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  Map as MapIcon,
  Menu,
  Network,
  PersonStanding,
  Receipt,
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
import { navGroups, navLinks } from "@/lib/nav";
import { GlobalSearch } from "@/components/search/global-search";
import { NewMenu } from "@/components/nav/new-menu";
import { SettingsMenu } from "@/components/nav/settings-menu";
import { HERO_SEARCH_ID } from "@/components/home/hero-search-id";
import type { NavPreviews } from "@/lib/nav-previews";

const ICONS: Record<string, LucideIcon> = {
  "/immigration": PersonStanding,
  "/crime": ShieldAlert,
  "/abortion": Stethoscope,
  "/guns": Crosshair,
  "/health-care": HeartPulse,
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
  "/legislation": Gavel,
  "/elections": Vote,
  "/my-government": Landmark,
  "/quiz": Compass,
  "/geography": Globe2,
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
  democracy: { eyebrow: "Start with your address", title: "Government, made personal", body: "Find the offices that represent you, then explore the elections and districts beneath them.", href: "/my-government" },
  tools: { eyebrow: "Work with Worldview", title: "Explore it your way", body: "Map your politics or build a geographic view from the platform's underlying tools.", href: "/quiz" },
};

export function Header({ accountLabel, previews }: { accountLabel: string | null; previews?: NavPreviews }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Map<string, HTMLElement>>(new Map());
  const [pill, setPill] = useState<PillRect | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // On the homepage the hero has its own search box; the header's appears
  // only once that box has scrolled out of view.
  const [heroInView, setHeroInView] = useState(true);
  const heroSearchVisible = pathname === "/" && heroInView;

  useEffect(() => {
    const target = document.getElementById(HERO_SEARCH_ID);
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => {
      setHeroInView(entry.isIntersecting);
      if (entry.isIntersecting) setSearchOpen(false);
    }, { rootMargin: "-64px 0px 0px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [pathname]);

  const activeKey =
    navGroups.find((g) => g.items.some((i) => isOn(pathname, i.page.href)))?.id ??
    navLinks.find((p) => isOn(pathname, p.href))?.href;

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
          <span className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
            <Image src="/logo.png" alt="" width={28} height={28} className="h-full w-full object-cover" />
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

          <span aria-hidden className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-800" />

          {navLinks.map((page) => (
            <Link key={page.href} href={page.href} ref={setTrigger(page.href)} onClick={closeMenus} className={triggerClass(activeKey === page.href)}>
              {page.navLabel}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1 justify-self-end">
          <div className={`relative shrink-0 transition-opacity ${heroSearchVisible ? "pointer-events-none opacity-0" : "opacity-100"}`} aria-hidden={heroSearchVisible || undefined}>
            <button
              type="button"
              tabIndex={heroSearchVisible ? -1 : undefined}
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
                className="hidden max-w-48 truncate rounded-md px-2.5 py-1.5 text-sm text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 sm:inline dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
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
          <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            {navLinks.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                onClick={closeMenus}
                className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200"
              >
                {page.label}
              </Link>
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
    democracy: "from-slate-800 to-slate-900",
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
  if (groupId === "issues" && previews.issues) return <ForeignBornChart points={previews.issues.points} />;
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
  if (groupId === "democracy" && previews.democracy) {
    const { year, states } = previews.democracy;
    const cols = Math.max(...states.map((s) => s.col)) + 1;
    const rows = Math.max(...states.map((s) => s.row)) + 1;
    return (
      <figure aria-hidden>
        <svg viewBox={`0 0 ${cols * 10} ${rows * 10}`} className="h-24 w-auto">
          {states.map((s) => (
            <rect
              key={s.abbr}
              x={s.col * 10 + 0.6}
              y={s.row * 10 + 0.6}
              width={8.8}
              height={8.8}
              rx={1.6}
              fill={s.winner === "D" ? "#3b82f6" : s.winner === "R" ? "#ef4444" : "rgb(255 255 255 / 0.2)"}
            >
              <title>{s.abbr}</title>
            </rect>
          ))}
        </svg>
        <figcaption className="mt-2 text-[11px] text-white/65">{year} presidential winner by state</figcaption>
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

function ForeignBornChart({ points }: { points: [number, number][] }) {
  const W = 260;
  const H = 72;
  const [x0, x1] = [points[0][0], points.at(-1)![0]];
  const max = Math.max(...points.map(([, v]) => v));
  const x = (year: number) => ((year - x0) / (x1 - x0)) * W;
  const y = (v: number) => H - (v / max) * (H - 6);
  const [lastYear, lastValue] = points.at(-1)!;
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
      <figcaption className="mt-2 text-[11px] text-white/65">
        Foreign-born share of the U.S. population, {x0}–{lastYear}: {lastValue.toFixed(1)}% today
      </figcaption>
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
