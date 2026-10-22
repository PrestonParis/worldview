import type { Metadata } from "next";
import Link from "next/link";
import { YourAtlasLocal } from "@/components/atlas/your-atlas-local";
import { getCurrentUser } from "@/lib/auth/session";
import { getAtlasProfile } from "@/lib/db/atlasProfiles";
import { viewerQuizSessions } from "@/lib/quiz/access";
import { EMPTY_ATLAS_PROFILE } from "@/lib/atlas/profile";
import { computeState } from "@/lib/quiz/engine";
import { computeResult } from "@/lib/quiz/results";
import { familyColor } from "@/lib/quiz/families";
import { CATALOG } from "@/lib/quiz/catalog";

export const metadata: Metadata = { title: "Your Atlas · Worldview", description: "Your political worldview, specialist assessments, and saved philosophy library." };
export const dynamic = "force-dynamic";

export default async function YourAtlasPage() {
  const user = await getCurrentUser();
  const [profile, sessions] = await Promise.all([user ? getAtlasProfile(user.id) : EMPTY_ATLAS_PROFILE, viewerQuizSessions().then((xs) => xs.map((x) => x.session))]);
  const latest = sessions.find((x) => x.status === "complete");
  const result = latest ? computeResult(latest.answers, latest.refine, computeState(latest.answers, latest.refine)) : null;
  const top = result?.ideologies[0];
  return <div className="mx-auto max-w-5xl space-y-6 pb-16"><header className="mb-10"><Link href="/atlas" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← Atlas</Link><p className="mt-6 text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Living profile</p><h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">Your Atlas</h1><p className="mt-3 hidden max-w-2xl text-base leading-7 text-slate-600 sm:block dark:text-slate-300">Your results, assessments, and saved traditions.</p>{!user && <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">This browser can remember specialist results and saved reading. <Link href="/login?next=/atlas/me" className="font-semibold underline">Sign in</Link> to keep Political Atlas sessions and sync future Atlas data.</p>}</header>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950" style={top ? { borderLeft: `5px solid ${familyColor(top.ideology.family)}` } : undefined}><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Political worldview</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{top ? top.ideology.name : "Your political map is waiting"}</h2>{top ? <><p className="mt-2 max-w-2xl leading-7 text-slate-600 dark:text-slate-300">Your current neighborhood also includes {result!.ideologies.slice(1, 3).map((x) => x.ideology.name).join(" and ")}.</p><div className="mt-4 flex flex-wrap gap-2">{result!.ideologies.slice(0, 3).map((x) => <Link key={x.ideology.id} href={`/atlas/philosophies/${x.ideology.id}`} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-900">{x.ideology.name} · {x.match}%</Link>)}</div></> : <p className="mt-2 text-sm text-slate-500">Atlas measures {CATALOG.axes} dimensions independently and keeps uncertainty visible.</p>}</div><Link href={latest ? `/quiz/${latest.slug}` : "/quiz"} className="shrink-0 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">{latest ? "Open result" : "Take the Atlas"}</Link></div>{sessions.length > 1 && <p className="mt-5 border-t border-slate-100 pt-4 text-xs text-slate-400 dark:border-slate-900">{sessions.length} saved Atlas sessions · latest updated {latest?.updatedAt.toLocaleDateString()}</p>}</section>
    <YourAtlasLocal serverEconomic={profile.economicResult} serverAuthority={profile.authorityResult} serverForeignPolicy={profile.foreignPolicyResult} serverSaved={profile.savedPhilosophies} />
  </div>;
}
