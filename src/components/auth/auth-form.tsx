"use client";

import Link from "next/link";
import { useCallback, useState, useTransition, type FormEvent } from "react";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Turnstile } from "@/components/auth/turnstile";
import {
  googleSignInAction,
  passwordRegisterAction,
  passwordSignInAction,
  resendSignupCodeAction,
  sendResetCodeAction,
  setNewPasswordAction,
  verifyEmailCodeAction,
  type AuthMode,
} from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Sign-in didn't complete. Try again.",
};

// password: email + password (sign in or register)
// confirm:  code that confirms a new account's email
// forgot:   email to send a reset code to
// reset:    the reset code
// new_password: choose a new password after the reset code
type Step = "password" | "confirm" | "forgot" | "reset" | "new_password";

const linkButton =
  "text-sm text-slate-500 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100";

export function AuthForm({
  mode,
  next,
  initialError,
  googleEnabled,
  turnstileSiteKey,
}: {
  mode: AuthMode;
  next: string;
  initialError: string | null;
  googleEnabled: boolean;
  turnstileSiteKey: string | null;
}) {
  const register = mode === "register";
  const [step, setStep] = useState<Step>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? ERROR_MESSAGES.auth) : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  const go = (nextStep: Step, message: string | null = null) => {
    setStep(nextStep);
    setError(null);
    setNotice(message);
    setOtp("");
  };

  // Runs a server action; actions that succeed without redirecting say which
  // step comes next.
  const run = (action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string } | undefined>, after?: (data: unknown) => void) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setCaptchaReset((n) => n + 1);
      if (!result) return;
      if (!result.ok) setError(result.error);
      else after?.(result.data);
    });
  };

  const sentTo = (what: string) => `We sent a 6-digit code to ${email.trim()}. Enter it to ${what}.`;
  const token = () => captchaToken ?? undefined;

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    run(
      () =>
        register
          ? passwordRegisterAction({ email, password, next, captchaToken: token() })
          : passwordSignInAction({ email, password, next, captchaToken: token() }),
      () => go("confirm", sentTo("confirm your email")),
    );
  };

  const onConfirm = (e: FormEvent) => {
    e.preventDefault();
    run(() => verifyEmailCodeAction({ email, token: otp, purpose: "confirm", next }));
  };

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => sendResetCodeAction({ email, captchaToken: token() }),
      () => go("reset", sentTo("reset your password")),
    );
  };

  const onReset = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => verifyEmailCodeAction({ email, token: otp, purpose: "reset", next }),
      () => {
        setPassword("");
        go("new_password");
      },
    );
  };

  const onNewPassword = (e: FormEvent) => {
    e.preventDefault();
    run(() => setNewPasswordAction({ password, next }));
  };

  const resend = () =>
    run(
      () =>
        step === "confirm"
          ? resendSignupCodeAction({ email })
          : sendResetCodeAction({ email, captchaToken: token() }),
      () => setNotice(`We sent a new code to ${email.trim()}.`),
    );

  const onGoogle = () => run(() => googleSignInAction({ next }));

  const switchHref = `${register ? "/login" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const captchaMissing = !!turnstileSiteKey && !captchaToken;
  const captcha = turnstileSiteKey ? (
    <Turnstile siteKey={turnstileSiteKey} resetKey={captchaReset} onToken={onToken} />
  ) : null;
  const errorLine = error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null;
  const noticeLine = notice ? <p className="text-sm text-slate-700 dark:text-slate-300">{notice}</p> : null;

  const emailField = (autoFocus: boolean) => (
    <Field label="Email" htmlFor="email">
      <input
        id="email"
        type="email"
        required
        autoFocus={autoFocus}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={inputClass}
        placeholder="you@example.com"
      />
    </Field>
  );

  const passwordField = (isNew: boolean, label = "Password") => (
    <Field label={label} htmlFor="password">
      <input
        id="password"
        type="password"
        required
        autoFocus={step === "new_password"}
        minLength={isNew ? 8 : undefined}
        maxLength={72}
        autoComplete={isNew ? "new-password" : "current-password"}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className={inputClass}
        placeholder={isNew ? "At least 8 characters" : undefined}
      />
    </Field>
  );

  const codeForm = (onSubmit: (e: FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
      {noticeLine}
      <Field label="Code" htmlFor="otp">
        <input
          id="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={12}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className={`${inputClass} tracking-[0.3em]`}
          placeholder="123456"
        />
      </Field>
      {errorLine}
      <Button type="submit" disabled={pending}>
        {pending ? "Checking…" : submitLabel}
      </Button>
      <div className="flex justify-between">
        <button type="button" onClick={() => go(step === "confirm" ? "password" : "forgot")} className={linkButton}>
          Use a different email
        </button>
        {/* A Turnstile token is single-use and the widget isn't on this step. */}
        {turnstileSiteKey ? null : (
          <button type="button" onClick={resend} disabled={pending} className={linkButton}>
            Resend code
          </button>
        )}
      </div>
    </form>
  );

  const heading =
    step === "forgot" || step === "reset" || step === "new_password"
      ? "Reset your password"
      : step === "confirm"
        ? "Confirm your email"
        : register
          ? "Create an account"
          : "Sign in";

  const intro =
    step === "password"
      ? register
        ? "Create an account to save maps and claim your quiz results."
        : "Sign in with your email and password."
      : step === "forgot"
        ? "We'll email you a 6-digit code to reset your password."
        : step === "new_password"
          ? "Choose a new password for your account."
          : null;

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Worldview
        </Link>
        <h1 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">{heading}</h1>
        {intro ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{intro}</p> : null}

        {step === "password" ? (
          <form onSubmit={onPassword} className="mt-6 flex flex-col gap-4">
            {emailField(true)}
            {passwordField(register)}
            {captcha}
            {errorLine}
            <Button type="submit" disabled={pending || captchaMissing}>
              {pending ? (register ? "Creating…" : "Signing in…") : register ? "Create account" : "Sign in"}
            </Button>

            {register ? null : (
              <button type="button" onClick={() => go("forgot")} className={`self-start ${linkButton}`}>
                Forgot your password?
              </button>
            )}

            {googleEnabled ? (
              <>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  or
                  <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onGoogle}
                  disabled={pending}
                  className="border border-slate-300 dark:border-slate-700"
                >
                  Continue with Google
                </Button>
              </>
            ) : null}
          </form>
        ) : step === "confirm" ? (
          codeForm(onConfirm, register ? "Create account" : "Sign in")
        ) : step === "forgot" ? (
          <form onSubmit={onForgot} className="mt-6 flex flex-col gap-4">
            {emailField(true)}
            {captcha}
            {errorLine}
            <Button type="submit" disabled={pending || captchaMissing}>
              {pending ? "Sending…" : "Email me a code"}
            </Button>
            <button type="button" onClick={() => go("password")} className={`self-start ${linkButton}`}>
              Back to sign in
            </button>
          </form>
        ) : step === "reset" ? (
          codeForm(onReset, "Continue")
        ) : (
          <form onSubmit={onNewPassword} className="mt-6 flex flex-col gap-4">
            {passwordField(true, "New password")}
            {errorLine}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save password and sign in"}
            </Button>
          </form>
        )}

        {step === "password" ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            {register ? "Already have an account? " : "New to Worldview? "}
            <Link href={switchHref} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100">
              {register ? "Sign in" : "Create an account"}
            </Link>
          </p>
        ) : null}
        <p className="mt-6 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {register ? "By creating an account, you agree to the " : "Review the "}
          <Link href="/terms" className="underline underline-offset-2">Terms of Use</Link>
          {register ? " and acknowledge the " : " and "}
          <Link href="/privacy" className="underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </div>
    </div>
  );
}
