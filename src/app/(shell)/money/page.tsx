import { GraphPage } from "@/components/graph/graph-page";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <GraphPage content={pagesContent["money"]} />;
}
