import { MoneyGraphPage } from "@/components/graph/money-graph-page";
import { ContributionsList } from "@/components/money/contributions-list";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <div>
      <MoneyGraphPage content={pagesContent["money"]} />
      <ContributionsList />
    </div>
  );
}
