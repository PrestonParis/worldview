import Link from "next/link";

export function EmptyState({
  message,
  cta = { href: "/data", label: "Manage Data" },
}: {
  message: string;
  cta?: { href: string; label: string };
}) {
  return (
    <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
      {message}{" "}
      <Link href={cta.href} className="underline underline-offset-2">
        {cta.label}
      </Link>
      .
    </p>
  );
}
