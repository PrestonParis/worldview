"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

// Money & Influence views. Industries and the donor map live under Donors.
const TABS = [
  { href: "/money", label: "Overview", match: ["/money"] },
  { href: "/money/candidates", label: "Candidates & races", match: ["/money/candidates"] },
  { href: "/money/donors", label: "Donors", match: ["/money/donors", "/money/industries", "/money/map"] },
  { href: "/money/outside-spending", label: "Outside spending", match: ["/money/outside-spending"] },
  { href: "/money/lobbying", label: "Lobbying", match: ["/money/lobbying"] },
  { href: "/money/contributions", label: "Contributions explorer", match: ["/money/contributions"] },
];

export function MoneyTabs() {
  const pathname = usePathname();
  const cycle = useSearchParams().get("cycle");
  return (
    <nav aria-label="Money & Influence" className="-mx-4 overflow-x-auto border-b border-slate-200 px-4 sm:-mx-8 sm:px-8 dark:border-slate-800">
      <ul className="flex gap-1 text-sm whitespace-nowrap">
        {TABS.map((tab) => {
          const on = tab.match.includes(pathname);
          // Lobbying isn't cycle-scoped; every other view keeps the cycle.
          const href = cycle && tab.href !== "/money/lobbying" ? `${tab.href}?cycle=${cycle}` : tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                className={`-mb-px inline-block border-b-2 px-3 py-2.5 font-medium ${
                  on
                    ? "border-slate-900 text-slate-950 dark:border-white dark:text-white"
                    : "border-transparent text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
