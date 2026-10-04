import { requireContributorPage } from "@/lib/auth/guard";
import { notFound } from "next/navigation";
import { getContribution } from "@/lib/db/contributions";
import { listSources } from "@/lib/db/sources";
import { listEntities } from "@/lib/neo4j/entities";
import { ContributionForm } from "@/components/forms/contribution-form";

export default async function EditContributionPage({
  params,
}: PageProps<"/data/contributions/[id]/edit">) {
  const { id } = await params;
  await requireContributorPage(`/data/contributions/${id}/edit`);
  const [contribution, entities, sources] = await Promise.all([
    getContribution(id),
    listEntities(),
    listSources(),
  ]);
  if (!contribution) notFound();

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Edit contribution</h2>
      <ContributionForm
        id={id}
        defaultValues={{
          donorEntityId: contribution.donorEntityId,
          recipientEntityId: contribution.recipientEntityId,
          amount: String(contribution.amount),
          currency: contribution.currency,
          date: contribution.date.slice(0, 10),
          sourceRecordId: contribution.sourceRecordId,
          notes: contribution.notes,
          contributionType: contribution.contributionType,
          donorIndustry: contribution.donorIndustry,
          donorState: contribution.donorState,
          donorCity: contribution.donorCity,
          donorZip: contribution.donorZip,
          employer: contribution.employer,
          occupation: contribution.occupation,
        }}
        entities={entities}
        sources={sources}
      />
    </div>
  );
}
