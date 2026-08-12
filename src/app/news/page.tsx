import { StubPage } from "@/components/stub-page";
import { pagesContent } from "@/lib/pages-content";

export default function Page() {
  return <StubPage content={pagesContent["news"]} />;
}
