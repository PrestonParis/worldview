import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { SavePhilosophy } from "@/components/atlas/save-philosophy";
import { getCurrentUser } from "@/lib/auth/session";
import { getAtlasProfile } from "@/lib/db/atlasProfiles";
import { philosophyById, philosophyProfiles, nearestPhilosophies } from "@/lib/atlas/philosophies";
import { AXIS_GROUPS, axes } from "@/lib/quiz/axes";
import { familyColor, FAMILIES } from "@/lib/quiz/families";
import { umbrellaOf } from "@/lib/quiz/ideologies";

export function generateStaticParams() { return philosophyProfiles.map((p) => ({ id: p.ideology.id })); }
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> { const profile = philosophyById.get((await params).id); return profile ? { title: `${profile.ideology.name} · Worldview Atlas`, description: profile.ideology.description } : {}; }

const eyebrow = "text-xs font-semibold tracking-[.16em] text-slate-400 uppercase";

export default async function PhilosophyPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = philosophyById.get((await params).id);
  if (!profile) notFound();
  const user = await getCurrentUser();
  const saved = user ? (await getAtlasProfile(user.id)).savedPhilosophies.includes(profile.ideology.id) : false;
  const { ideology, history } = profile;
  const color = familyColor(ideology.family);
  const nearest = nearestPhilosophies(ideology);
  const umbrella = umbrellaOf(ideology.id);
  const members = (ideology.covers ?? []).flatMap((id) => philosophyById.get(id)?.ideology ?? []);
  return (
    <article className="mx-auto max-w-5xl pb-16">
      <Link href="/atlas/philosophies" className="text-sm text-slate-500 hover:text-slate-950 dark:hover:text-white">← All philosophies</Link>
      <header className="mt-8 border-b border-slate-200 pb-10 dark:border-slate-800">
        <p className="text-sm font-semibold" style={{ color }}>{FAMILIES[ideology.family].label} · {profile.kind}</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight text-balance sm:text-7xl">{ideology.name}</h1>
        <p className="mt-5 max-w-3xl text-xl leading-8 text-slate-600 dark:text-slate-300">{ideology.description}</p>
        <dl className="mt-8 grid gap-6 sm:grid-cols-3">
          <div><dt className={eyebrow}>Began</dt><dd className="mt-1.5 font-medium">{history.origins.when}</dd></div>
          <div><dt className={eyebrow}>Where</dt><dd className="mt-1.5 font-medium">{history.origins.where}</dd></div>
          <div><dt className={eyebrow}>Founded by</dt><dd className="mt-1.5 font-medium">{history.origins.founders.join(", ")}</dd></div>
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <SavePhilosophy id={ideology.id} initial={saved} />
          <Link href={`/atlas/compare?ids=${[ideology.id, ...nearest.slice(0, 2).map((x) => x.id)].join(",")}`} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700">Compare neighbors</Link>
        </div>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-12">
          <section>
            <p className={eyebrow}>Timeline</p>
            <ol className="relative mt-5 space-y-6 border-l border-slate-200 pl-6 dark:border-slate-800">
              {history.timeline.map((t, i) => (
                <li key={i} className="relative">
                  <span className="absolute top-1.5 left-[-1.95rem] size-3 rounded-full ring-4 ring-white dark:ring-slate-950" style={{ backgroundColor: color }} />
                  <p className="text-sm font-semibold tabular-nums" style={{ color }}>{t.year}</p>
                  <p className="mt-1 leading-7 text-slate-700 dark:text-slate-200">{t.event}</p>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <p className={eyebrow}>In practice</p>
            <ul className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
              {history.practice.map((p) => (
                <li key={p.name} className="grid gap-1 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-6">
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-slate-600 dark:text-slate-300">{p.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={eyebrow}>Primary texts</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {history.texts.map((t) => (
                <li key={t.title} className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
                  <p className="font-semibold">{t.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{t.author} · {t.year}</p>
                  {t.href && <a href={t.href} rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">Read it <ArrowUpRight size={14} /></a>}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <p className={eyebrow}>Atlas model profile</p>
            <div className="mt-5 space-y-7">
              {AXIS_GROUPS.map((g) => (
                <div key={g.id}>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{g.label}</p>
                  <div className="mt-3 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                    {axes.filter((a) => a.group === g.id).map((a) => {
                      const value = ideology.position[a.id];
                      return (
                        <div key={a.id}>
                          <div className="flex justify-between gap-2 text-[11px] text-slate-500"><span>{a.negative.label}</span><strong className="text-slate-800 dark:text-slate-200">{a.name}</strong><span>{a.positive.label}</span></div>
                          <div className="relative mt-2 h-1 rounded-full bg-slate-200 dark:bg-slate-800"><span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white dark:ring-slate-950" style={{ left: `${(value + 1) * 50}%`, backgroundColor: color }} /></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Key figures</p>
            <ul className="mt-3 space-y-1.5 text-sm font-medium">{history.figures.map((f) => <li key={f}>{f}</li>)}</ul>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Classification</p>
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="text-slate-500">Kind</dt><dd className="font-medium">{profile.kind}</dd></div>
              <div><dt className="text-slate-500">Scope</dt><dd className="font-medium">{profile.scopes.join(", ")}</dd></div>
              {umbrella && (
                <div><dt className="text-slate-500">Part of</dt><dd><Link href={`/atlas/philosophies/${umbrella.id}`} className="font-medium underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:decoration-slate-600">{umbrella.name}</Link></dd></div>
              )}
              {members.length > 0 && (
                <div><dt className="text-slate-500">Includes</dt><dd className="mt-1 space-y-1">{members.map((m) => <Link key={m.id} href={`/atlas/philosophies/${m.id}`} className="block font-medium underline decoration-slate-300 underline-offset-4 hover:decoration-current dark:decoration-slate-600">{m.name}</Link>)}</dd></div>
              )}
            </dl>
          </div>
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Categorical positions</p>
            <dl className="mt-4 space-y-3 text-sm">
              {profile.lenses.map((l) => (
                <div key={l.label}><dt className="text-slate-500">{l.label}</dt><dd className="font-medium">{l.answer}</dd></div>
              ))}
            </dl>
          </div>
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Nearby in Atlas</p>
            <div className="mt-3 space-y-2">{nearest.map((n) => <Link key={n.id} href={`/atlas/philosophies/${n.id}`} className="block rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold hover:border-slate-400 dark:border-slate-800 dark:hover:border-slate-600">{n.name}</Link>)}</div>
          </div>
        </aside>
      </div>
    </article>
  );
}
