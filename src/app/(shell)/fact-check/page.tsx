import { ClaimList } from "@/components/claims/claim-list";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <ClaimList content={pagesContent["fact-check"]} mode="workbench" />;
}
