import { economicSchools } from "./economics";
import { philosophyById } from "./philosophies";
import { authorityAssessment, foreignPolicyAssessment } from "./specialists";

// Dossiers may classify an idea using the main philosophy catalog or one of
// the specialist assessments. Only the philosophy catalog has reference
// pages, so specialist/economic matches are linked through their declared
// philosophy counterpart. Unmapped labels remain useful text, but must not
// turn into a guaranteed 404.
export function atlasTraditionHref(atlasId: string): string | null {
  if (!atlasId) return null;
  if (philosophyById.has(atlasId)) return `/atlas/philosophies/${atlasId}`;

  const school = [...economicSchools, ...authorityAssessment.schools, ...foreignPolicyAssessment.schools].find(
    (candidate) => candidate.id === atlasId,
  );
  return school?.philosophyId && philosophyById.has(school.philosophyId)
    ? `/atlas/philosophies/${school.philosophyId}`
    : null;
}
