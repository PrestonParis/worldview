import { ElectionList } from "@/components/elections/election-list";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ElectionList content={pagesContent["elections"]} />;
}
