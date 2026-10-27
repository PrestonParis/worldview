import { isRecord } from "./profile-model";
import { parseEntityMetadata } from "./public";
import type { Entity } from "../validation/entity";

export interface ProfileCitation {
  label: string;
  url: string;
}

export interface ProfileFact {
  key: string;
  label: string;
  value: string;
  note?: string;
  asOf?: string;
  source?: ProfileCitation;
}

export interface ProfileSection {
  heading: string;
  body: string;
  sources: ProfileCitation[];
}

export interface EditorialProfile {
  dek?: string;
  facts: ProfileFact[];
  sections: ProfileSection[];
  reviewedAt?: string;
}

const citation = (value: unknown): ProfileCitation | null => {
  if (!isRecord(value) || typeof value.label !== "string" || typeof value.url !== "string") return null;
  if (!/^https?:\/\//.test(value.url)) return null;
  return { label: value.label, url: value.url };
};

export function editorialProfile(entity: Pick<Entity, "metadata">): EditorialProfile | null {
  const raw = parseEntityMetadata(entity.metadata).profile;
  if (!isRecord(raw)) return null;

  const facts = Array.isArray(raw.facts)
    ? raw.facts.flatMap((value): ProfileFact[] => {
        if (
          !isRecord(value) ||
          typeof value.key !== "string" ||
          typeof value.label !== "string" ||
          typeof value.value !== "string"
        )
          return [];
        const source = citation(value.source);
        return [
          {
            key: value.key,
            label: value.label,
            value: value.value,
            ...(typeof value.note === "string" ? { note: value.note } : {}),
            ...(typeof value.asOf === "string" ? { asOf: value.asOf } : {}),
            ...(source ? { source } : {}),
          },
        ];
      })
    : [];

  const sections = Array.isArray(raw.sections)
    ? raw.sections.flatMap((value): ProfileSection[] => {
        if (!isRecord(value) || typeof value.heading !== "string" || typeof value.body !== "string") return [];
        return [
          {
            heading: value.heading,
            body: value.body,
            sources: Array.isArray(value.sources)
              ? value.sources.map(citation).filter((item): item is ProfileCitation => Boolean(item))
              : [],
          },
        ];
      })
    : [];

  if (!facts.length && !sections.length) return null;
  return {
    ...(typeof raw.dek === "string" ? { dek: raw.dek } : {}),
    facts,
    sections,
    ...(typeof raw.reviewedAt === "string" ? { reviewedAt: raw.reviewedAt } : {}),
  };
}

export function ageOnDate(birthDate: string, onDate: Date): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  let age = onDate.getUTCFullYear() - year;
  const beforeBirthday =
    onDate.getUTCMonth() + 1 < month || (onDate.getUTCMonth() + 1 === month && onDate.getUTCDate() < day);
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}
