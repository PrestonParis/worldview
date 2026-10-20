import Link from "next/link";
import { claimQuizAction, deleteQuizAction, setVisibilityAction, startQuizAction } from "@/lib/actions/quiz";
import { signInToClaimHref, type QuizAccess } from "@/lib/quiz/access";
import type { QuizVisibility } from "@/lib/db/quizSessions";
import { buttonVariants } from "@/components/ui/button";

const panelClass = "rounded-2xl border border-slate-200 bg-white p-5 text-sm dark:border-slate-800 dark:bg-slate-950";

function VisibilityFields({ current }: { current: QuizVisibility }) {
  return (
    <fieldset className="space-y-2">
      <label className="flex items-start gap-2">
        <input type="radio" name="visibility" value="public" defaultChecked={current === "public"} className="mt-1" />
        <span>
          <span className="font-medium text-slate-900 dark:text-slate-100">Public</span>
          <span className="block text-slate-500 dark:text-slate-400">Anyone with the link can see your results.</span>
        </span>
      </label>
      <label className="flex items-start gap-2">
        <input type="radio" name="visibility" value="private" defaultChecked={current === "private"} className="mt-1" />
        <span>
          <span className="font-medium text-slate-900 dark:text-slate-100">Private</span>
          <span className="block text-slate-500 dark:text-slate-400">Only you can see them.</span>
        </span>
      </label>
    </fieldset>
  );
}

export function QuizOwnership({
  slug,
  access,
  visibility,
}: {
  slug: string;
  access: QuizAccess;
  visibility: QuizVisibility;
}) {
  if (access.isOwner) {
    return (
      <aside className={panelClass}>
        <p className="font-semibold text-slate-900 dark:text-slate-100">Your quiz</p>
        <form action={setVisibilityAction.bind(null, slug)} className="mt-3 space-y-3">
          <VisibilityFields current={visibility} />
          <button type="submit" className={buttonVariants.primary}>
            Save visibility
          </button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          <form action={startQuizAction}>
            <button type="submit" className={buttonVariants.ghost}>
              Retake
            </button>
          </form>
          <form action={deleteQuizAction.bind(null, slug)}>
            <button type="submit" className={buttonVariants.danger}>
              Delete
            </button>
          </form>
        </div>
      </aside>
    );
  }

  if (access.canEdit) {
    return (
      <aside className={panelClass}>
        <p className="font-semibold text-slate-900 dark:text-slate-100">Keep this quiz</p>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          This result stays available at this link. Claim it to manage its visibility and deletion from your account.
        </p>
        {access.canClaim ? (
          <form action={claimQuizAction.bind(null, slug)} className="mt-3 space-y-3">
            <VisibilityFields current="public" />
            <button type="submit" className={buttonVariants.primary}>
              Claim quiz
            </button>
          </form>
        ) : (
          <Link href={signInToClaimHref(slug)} className={`${buttonVariants.primary} mt-3`}>
            Sign in to claim
          </Link>
        )}
      </aside>
    );
  }

  return (
    <aside className={panelClass}>
      <p className="font-semibold text-slate-900 dark:text-slate-100">Where do you stand?</p>
      <p className="mt-1 text-slate-500 dark:text-slate-400">Take the quiz to get your own profile.</p>
      <form action={startQuizAction} className="mt-3">
        <button type="submit" className={buttonVariants.primary}>
          Start the quiz
        </button>
      </form>
    </aside>
  );
}

// Slim banner for an unclaimed quiz the viewer can edit; claims as public
// (switchable afterwards from the owner panel).
export function QuizClaimBanner({ slug, access }: { slug: string; access: QuizAccess }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-950">
      <p className="text-slate-600 dark:text-slate-300">
        This result stays available at this link.{" "}
        <span className="text-slate-900 dark:text-slate-100">Claim it to manage privacy and deletion.</span>
      </p>
      {access.canClaim ? (
        <form action={claimQuizAction.bind(null, slug)} className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <input type="checkbox" name="visibility" value="private" />
            Private
          </label>
          <button type="submit" className={buttonVariants.primary}>
            Claim quiz
          </button>
        </form>
      ) : (
        <Link href={signInToClaimHref(slug)} className={`${buttonVariants.primary} shrink-0`}>
          Sign in to claim
        </Link>
      )}
    </div>
  );
}
