import { MoneyGraphPage } from "@/components/graph/money-graph-page";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <MoneyGraphPage content={pagesContent["money"]} />;
}
