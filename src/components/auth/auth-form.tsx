"use client";

import Link from "next/link";
import { useCallback, useState, useTransition, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { AuthLayout } from "@/components/auth/auth-layout";
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
  "text-sm text-slate-500 underline-offset-4 decoration-red-600 hover:text-slate-900 hover:underline " +
  "disabled:opacity-50 dark:text-slate-400 dark:decoration-red-500 dark:hover:text-slate-100";

// Brand red on focus; the rest of the input styling is shared site-wide.
const authInput =
  `${inputClass} h-11 focus:border-red-600 focus:ring-2 focus:ring-red-600/15 ` +
  "dark:focus:border-red-500 dark:focus:ring-red-500/20";

const primaryButton = "h-11 w-full gap-2 font-semibold";

const secondaryButton =
  "flex h-11 w-full items-center justify-center rounded-md border border-slate-300 text-sm font-semibold " +
  "text-slate-900 transition-colors hover:border-slate-400 hover:bg-white dark:border-slate-700 " +
  "dark:text-slate-100 dark:hover:border-slate-500 dark:hover:bg-slate-900";

function Divider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500">
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
      {children}
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
    </div>
  );
}

function SubmitButton({ pending, disabled, idle, busy }: { pending: boolean; disabled: boolean; idle: string; busy: string }) {
  return (
    <Button type="submit" disabled={pending || disabled} className={primaryButton}>
      {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin text-red-500" /> : null}
      {pending ? busy : idle}
    </Button>
  );
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
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
  const errorLine = error ? (
    <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
      {error}
    </p>
  ) : null;
  const noticeLine = notice ? <p className="text-sm text-slate-700 dark:text-slate-300">{notice}</p> : null;

  const emailField = (autoFocus: boolean) => (
    <Field label="Email" htmlFor="email">
      <input
        id="email"
        name="email"
        type="email"
        required
        autoFocus={autoFocus}
        // On sign-in the email is the login identifier; "username" lets password
        // managers pair it with the current-password field and offer saved logins.
        autoComplete={step === "password" && !register ? "username" : "email"}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className={authInput}
        placeholder="you@example.com"
      />
    </Field>
  );

  const trackCapsLock = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));

  const passwordField = (isNew: boolean, label = "Password") => (
    <Field label={label} htmlFor="password">
      <div className="relative">
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          required
          autoFocus={step === "new_password"}
          minLength={isNew ? 8 : undefined}
          maxLength={72}
          autoComplete={isNew ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={trackCapsLock}
          onKeyUp={trackCapsLock}
          onBlur={() => setCapsLock(false)}
          className={`${authInput} pr-11`}
          placeholder={isNew ? "At least 8 characters" : undefined}
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {capsLock ? <p className="text-xs text-amber-600 dark:text-amber-400">Caps Lock is on.</p> : null}
    </Field>
  );

  const codeForm = (onSubmit: (e: FormEvent) => void, submitLabel: string) => (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {noticeLine}
      <Field label="Code" htmlFor="otp">
        <input
          id="otp"
          name="otp"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          autoFocus
          maxLength={12}
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          className={`${authInput} tracking-[0.3em]`}
          placeholder="123456"
        />
      </Field>
      {errorLine}
      <SubmitButton pending={pending} disabled={!otp.trim()} idle={submitLabel} busy="Checking…" />
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
        ? "Save maps and claim your quiz results."
        : "Access your Worldview account."
      : step === "forgot"
        ? "We'll email you a 6-digit code to reset your password."
        : step === "new_password"
          ? "Choose a new password for your account."
          : null;

  return (
    <AuthLayout title={heading} intro={intro}>
      {step === "password" ? (
        <>
          <form onSubmit={onPassword} className="flex flex-col gap-4">
            {emailField(true)}
            {passwordField(register)}
            {register ? null : (
              <button type="button" onClick={() => go("forgot")} className={`-mt-1 self-end ${linkButton}`}>
                Forgot password?
              </button>
            )}
            {captcha}
            {errorLine}
            <SubmitButton
              pending={pending}
              disabled={captchaMissing || !email.trim() || !password}
              idle={register ? "Create account" : "Sign in"}
              busy={register ? "Creating account…" : "Signing in…"}
            />
            {googleEnabled ? (
              <>
                <Divider>or</Divider>
                <button type="button" onClick={onGoogle} disabled={pending} className={`${secondaryButton} disabled:opacity-50`}>
                  Continue with Google
                </button>
              </>
            ) : null}
          </form>

          <div className="mt-8 flex flex-col gap-3">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {register ? "Already have an account?" : "New to Worldview?"}
            </p>
            <Link href={switchHref} className={secondaryButton}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </div>
        </>
      ) : step === "confirm" ? (
        codeForm(onConfirm, register ? "Create account" : "Sign in")
      ) : step === "forgot" ? (
        <form onSubmit={onForgot} className="flex flex-col gap-4">
          {emailField(true)}
          {captcha}
          {errorLine}
          <SubmitButton pending={pending} disabled={captchaMissing || !email.trim()} idle="Email me a code" busy="Sending…" />
          <button type="button" onClick={() => go("password")} className={`self-start ${linkButton}`}>
            Back to sign in
          </button>
        </form>
      ) : step === "reset" ? (
        codeForm(onReset, "Continue")
      ) : (
        <form onSubmit={onNewPassword} className="flex flex-col gap-4">
          {passwordField(true, "New password")}
          {errorLine}
          <SubmitButton pending={pending} disabled={!password} idle="Save password and sign in" busy="Saving…" />
        </form>
      )}
    </AuthLayout>
  );
}
