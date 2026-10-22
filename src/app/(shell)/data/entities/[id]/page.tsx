import { notFound, permanentRedirect } from "next/navigation";
import { getEntity, getMergedInto } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";

// Entity profiles live at /people/[slug]; this keeps old links working.
export default async function EntityRedirectPage({ params }: PageProps<"/data/entities/[id]">) {
  const { id } = await params;
  const entity = (await getEntity(id)) ?? (await getMergedInto(id));
  if (!entity) notFound();
  permanentRedirect(publicEntityPath(entity));
}
