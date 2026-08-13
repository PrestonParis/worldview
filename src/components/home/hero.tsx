import Link from "next/link";
import { GlobalSearch } from "@/components/search/global-search";

const EXAMPLE_SEARCHES = ["Trump", "Ukraine", "Byron Donalds", "Wisconsin", "Heritage Foundation"];

const CHIPS = [
  { label: "Explore people", href: "/people" },
  { label: "Track statements", href: "/statements" },
  { label: "Follow the money", href: "/money" },
  { label: "Check claims", href: "/fact-check" },
];

export function Hero() {
  return (
    <div className="flex flex-col items-center py-10 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-balance text-slate-900 sm:text-[2.75rem] dark:text-slate-100">
        Worldview
      </h1>
      <p className="mt-2 max-w-xl text-base text-slate-500 dark:text-slate-400">
        An overhead view of US Politics
      </p>

      <div className="mt-6 w-full max-w-xl">
        <GlobalSearch
          size="lg"
          placeholders={EXAMPLE_SEARCHES.map((s) => `Search “${s}”…`)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {CHIPS.map((chip) => (
          <Link
            key={chip.href}
            href={chip.href}
            className="rounded-full border border-slate-200 px-3.5 py-1.5 text-sm text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-slate-100"
          >
            {chip.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
