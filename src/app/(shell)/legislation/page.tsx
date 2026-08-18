import { BillList } from "@/components/legislation/bill-list";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <BillList content={pagesContent["legislation"]} />;
}
