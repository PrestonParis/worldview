import { EntitySectionsPage } from "@/components/entities/entity-sections-page";
import { pagesContent } from "@/lib/pages-content";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <EntitySectionsPage
      content={pagesContent["legislation"]}
      sections={[
        { type: "bill", heading: "Bills" },
        { type: "court_case", heading: "Court Cases" },
      ]}
      emptyMessage="No bills or court cases yet — add them as entities (type: bill or court_case) in"
    />
  );
}
