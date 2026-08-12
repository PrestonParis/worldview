import { PositionMatrix } from "@/components/alignment/position-matrix";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <PositionMatrix content={pagesContent["alignment"]} />;
}
