import type { Metadata } from "next";
import { ContributionsList } from "@/components/money/contributions-list";
import { MoneyHeader } from "@/components/money/money-ui";
import { listMoneyCycles, loadContributionSummary, resolveCycle } from "@/lib/db/moneyOverview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contributions explorer | Money & Influence | Worldview",
  description: "Search, filter, and export every itemized contribution record from FEC filings.",
};

export default async function ContributionsPage({ searchParams }: PageProps<"/money/contributions">) {
  const sp = await searchParams;
  const cycles = await listMoneyCycles();
  const cycle = resolveCycle(sp.cycle, cycles);
  const { window, partyByEntity } = await loadContributionSummary(cycle);

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-16">
      <MoneyHeader
        title="Contributions explorer"
        features={[
          "Every itemized contribution record",
          "Filter, sort and export",
          "Hover a donor type for its FEC category",
        ]
        }
        cycle={cycle}
        cycles={cycles}
        basePath="/money/contributions"
      />
      <ContributionsList window={window} partyByEntity={partyByEntity} />
    </div>
  );
}
