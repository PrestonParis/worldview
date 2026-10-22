import type { ReactNode } from "react";

// Building blocks shared by the issue pages: page header, question-led
// sections, body copy, and the empty state before an import.

export function IssueHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="max-w-3xl">
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">{title}</h1>
      {children}
    </header>
  );
}

export function Section({ id, title, question, children }: { id: string; title: string; question: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 space-y-6">
      <div className="max-w-3xl border-t border-slate-200 pt-10 dark:border-slate-800">
        <h2 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{title}</h2>
        <p className="mt-1.5 text-base leading-6 text-slate-600 sm:text-lg sm:leading-7 dark:text-slate-300">{question}</p>
      </div>
      {children}
    </section>
  );
}

export function Prose({ children }: { children: ReactNode }) {
  return <div className="max-w-3xl space-y-3 text-base leading-7 text-slate-600 dark:text-slate-300">{children}</div>;
}

export function IssueEmpty({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-7xl">
      <h1 className="text-4xl font-bold tracking-tight text-slate-950 dark:text-white">{title}</h1>
      <p className="mt-4 text-slate-500">No {title.toLowerCase()} data is loaded yet.</p>
    </div>
  );
}
