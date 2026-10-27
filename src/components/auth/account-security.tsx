"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { changePasswordAction, requestEmailChangeAction, verifyEmailChangeAction } from "@/lib/actions/auth";

const linkButton =
  "text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-400 dark:hover:text-slate-100";

function Status({ error, success }: { error: string | null; success: string | null }) {
  if (error) return <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  if (success) return <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>;
  return null;
}

export function PasswordSection() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await changePasswordAction({ password });
      if (!result.ok) return setError(result.error);
      setPassword("");
      setSuccess("Password saved. Use it with your email to sign in.");
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label="New password" htmlFor="password">
            <div className="relative">
              <input
                id="password"
                name="password"
                type={show ? "text" : "password"}
                required
                minLength={8}
                maxLength={72}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-10`}
                placeholder="At least 8 characters"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                aria-label={show ? "Hide password" : "Show password"}
                aria-pressed={show}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>
        </div>
        <Button type="submit" disabled={pending || password.length < 8}>
          {pending ? "Saving…" : "Save password"}
        </Button>
      </div>
      <Status error={error} success={success} />
    </form>
  );
}

// new_code: code sent to the new address; current_code: the one sent to the
// current address (only when Supabase's "Secure email change" is on).
type EmailStep = "idle" | "new_code" | "current_code";

export function EmailSection({ currentEmail }: { currentEmail: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<EmailStep>("idle");
  const [newEmail, setNewEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const target = newEmail.trim().toLowerCase();

  const reset = () => {
    setStep("idle");
    setCode("");
    setError(null);
  };

  const onRequest = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await requestEmailChangeAction({ email: newEmail });
      if (!result.ok) return setError(result.error);
      setStep("new_code");
    });
  };

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    if (step === "idle") return;
    setError(null);
    startTransition(async () => {
      const result = await verifyEmailChangeAction({
        email: target,
        token: code,
        address: step === "new_code" ? "new" : "current",
      });
      if (!result.ok) return setError(result.error);
      setCode("");
      if (result.data === "current") return setStep("current_code");
      setStep("idle");
      setNewEmail("");
      setSuccess(`Done. Sign in with ${target} from now on.`);
      router.refresh();
    });
  };

  if (step === "idle") {
    return (
      <form onSubmit={onRequest} className="space-y-2">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Signed in as <span className="font-medium">{currentEmail}</span>
        </p>
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Field label="New email" htmlFor="newEmail">
              <input
                id="newEmail"
                name="newEmail"
                type="email"
                required
                autoComplete="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>
          </div>
          <Button type="submit" disabled={pending || !target}>
            {pending ? "Sending…" : "Change email"}
          </Button>
        </div>
        <Status error={error} success={success} />
      </form>
    );
  }

  const sentTo = step === "new_code" ? target : currentEmail;
  return (
    <form onSubmit={onVerify} className="space-y-2">
      <p className="text-sm text-slate-700 dark:text-slate-300">
        {step === "new_code"
          ? `We sent a code to ${sentTo}. Enter it to confirm the new address.`
          : `One more: enter the code we sent to ${sentTo} to confirm the change came from you.`}
      </p>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Field label="Code" htmlFor="emailCode">
            <input
              id="emailCode"
              name="emailCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              autoFocus
              maxLength={12}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className={`${inputClass} tracking-[0.3em] placeholder:tracking-normal`}
              placeholder="Code from the email"
            />
          </Field>
        </div>
        <Button type="submit" disabled={pending || !code.trim()}>
          {pending ? "Checking…" : "Confirm"}
        </Button>
      </div>
      <Status error={error} success={null} />
      <button type="button" onClick={reset} className={linkButton}>
        Cancel
      </button>
    </form>
  );
}
