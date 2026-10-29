"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
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
  sendSignInCodeAction,
  setNewPasswordAction,
  verifyEmailCodeAction,
  type AuthMode,
} from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Sign-in didn't complete. Try again.",
};

// password:    email + password (sign in or register)
// code_email:  email to send a sign-in code to (no password)
// signin_code: the sign-in code
// confirm:     code that confirms a new password account's email
// forgot:      email to send a reset code to
// reset:       the reset code (a right code moves on to /reset-password)
type Step = "password" | "code_email" | "signin_code" | "confirm" | "forgot" | "reset";
type CodeStep = "signin_code" | "confirm" | "reset";

// Supabase won't send another code to the same address sooner than this.
const RESEND_SECONDS = 60;

const linkButton =
  "text-sm text-slate-500 underline-offset-4 decoration-red-600 hover:text-slate-900 hover:underline " +
  "disabled:opacity-50 disabled:hover:no-underline dark:text-slate-400 dark:decoration-red-500 dark:hover:text-slate-100";

// Brand red on focus; the rest of the input styling is shared site-wide.
const authInput =
  `${inputClass} h-11 focus:border-red-600 focus:ring-2 focus:ring-red-600/15 ` +
  "dark:focus:border-red-500 dark:focus:ring-red-500/20";

const primaryButton = "h-11 w-full gap-2 font-semibold";

const secondaryButton =
  "flex h-11 w-full items-center justify-center gap-2.5 rounded-md border border-slate-300 text-sm font-semibold " +
  "text-slate-900 transition-colors hover:border-slate-400 hover:bg-white disabled:opacity-50 dark:border-slate-700 " +
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

