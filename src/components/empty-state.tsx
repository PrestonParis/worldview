import Link from "next/link";
import type { PageContent } from "@/lib/pages-content";

export function EmptyStateFeatures({
  content,
  message,
  cta = { href: "/data", label: "Manage Data" },
}: {
  content: PageContent;
  message: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="max-w-2xl">
      <ul className="flex flex-col gap-2">
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
        {message}{" "}
        <Link href={cta.href} className="underline underline-offset-2">
          {cta.label}
        </Link>
        .
      </p>
    </div>
  );
}
