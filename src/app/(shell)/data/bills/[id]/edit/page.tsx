import { notFound } from "next/navigation";
import { getBill } from "@/lib/db/bills";
import { listVotesForBill } from "@/lib/db/votes";
import { listEntities } from "@/lib/neo4j/entities";
import { BillForm } from "@/components/forms/bill-form";
import { VotesEditor } from "@/components/forms/votes-editor";

export default async function EditBillPage({
  params,
}: PageProps<"/data/bills/[id]/edit">) {
  const { id } = await params;
  const [bill, votes, entities] = await Promise.all([
    getBill(id),
    listVotesForBill(id),
    listEntities(),
  ]);
  if (!bill) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-4 text-lg font-medium">Edit bill</h2>
        <BillForm
          id={id}
          defaultValues={{
            billNumber: bill.billNumber,
            title: bill.title,
            summary: bill.summary,
            status: bill.status,
            chamber: bill.chamber,
            introducedDate: bill.introducedDate.slice(0, 10),
            sponsorEntityId: bill.sponsorEntityId,
          }}
          entities={entities}
        />
      </div>

      <VotesEditor billId={id} votes={votes} entities={entities} />
    </div>
  );
}