function GoogleMark() {
  return (
    <svg aria-hidden viewBox="0 0 48 48" className="h-4.5 w-4.5">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

function SubmitButton({
  pending,
  disabled,
  idle,
  busy,
}: {
  pending: boolean;
  disabled: boolean;
  idle: string;
  busy: string;
}) {
  return (
    <Button type="submit" disabled={pending || disabled} className={primaryButton}>
      {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin text-red-500" /> : null}
      {pending ? busy : idle}
    </Button>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  return error ? (
    <p
      role="alert"
      className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {error}
    </p>
  ) : null;
}

// Seconds left before another code may be requested.
function useCooldown() {
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (until <= now) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [until, now]);
  const start = useCallback(() => {
    const t = Date.now();
    setNow(t);
    setUntil(t + RESEND_SECONDS * 1000);
  }, []);
  return { left: Math.max(0, Math.ceil((until - now) / 1000)), start };
}

function PasswordInput({
  value,
  onChange,
  isNew,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  isNew: boolean;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const trackCapsLock = (e: KeyboardEvent<HTMLInputElement>) => setCapsLock(e.getModifierState("CapsLock"));
  return (
    <>
      <div className="relative">
        <input
          id="password"
          name="password"
          type={show ? "text" : "password"}
          required
          autoFocus={autoFocus}
          minLength={isNew ? 8 : undefined}
          maxLength={72}
          autoComplete={isNew ? "new-password" : "current-password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={trackCapsLock}
          onKeyUp={trackCapsLock}
          onBlur={() => setCapsLock(false)}
          className={`${authInput} pr-11`}
          placeholder={isNew ? "At least 8 characters" : undefined}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {capsLock ? <p className="text-xs text-amber-600 dark:text-amber-400">Caps Lock is on.</p> : null}
    </>
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
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? ERROR_MESSAGES.auth) : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const cooldown = useCooldown();
  const onToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  const go = (nextStep: Step, message: string | null = null) => {
    setStep(nextStep);
    setError(null);
    setNotice(message);
    setOtp("");
  };

  // Runs a server action; actions that succeed without redirecting say which
  // step comes next.
  const run = (
    action: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string } | undefined>,
    after?: (data: unknown) => void,
  ) => {
    setError(null);
    startTransition(async () => {
      const result = await action();
      setCaptchaReset((n) => n + 1);
      if (!result) return;
      if (!result.ok) setError(result.error);
      else after?.(result.data);
    });
  };

  const address = email.trim();
  const token = () => captchaToken ?? undefined;
  const sentCode = (nextStep: CodeStep, message: string) => {
    cooldown.start();
    go(nextStep, message);
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    run(
      () =>
        register
          ? passwordRegisterAction({ email, password, next, captchaToken: token() })
          : passwordSignInAction({ email, password, next, captchaToken: token() }),
      () => sentCode("confirm", `We sent a code to ${address}. Enter it to confirm your email.`),
    );
  };

  const onCodeEmail = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => sendSignInCodeAction({ email, captchaToken: token() }),
      () => sentCode("signin_code", `We sent a code to ${address}. Enter it to continue.`),
    );
  };

  const onForgot = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => sendResetCodeAction({ email, captchaToken: token() }),
      () => sentCode("reset", `If an account uses ${address}, we sent it a code. Enter it to reset your password.`),
    );
  };

  const PURPOSE = { signin_code: "signin", confirm: "confirm", reset: "reset" } as const;
  const onCode = (e: FormEvent) => {
    e.preventDefault();
    if (step !== "signin_code" && step !== "confirm" && step !== "reset") return;
    run(() => verifyEmailCodeAction({ email, token: otp, purpose: PURPOSE[step], next }));
  };

  const resend = () =>
    run(
      () =>
        step === "confirm"
          ? resendSignupCodeAction({ email, captchaToken: token() })
          : step === "reset"
            ? sendResetCodeAction({ email, captchaToken: token() })
            : sendSignInCodeAction({ email, captchaToken: token() }),
      () => {
        cooldown.start();
        setNotice(`We sent a new code to ${address}. Use the newest one.`);
      },
    );

  const onGoogle = () => run(() => googleSignInAction({ next }));

  const switchHref = `${register ? "/login" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const captchaMissing = !!turnstileSiteKey && !captchaToken;
  const captcha = turnstileSiteKey ? (
    <Turnstile siteKey={turnstileSiteKey} resetKey={captchaReset} onToken={onToken} />
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

  const google = googleEnabled ? (
    <>
      <button type="button" onClick={onGoogle} disabled={pending} className={secondaryButton}>
        <GoogleMark />
        Continue with Google
      </button>
      <Divider>or</Divider>
    </>
  ) : null;

  const codeForm = (submitLabel: string, back: Step) => (
    <form onSubmit={onCode} className="flex flex-col gap-4">
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
          className={`${authInput} tracking-[0.3em] placeholder:tracking-normal`}
          placeholder="Code from the email"
        />
      </Field>
      {captcha}
      <ErrorLine error={error} />
      <SubmitButton pending={pending} disabled={!otp.trim()} idle={submitLabel} busy="Checking…" />
      <div className="flex justify-between">
        <button type="button" onClick={() => go(back)} className={linkButton}>
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={pending || cooldown.left > 0 || captchaMissing}
          className={linkButton}
        >
          {cooldown.left > 0 ? `Resend code in ${cooldown.left}s` : "Resend code"}
        </button>
      </div>
      <p className="text-xs text-slate-400 dark:text-slate-500">Not there? Check spam. Codes expire after an hour.</p>
    </form>
  );

  const heading =
    step === "forgot" || step === "reset"
      ? "Reset your password"
      : step === "confirm"
        ? "Confirm your email"
        : step === "code_email" || step === "signin_code"
          ? register
            ? "Sign up with an email code"
            : "Sign in with an email code"
          : register
            ? "Create an account"
            : "Sign in";

  const intro =
    step === "password"
      ? register
        ? "Save maps and claim your quiz results."
        : "Access your Worldview account."
      : step === "forgot"
        ? "We'll email you a code to reset your password."
        : step === "code_email"
          ? register
            ? "No password needed. We'll email you a code that creates your account."
            : "No password needed. We'll email you a code. New here? It creates your account."
          : null;

  return (
    <AuthLayout title={heading} intro={intro}>
      {step === "password" ? (
        <>
          <div className="flex flex-col gap-4">
            {google}
            <form onSubmit={onPassword} className="flex flex-col gap-4">
              {emailField(true)}
              <Field label="Password" htmlFor="password">
                <PasswordInput value={password} onChange={setPassword} isNew={register} />
              </Field>
              {register ? null : (
                <button type="button" onClick={() => go("forgot")} className={`-mt-1 self-end ${linkButton}`}>
                  Forgot password?
                </button>
              )}
              {captcha}
              <ErrorLine error={error} />
              <SubmitButton
                pending={pending}
                disabled={captchaMissing || !address || !password}
                idle={register ? "Create account" : "Sign in"}
                busy={register ? "Creating account…" : "Signing in…"}
              />
            </form>
            <button type="button" onClick={() => go("code_email")} className={`self-center ${linkButton}`}>
              {register ? "Sign up with an email code instead" : "Email me a sign-in code instead"}
            </button>
          </div>

          <div className="mt-8 flex flex-col gap-3">
            <p className="text-center text-sm text-slate-500 dark:text-slate-400">
              {register ? "Already have an account?" : "New to Worldview?"}
            </p>
            <Link href={switchHref} className={secondaryButton}>
              {register ? "Sign in" : "Create an account"}
            </Link>
          </div>
        </>
      ) : step === "code_email" ? (
        <div className="flex flex-col gap-4">
          {google}
          <form onSubmit={onCodeEmail} className="flex flex-col gap-4">
            {emailField(true)}
            {captcha}
            <ErrorLine error={error} />
            <SubmitButton
              pending={pending}
              disabled={captchaMissing || !address}
              idle="Email me a code"
              busy="Sending…"
            />
            <button type="button" onClick={() => go("password")} className={`self-start ${linkButton}`}>
              Use a password instead
            </button>
          </form>
        </div>
      ) : step === "signin_code" ? (
        codeForm("Continue", "code_email")
      ) : step === "confirm" ? (
        codeForm(register ? "Create account" : "Sign in", "password")
      ) : step === "forgot" ? (
        <form onSubmit={onForgot} className="flex flex-col gap-4">
          {emailField(true)}
          {captcha}
          <ErrorLine error={error} />
          <SubmitButton
            pending={pending}
            disabled={captchaMissing || !address}
            idle="Email me a code"
            busy="Sending…"
          />
          <button type="button" onClick={() => go("password")} className={`self-start ${linkButton}`}>
            Back to sign in
          </button>
        </form>
      ) : (
        codeForm("Continue", "forgot")
      )}
    </AuthLayout>
  );
}

// /reset-password: the reset code already signed the account in; this sets
// the new password and moves on to `next`.
export function NewPasswordForm({ next }: { next: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await setNewPasswordAction({ password, next });
      if (result && !result.ok) setError(result.error);
    });
  };

  return (
    <AuthLayout title="Choose a new password" intro="Your code checked out. Set a new password to finish.">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <Field label="New password" htmlFor="password">
          <PasswordInput value={password} onChange={setPassword} isNew autoFocus />
        </Field>
        <ErrorLine error={error} />
        <SubmitButton
          pending={pending}
          disabled={password.length < 8}
          idle="Save password and continue"
          busy="Saving…"
        />
      </form>
    </AuthLayout>
  );
}
