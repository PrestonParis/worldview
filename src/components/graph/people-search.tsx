"use client";

import { EntitySearch } from "./entity-search";
import { useRouter } from "next/navigation";

export function PeopleSearch({
  entities,
  destination = "profile",
  large = false,
}: {
  entities: { id: string; name: string; type: string; href?: string }[];
  destination?: "profile" | "network";
  large?: boolean;
}) {
  const router = useRouter();
  return (
    <div className={large ? "[&>div]:w-full [&_input]:h-14 [&_input]:rounded-xl [&_input]:text-base" : ""}>
      <EntitySearch
        entities={entities}
        placeholder="Search people, organizations, committees and groups"
        onSelect={(id) => {
          const entity = entities.find((item) => item.id === id);
          if (destination === "network") router.push(`/people?view=network&root=${id}`);
          else if (entity?.href) router.push(entity.href);
        }}
      />
    </div>
  );
}

