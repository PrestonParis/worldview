import { notFound } from "next/navigation";
import { getElection, listElections } from "@/lib/db/elections";
import { listCandidaciesForElection } from "@/lib/db/candidacies";
import { listEntities } from "@/lib/neo4j/entities";
import { ElectionForm } from "@/components/forms/election-form";
import { CandidaciesEditor } from "@/components/forms/candidacies-editor";

export default async function EditElectionPage({
  params,
}: PageProps<"/data/elections/[id]/edit">) {
  const { id } = await params;
  const [election, elections, candidacies, entities] = await Promise.all([
    getElection(id),
    listElections(),
    listCandidaciesForElection(id),
    listEntities(),
  ]);
  if (!election) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="mb-4 text-lg font-medium">Edit election</h2>
        <ElectionForm
          id={id}
          defaultValues={{
            name: election.name,
            office: election.office,
            jurisdiction: election.jurisdiction,
            level: election.level,
            electionType: election.electionType,
            status: election.status,
            electionDate: election.electionDate.slice(0, 10),
            totalVotes: election.totalVotes != null ? String(election.totalVotes) : "",
            priorElectionId: election.priorElectionId,
            parentElectionId: election.parentElectionId,
            notes: election.notes,
          }}
          elections={elections}
        />
      </div>

      <CandidaciesEditor
        electionId={id}
        candidacies={candidacies}
        entities={entities}
      />
    </div>
  );
}
