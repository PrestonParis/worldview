import type { Metadata } from "next";
import Link from "next/link";
import { startQuizAction } from "@/lib/actions/quiz";
import { currentUserId } from "@/lib/quiz/access";
import { listQuizSessions } from "@/lib/db/quizSessions";
import { statements, issues } from "@/lib/quiz/bank";
import { axes } from "@/lib/quiz/axes";
import { ideologies } from "@/lib/quiz/ideologies";
import { buttonVariants } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Political Quiz | Worldview",
  description: "An adaptive, in-depth quiz that maps your views on 17 political axes and 25 issues.",
};

export const dynamic = "force-dynamic";

export default async function QuizPage() {
  const userId = await currentUserId();
  const mine = userId ? await listQuizSessions(userId) : [];

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Political quiz · Extensive</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Where do you stand?</h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          An adaptive quiz that maps your views on {axes.length} axes of American politics and builds a detailed
          position on {issues.length} issues. It skips questions your earlier answers already settle and spends more on
          the areas where your views are mixed.
        </p>
        <form action={startQuizAction} className="mt-6">
          <button type="submit" className={`${buttonVariants.primary} px-5 py-2.5 text-base`}>
            Start the quiz
          </button>
        </form>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <Fact value="~170–210" label="questions, depending on how settled your views are" />
        <Fact value="Saved" label="after every answer, so you can stop and come back" />
        <Fact value="7 days" label="to claim your quiz before an unclaimed one is deleted" />
      </section>

      <section className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">What you get</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your position on each axis, with how confidently your answers place you there.</li>
          <li>A policy profile for every issue: legality, limits, exceptions, who decides, and more.</li>
          <li>All {ideologies.length} ideological traditions ranked by distance from your views, with an axis-by-axis comparison.</li>
          <li>The answers that moved each axis, which you can change and see the results update.</li>
        </ul>
        <p className="text-xs text-slate-400">
          Question bank: {statements.length} statements and {issues.reduce((n, m) => n + 1 + m.followUps.length, 0)} issue
          questions.
        </p>
      </section>

      {mine.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Your quizzes</h2>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {mine.map((q) => (
              <li key={q.id}>
                <Link
                  href={`/quiz/${q.slug}`}
                  className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  <span className="text-slate-900 dark:text-slate-100">
                    {q.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    <span className="ml-2 text-slate-400">{q.answers.length} answers</span>
                  </span>
                  <span className="text-xs text-slate-500">
                    {q.status === "complete" ? "Complete" : "In progress"} · {q.visibility === "private" ? "Private" : "Public"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
      <p className="text-xl font-semibold text-slate-950 dark:text-white">{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}
