// "Explore Worldview": the homepage's tool showcase. A featured Atlas card
// over three equal cards for Subpoena, Writ and IssueView, each a small
// working sample of the tool built from real records (lib/home/showcase.ts).
// A tool whose sample can't load falls back to its pitch and link.

import type { Showcase } from "@/lib/home/showcase";
import type { StateMeasure } from "@/components/home/state-map";
import type { ProductId } from "@/lib/tools/catalog";
import { SUITE_TOOLS } from "@/lib/tools/catalog";
import { AtlasShowcase } from "./atlas-showcase";
import { IssueViewShowcase } from "./issueview-showcase";
import { SubpoenaShowcase } from "./subpoena-showcase";
import { WritShowcase } from "./writ-showcase";
import { CardHeading, CtaLink, ShowcaseCard } from "./showcase-ui";

const FALLBACK: Record<ProductId, { title: string; body: string; cta: string }> = {
  atlas: { title: "Pin down exactly where you stand.", body: "An adaptive assessment that measures each political dimension separately and compares the result with every tradition in the catalog.", cta: "Take the Assessment" },
  subpoena: { title: "Who holds power, and what’s on the record?", body: "Sourced files on the people behind American politics: what they built, what they gave, what they said, and when.", cta: "Browse Profiles" },
  writ: { title: "What happens after a bill is introduced?", body: "Follow a bill from introduction to the President’s desk, and a race from filing to result.", cta: "Follow a Bill" },
  issueview: { title: "How different are two places?", body: "Put any two states side by side on any published measure.", cta: "Compare Places" },
};

function FallbackCard({ tool, className }: { tool: ProductId; className?: string }) {
  const copy = FALLBACK[tool];
  const href = SUITE_TOOLS.find((entry) => entry.id === tool)!.href;
  return (
    <ShowcaseCard className={className}>
      <CardHeading tool={tool} title={copy.title}>{copy.body}</CardHeading>
      <div className="mt-auto pt-5"><CtaLink href={href} primary>{copy.cta}</CtaLink></div>
    </ShowcaseCard>
  );
}

export function ShowcaseSection({ showcase, measures, axisCount, traditionCount }: {
  showcase: Showcase;
  measures: StateMeasure[];
  axisCount: number;
  traditionCount: number;
}) {
  return (
    <section id="tools" aria-labelledby="tools-heading" className="scroll-mt-24">
      <p className="text-xs font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-300">Explore Worldview</p>
      <h2 id="tools-heading" className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-balance text-slate-950 sm:text-4xl dark:text-white">
        Explore the data. Discover the connections.
      </h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-slate-700 dark:text-slate-300">
        Investigate political networks, follow government decisions, compare communities, and discover where your beliefs fit.
      </p>
      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {showcase.atlas
          ? <AtlasShowcase data={showcase.atlas} axisCount={axisCount} traditionCount={traditionCount} />
          : <FallbackCard tool="atlas" className="lg:col-span-3" />}
        {showcase.subpoena ? <SubpoenaShowcase data={showcase.subpoena} /> : <FallbackCard tool="subpoena" />}
        {showcase.writ ? <WritShowcase data={showcase.writ} /> : <FallbackCard tool="writ" />}
        {measures.length ? <IssueViewShowcase measures={measures} /> : <FallbackCard tool="issueview" />}
      </div>
    </section>
  );
}
