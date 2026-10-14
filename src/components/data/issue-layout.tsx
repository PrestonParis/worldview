import type { ReactNode } from "react";

// Building blocks shared by the issue pages: page header, question-led
// sections, body copy, key findings, and the empty state before an import.

export function IssueHeader({ eyebrow = "United States", title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">{title}</h1>
      <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">{children}</p>
    </header>
  );
}

export function Section({ id, title, question, children }: { id: string; title: string; question: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-2 text-lg leading-7 text-slate-700 dark:text-slate-200">{question}</p>
      </div>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-3 text-base leading-7 text-slate-600 dark:text-slate-300">{children}</div>;
}

export function KeyFindings({ findings }: { findings: string[] }) {
  if (!findings.length) return null;
  return (
    <div className="rounded-2xl bg-slate-50 p-5 dark:bg-slate-900/60">
      <h3 className="text-base font-semibold text-slate-950 dark:text-white">Key findings</h3>
      <ul className="mt-3 space-y-2.5 text-sm leading-6 text-slate-700 dark:text-slate-300">
        {findings.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-blue-600 dark:bg-blue-400" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function IssueEmpty({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-4 text-slate-500">No {title.toLowerCase()} data is loaded yet.</p>
    </div>
  );
}
