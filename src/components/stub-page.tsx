import Link from "next/link";
import type { PageContent } from "@/lib/pages-content";

export function StubPage({ content }: { content: PageContent }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">{content.title}</h1>
      <p className="mt-1 text-slate-500 dark:text-slate-400">{content.tagline}</p>

      <ul className="mt-6 flex flex-col gap-2">
        {content.features.map((feature) => (
          <li
            key={feature}
            className="rounded-md border border-slate-200 px-4 py-2.5 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300"
          >
            {feature}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
        No dedicated view here yet — the underlying entities, relationships, claims, and
        sources this page will visualize already live in the shared graph. Add some in{" "}
        <Link href="/data" className="underline underline-offset-2">
          Manage Data
        </Link>
        .
      </p>
    </div>
  );
}
