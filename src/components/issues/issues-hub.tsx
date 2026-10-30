"use client";

import Link from "next/link";
import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Baby,
  Banknote,
  Church,
  Crosshair,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  PersonStanding,
  Search,
  ShieldAlert,
  Stethoscope,
  TrendingUp,
  Users,
  Zap,
  type LucideProps,
} from "lucide-react";

type Icon = ComponentType<LucideProps>;
type Group = "People & society" | "Economy & daily life" | "Rights & safety" | "Government & the world";

interface Topic {
  id: string;
  title: string;
  href: string;
  group: Group;
  icon: Icon;
  description: string;
  questions: [string, string];
  coverage: string[];
  related: string[];
}

const TOPICS: Topic[] = [
  {
    id: "immigration", title: "Immigration", href: "/immigration", group: "People & society", icon: PersonStanding,
    description: "How people arrive, gain status, encounter enforcement, and become part of the population.",
    questions: ["Who comes to the United States—and through which pathways?", "How do enforcement and migration differ across states?"],
    coverage: ["National trends", "States", "Legal system"], related: ["demographics", "housing", "economy"],
  },
  {
    id: "demographics", title: "Demographics", href: "/demographics", group: "People & society", icon: Users,
    description: "Who lives in the United States now, how that is changing, and what projections suggest comes next.",
    questions: ["How are age, race, and population changing?", "Which states are growing, aging, or losing residents?"],
    coverage: ["Population", "States", "Forecasts"], related: ["immigration", "family", "housing"],
  },
  {
    id: "family", title: "Family", href: "/family", group: "People & society", icon: Baby,
    description: "Births, fertility, marriage, household structure, and the changing circumstances of children.",
    questions: ["Why is fertility falling?", "How do marriage and household patterns vary by place?"],
    coverage: ["Long-run trends", "States", "Households"], related: ["demographics", "economy", "education"],
  },
  {
    id: "religion", title: "Religion", href: "/religion", group: "People & society", icon: Church,
    description: "Religious traditions, attendance, belief, affiliation, and their political geography.",
    questions: ["How religious are Americans?", "Where are traditions concentrated?"],
    coverage: ["Belief", "States", "Political identity"], related: ["demographics", "family", "abortion"],
  },
  {
    id: "education", title: "Education", href: "/education", group: "People & society", icon: GraduationCap,
    description: "Achievement, degrees, tuition, student debt, and differences between state education systems.",
    questions: ["Are students learning more or less?", "What does college cost—and who completes it?"],
    coverage: ["Test scores", "States", "College"], related: ["economy", "family", "spending"],
  },
  {
    id: "economy", title: "Economy", href: "/economy", group: "Economy & daily life", icon: TrendingUp,
    description: "Jobs, inflation, wages, income, growth, and the material conditions Americans experience.",
    questions: ["Are paychecks keeping up with prices?", "How strong is the labor market?"],
    coverage: ["Monthly trends", "States", "Income"], related: ["housing", "healthcare", "spending"],
  },
  {
    id: "housing", title: "Housing", href: "/housing", group: "Economy & daily life", icon: House,
    description: "Home prices, rents, mortgages, construction, ownership, and affordability.",
    questions: ["Where is housing least affordable?", "Are enough homes being built?"],
    coverage: ["Prices", "States", "Affordability"], related: ["economy", "demographics", "immigration"],
  },
  {
    id: "healthcare", title: "Healthcare", href: "/healthcare", group: "Economy & daily life", icon: Stethoscope,
    description: "Insurance coverage, costs, health outcomes, overdoses, and how the United States compares.",
    questions: ["Who remains uninsured?", "Why do outcomes and costs differ so much?"],
    coverage: ["Coverage", "States", "International"], related: ["economy", "guns", "spending"],
  },
  {
    id: "energy", title: "Energy & climate", href: "/energy", group: "Economy & daily life", icon: Zap,
    description: "Electricity, fuels, prices, generation, emissions, and changes in temperature.",
    questions: ["Where does American energy come from?", "How are prices and emissions changing?"],
    coverage: ["Energy mix", "States", "Climate"], related: ["economy", "foreign-policy", "spending"],
  },
  {
    id: "crime", title: "Crime", href: "/crime", group: "Rights & safety", icon: ShieldAlert,
    description: "Violent and property crime, victimization, arrests, cities, and the limits of reported data.",
    questions: ["Is crime rising or falling?", "How do police reports differ from victim surveys?"],
    coverage: ["National trends", "States & cities", "Victimization"], related: ["guns", "healthcare", "economy"],
  },
  {
    id: "guns", title: "Guns", href: "/guns", group: "Rights & safety", icon: Crosshair,
    description: "Firearm mortality, ownership, public opinion, and the laws at the center of the debate.",
    questions: ["What kinds of firearm deaths are most common?", "How do ownership and policy vary by state?"],
    coverage: ["Mortality", "States", "Public opinion"], related: ["crime", "healthcare", "abortion"],
  },
  {
    id: "abortion", title: "Abortion", href: "/abortion", group: "Rights & safety", icon: HeartPulse,
    description: "Rates, methods, interstate travel, telehealth, and the state rules governing access.",
    questions: ["Where and how are abortions obtained?", "How did access change after Dobbs?"],
    coverage: ["Monthly estimates", "States", "State limits"], related: ["family", "religion", "healthcare"],
  },
  {
    id: "spending", title: "Government spending", href: "/spending", group: "Government & the world", icon: Banknote,
    description: "The federal budget, deficits, debt, major programs, and where public money goes.",
    questions: ["What does the federal government spend money on?", "How large are deficits and debt?"],
    coverage: ["Federal budget", "States", "Programs"], related: ["economy", "healthcare", "education"],
  },
  {
    id: "foreign-policy", title: "Foreign policy", href: "/foreign-policy", group: "Government & the world", icon: Landmark,
    description: "Defense, assistance, diplomacy, trade, legal authority, and relationships with other countries.",
    questions: ["How does the United States use power abroad?", "Who receives assistance and trades with the U.S.?"],
    coverage: ["Defense", "Countries", "Aid & trade"], related: ["immigration", "energy", "spending"],
  },
];

