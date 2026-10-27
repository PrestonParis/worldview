export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const DEFAULT_ACTION_ERROR = "That change could not be saved. Please try again.";

/** Log the full server-side error without exposing database or provider details to the browser. */
export function actionFailure(operation: string, error: unknown, message = DEFAULT_ACTION_ERROR) {
  console.error(`[action:${operation}]`, error);
  return { ok: false, error: message } as const;
}

export function validationFailure(error: { issues: { message: string }[] }) {
  return { ok: false, error: error.issues[0]?.message ?? "Invalid input" } as const;
}
