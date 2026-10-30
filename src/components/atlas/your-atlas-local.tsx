"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { economicSchools } from "@/lib/atlas/economics";
import { authoritySchools } from "@/lib/atlas/authority";
import type { EconomicProfileResult, SpecialistProfileResult } from "@/lib/atlas/profile";
import { economicProfileSchema, savedPhilosophiesSchema, specialistProfileSchema } from "@/lib/atlas/profile-schema";
import { readStoredJson } from "@/lib/browser/storage";
import { allTraditions } from "@/lib/quiz/ideologies";
import { authorityAssessment, foreignPolicyAssessment, type SpecialistAssessment } from "@/lib/atlas/specialists";
import { specialistStorageKey } from "./specialist-assessment";

export function YourAtlasLocal({
  serverEconomic,
  serverAuthority,
  serverForeignPolicy,
  serverSaved,
}: {
  serverEconomic: EconomicProfileResult | null;
  serverAuthority: SpecialistProfileResult | null;
  serverForeignPolicy: SpecialistProfileResult | null;
  serverSaved: string[];
}) {
  const [economic, setEconomic] = useState<EconomicProfileResult | null>(serverEconomic);
  const [authority, setAuthority] = useState<SpecialistProfileResult | null>(serverAuthority);
  const [foreignPolicy, setForeignPolicy] = useState<SpecialistProfileResult | null>(serverForeignPolicy);
  const [saved, setSaved] = useState(serverSaved);
  useEffect(() => {
    const economic = economicProfileSchema.safeParse(readStoredJson("local", "worldview-atlas-economic-result-v1"));
    const authority = specialistProfileSchema.safeParse(readStoredJson("local", specialistStorageKey("authority")));
    const foreign = specialistProfileSchema.safeParse(readStoredJson("local", specialistStorageKey("foreign-policy")));
    const localSaved = savedPhilosophiesSchema.safeParse(readStoredJson("local", "worldview-atlas-saved-philosophies"));
    queueMicrotask(() => {
      if (!serverEconomic && economic.success) setEconomic(economic.data);
      if (!serverAuthority && authority.success && authority.data.assessment === "authority")
        setAuthority(authority.data);
      if (!serverForeignPolicy && foreign.success && foreign.data.assessment === "foreign-policy") {
        setForeignPolicy(foreign.data);
      }
      setSaved([...new Set([...serverSaved, ...(localSaved.success ? localSaved.data : [])])]);
    });
  }, [serverAuthority, serverEconomic, serverForeignPolicy, serverSaved]);
  const topEconomic = economic && economicSchools.find((x) => x.id === economic.matches[0]?.id);
  const savedIdeologies = saved.flatMap((id) => {
    const x = allTraditions.find((i) => i.id === id);
    return x ? [x] : [];
  });
  return (
    <>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-5">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Political economy</p>
            <h2 className="mt-2 text-2xl font-semibold">{topEconomic?.name ?? "Economic Foundations not taken"}</h2>
            {topEconomic && (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                {topEconomic.summary}
              </p>
            )}
          </div>
          <Link
            href="/atlas/economy"
            className="shrink-0 rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
          >
            {topEconomic ? "Retake" : "Take assessment"}
          </Link>
        </div>
        {economic && (
          <div className="mt-5 flex flex-wrap gap-2">
            {economic.matches.slice(0, 3).map((m, index) => (
              <span key={m.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs dark:bg-slate-900">
                {index === 0 ? "Closest" : `Nearby ${index}`} ·{" "}
                {economicSchools.find((x) => x.id === m.id)?.name ?? m.id}
              </span>
            ))}
          </div>
        )}
      </section>
      <div className="grid gap-6 md:grid-cols-2">
        <AuthorityCard result={authority} />
        <SpecialistCard assessment={foreignPolicyAssessment} result={foreignPolicy} href="/atlas/foreign-policy" />
      </div>
      <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Saved library</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {savedIdeologies.length
                ? `${savedIdeologies.length} saved ${savedIdeologies.length === 1 ? "tradition" : "traditions"}`
                : "Build a reading path"}
            </h2>
          </div>
          <Link href="/atlas/philosophies" className="text-sm font-semibold">
            Browse →
          </Link>
        </div>
        {savedIdeologies.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {savedIdeologies.map((x) => (
              <Link
                key={x.id}
                href={`/atlas/philosophies/${x.id}`}
                className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                {x.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Save any philosophy to return to it here. Anonymous saves stay in this browser; signed-in saves sync to your
            account.
          </p>
        )}
      </section>
    </>
  );
}

function AuthorityCard({ result }: { result: SpecialistProfileResult | null }) {
  const top = result && authoritySchools.find((school) => school.id === result.matches[0]?.id);
  const legacyTop = result && authorityAssessment.schools.find((school) => school.id === result.matches[0]?.id);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">Power &amp; Democracy</p>
      <h2 className="mt-2 text-2xl font-semibold">{top?.name ?? legacyTop?.name ?? "Not taken"}</h2>
      {(top || legacyTop) && (
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          {top?.summary ?? legacyTop?.summary}
        </p>
      )}
      <Link
        href="/atlas/authority"
        className="mt-5 inline-block rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
      >
        {top || legacyTop ? "Retake" : "Take assessment"}
      </Link>
      {result && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.matches.slice(0, 3).map((match, index) => (
            <span key={match.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] dark:bg-slate-900">
              {index === 0 ? "Closest" : `Nearby ${index}`} ·{" "}
              {authoritySchools.find((school) => school.id === match.id)?.name ??
                authorityAssessment.schools.find((school) => school.id === match.id)?.name ??
                match.id}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}

function SpecialistCard({
  assessment,
  result,
  href,
}: {
  assessment: SpecialistAssessment;
  result: SpecialistProfileResult | null;
  href: string;
}) {
  const top = result && assessment.schools.find((x) => x.id === result.matches[0]?.id);
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
      <p className="text-xs font-semibold tracking-[.16em] text-slate-400 uppercase">{assessment.title}</p>
      <h2 className="mt-2 text-2xl font-semibold">{top?.name ?? "Not taken"}</h2>
      {top && <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{top.summary}</p>}
      <Link
        href={href}
        className="mt-5 inline-block rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold dark:border-slate-700"
      >
        {top ? "Retake" : "Take assessment"}
      </Link>
      {result && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {result.matches.slice(0, 3).map((m) => (
            <span key={m.id} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] dark:bg-slate-900">
              {assessment.schools.find((x) => x.id === m.id)?.name ?? m.id} · {m.score}%
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
