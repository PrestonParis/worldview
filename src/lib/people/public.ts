import type { Entity } from "@/lib/validation/entity";

export const PEOPLE_PAGE_SIZE = 50;

export const roleGroups = [
  {
    key: "politicians",
    label: "Politicians and candidates",
    description: "Officeholders, candidates and former officials",
    types: ["politician"],
  },
  {
    key: "media",
    label: "Commentators and media",
    description: "Pundits, journalists, hosts and outlets",
    types: ["pundit", "journalist"],
  },
  {
    key: "organizations",
    label: "Organizations",
    description: "Parties, committees, advocacy groups and institutions",
    types: ["organization"],
  },
  {
    key: "money",
    label: "Money and influence",
    description: "Donors, companies, PACs and lobbying organizations",
    types: ["donor", "company", "lobbyist"],
  },
] as const;

export const typeLabels: Record<string, string> = {
  politician: "Politician",
  pundit: "Commentator",
  journalist: "Journalist",
  organization: "Organization",
  company: "Company or committee",
  lobbyist: "Lobbyist",
  donor: "Donor",
};

export function parseEntityMetadata(raw?: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function slugifyEntityName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "profile";
}

export function publicEntitySlug(entity: Pick<Entity, "id" | "name">): string {
  return `${slugifyEntityName(entity.name)}-${entity.id.slice(0, 8)}`;
}

export function publicEntityPath(entity: Pick<Entity, "id" | "name">): string {
  return `/people/${publicEntitySlug(entity)}`;
}

export function entityRole(entity: Pick<Entity, "type" | "metadata">): string {
  const metadata = parseEntityMetadata(entity.metadata);
  const office = typeof metadata.office === "string" ? metadata.office : "";
  return office || typeLabels[entity.type] || entity.type.replaceAll("_", " ");
}

export function entityPartyAndPlace(entity: Pick<Entity, "metadata">): {
  party: string;
  place: string;
} {
  const metadata = parseEntityMetadata(entity.metadata);
  return {
    party: typeof metadata.party === "string" ? metadata.party : "",
    place:
      typeof metadata.state === "string"
        ? metadata.state
        : typeof metadata.country === "string"
          ? metadata.country
          : "",
  };
}