const GROUPS: ("All topics" | Group)[] = ["All topics", "People & society", "Economy & daily life", "Rights & safety", "Government & the world"];

const PATHWAYS = [
  { title: "What is making life more expensive?", description: "Follow prices from the broad economy into homes, medical care, and education.", topics: ["economy", "housing", "healthcare", "education"] },
  { title: "How is the population changing?", description: "Connect migration, aging, family formation, and pressure on housing.", topics: ["demographics", "immigration", "family", "housing"] },
  { title: "How safe are Americans?", description: "Separate reported crime, victimization, firearm mortality, and public health.", topics: ["crime", "guns", "healthcare"] },
  { title: "What does government prioritize?", description: "Move from the federal budget to major services and long-term investments.", topics: ["spending", "healthcare", "education", "energy"] },
  { title: "How does America act abroad?", description: "Trace military power, diplomacy, trade, energy, migration, and assistance.", topics: ["foreign-policy", "energy", "immigration", "spending"] },
] as const;

const byId = new Map(TOPICS.map((topic) => [topic.id, topic]));

export function IssuesHub() {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<(typeof GROUPS)[number]>("All topics");
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return TOPICS.filter((topic) => {
      if (group !== "All topics" && topic.group !== group) return false;
      if (!needle) return true;
      const related = topic.related.map((id) => byId.get(id)?.title ?? id);
      return [topic.title, topic.description, ...topic.questions, ...topic.coverage, ...related].join(" ").toLowerCase().includes(needle);
    });
  }, [group, query]);

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="grid gap-8 border-b border-slate-200 pb-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end dark:border-slate-800">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold tracking-wider text-blue-700 uppercase dark:text-blue-300">Evidence by topic</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">Explore the issues</h1>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Start with a question, follow the evidence across topics, and move between national trends, state differences, definitions, and primary sources.
          </p>
        </div>
        <div className="space-y-3">
          <label htmlFor="issue-search" className="text-sm font-semibold text-slate-700 dark:text-slate-200">What do you want to understand?</label>
          <div className="relative">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-slate-400" />
            <input id="issue-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Try rent, borders, debt, or opioids" className="h-11 w-full rounded-xl border border-slate-300 bg-white pr-4 pl-10 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
          </div>
          <div className="flex gap-3 text-xs font-medium">
            <Link href="/states" className="text-blue-700 hover:underline dark:text-blue-300">Browse by state</Link>
            <Link href="/datasets" className="text-blue-700 hover:underline dark:text-blue-300">Browse the data</Link>
          </div>
        </div>
      </header>

      {!query && group === "All topics" && (
        <section aria-labelledby="pathways-title">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Follow a question</p>
            <h2 id="pathways-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Issues connect to one another</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">These pathways move through several pages without pretending one measure explains another.</p>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {PATHWAYS.map((pathway) => (
              <article key={pathway.title} className="flex flex-col rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-semibold leading-5 text-slate-950 dark:text-white">{pathway.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-5 text-slate-500 dark:text-slate-400">{pathway.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {pathway.topics.map((id) => {
                    const topic = byId.get(id)!;
                    return <Link key={id} href={topic.href} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-blue-950 dark:hover:text-blue-300">{topic.title}</Link>;
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="topics-title">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Browse the evidence</p>
            <h2 id="topics-title" className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{query ? `Results for “${query}”` : "All topics"}</h2>
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1" aria-label="Filter topics">
            {GROUPS.map((item) => (
              <button key={item} type="button" aria-pressed={group === item} onClick={() => setGroup(item)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${group === item ? "bg-slate-950 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{item}</button>
            ))}
          </div>
        </div>

        {filtered.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.id} className="group relative flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-slate-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-600">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-700 dark:bg-slate-900 dark:text-slate-300 dark:group-hover:bg-blue-950 dark:group-hover:text-blue-300"><Icon size={19} aria-hidden /></span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{topic.group}</p>
                      <h3 className="text-xl font-semibold tracking-tight text-slate-950 dark:text-white"><Link href={topic.href} className="after:absolute after:inset-0">{topic.title}</Link></h3>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-300">{topic.description}</p>
                  <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    {topic.questions.map((question) => <li key={question}>• {question}</li>)}
                  </ul>
                  <div className="mt-4 flex flex-wrap gap-1.5">{topic.coverage.map((label) => <span key={label} className="rounded-md bg-slate-50 px-2 py-1 text-[11px] text-slate-500 dark:bg-slate-900 dark:text-slate-400">{label}</span>)}</div>
                  <div className="relative z-10 mt-auto pt-5">
                    <p className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase">Related</p>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                      {topic.related.map((id) => { const related = byId.get(id)!; return <Link key={id} href={related.href} className="text-xs font-medium text-blue-700 hover:underline dark:text-blue-300">{related.title}</Link>; })}
                    </div>
                    <Link href={topic.href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-950 group-hover:text-blue-700 dark:text-white dark:group-hover:text-blue-300">Explore {topic.title.toLowerCase()} <ArrowRight size={14} aria-hidden /></Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 px-6 py-14 text-center dark:border-slate-700">
            <p className="font-semibold text-slate-900 dark:text-white">No topics match that search.</p>
            <button type="button" onClick={() => { setQuery(""); setGroup("All topics"); }} className="mt-2 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">Show every topic</button>
          </div>
        )}
      </section>
    </div>
  );
}
