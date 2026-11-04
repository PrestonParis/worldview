import Link from "next/link";

// The results hub's sections. Closest keeps its original /writ/close-races URL
// because those links are already out in the world.
const TABS = [
  { id: "overview", label: "Overview", href: (e: string) => `/writ/results/${e}` },
  { id: "closest", label: "Closest races", href: (e: string) => `/writ/close-races/${e}` },
  { id: "counties", label: "Counties", href: (e: string) => `/writ/results/${e}/counties` },
] as const;

export function ResultsTabs({ election, active }: { election: string; active: (typeof TABS)[number]["id"] | null }) {
  const id = encodeURIComponent(election);
  return (
    <nav aria-label="Results sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {TABS.map((tab) => (
        <Link
          key={tab.id}
          href={tab.href(id)}
          aria-current={active === tab.id ? "page" : undefined}
          className={`-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-semibold ${
            active === tab.id ? "border-rose-600 text-slate-950 dark:border-rose-400 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
