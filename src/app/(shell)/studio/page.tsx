import { SourceLibrary } from "@/components/sources/source-library";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return <SourceLibrary content={pagesContent["studio"]} />;
}
