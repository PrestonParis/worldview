import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

// Shared shell for every auth screen: brand lockup, heading, body, legal line.
export function AuthLayout({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: string | null;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh justify-center px-4 pb-16 pt-[10vh]">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="group inline-flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-slate-200/90 dark:ring-slate-700">
            <Image src="/worldview-mark-red.svg" alt="" width={40} height={40} priority className="h-full w-full object-contain" />
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-bold leading-tight tracking-tight text-slate-950 dark:text-white">Worldview</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">Political data, tools &amp; intelligence</span>
          </span>
        </Link>

        <h1 className="mt-10 text-[26px] font-semibold leading-tight tracking-tight text-slate-950 dark:text-white">{title}</h1>
        {intro ? <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{intro}</p> : null}

        <div className="mt-8">{children}</div>

        <p className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-400 dark:border-slate-800 dark:text-slate-500">
          By continuing, you agree to Worldview&apos;s{" "}
          <Link href="/terms" className="text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 hover:decoration-red-600 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-100 dark:hover:decoration-red-500">
            Terms of Use
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 hover:decoration-red-600 dark:text-slate-400 dark:decoration-slate-600 dark:hover:text-slate-100 dark:hover:decoration-red-500">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
