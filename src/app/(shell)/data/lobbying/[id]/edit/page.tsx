import { notFound } from "next/navigation";
import { getLobbyingRegistration } from "@/lib/db/lobbying";
import { listEntities } from "@/lib/neo4j/entities";
import { LobbyingForm } from "@/components/forms/lobbying-form";

export default async function EditLobbyingPage({
  params,
}: PageProps<"/data/lobbying/[id]/edit">) {
  const { id } = await params;
  const [registration, entities] = await Promise.all([
    getLobbyingRegistration(id),
    listEntities(),
  ]);
  if (!registration) notFound();

  return (
    <div>
      <h2 className="mb-4 text-lg font-medium">Edit lobbying filing</h2>
      <LobbyingForm
        id={id}
        entities={entities}
        defaultValues={{
          clientEntityId: registration.clientEntityId,
          registrantEntityId: registration.registrantEntityId,
          year: String(registration.year),
          period: registration.period,
          amount: registration.amount != null ? String(registration.amount) : "",
          amountKind: registration.amountKind,
          notes: registration.notes,
        }}
        defaultIssuesText={registration.issues
          .map((i) => i.issueLabel || i.issueCode)
          .filter(Boolean)
          .join("\n")}
      />
    </div>
  );
}
