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
  sendEmailCodeAction,
  verifyEmailCodeAction,
  type AuthMode,
} from "@/lib/actions/auth";

const ERROR_MESSAGES: Record<string, string> = {
  auth: "Sign-in didn't complete. Try again.",
  not_registered: "That account isn't registered yet. Enter the registration code to create it.",
};

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
  // "password" is the main path; "code" is the emailed-code fallback for a
  // forgotten password (sign-in only).
  const [method, setMethod] = useState<"password" | "code">("password");
  const [step, setStep] = useState<"start" | "verify">("start");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [otp, setOtp] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const [error, setError] = useState<string | null>(
    initialError ? (ERROR_MESSAGES[initialError] ?? ERROR_MESSAGES.auth) : null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const onToken = useCallback((token: string | null) => setCaptchaToken(token), []);

  const sendCode = () => {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await sendEmailCodeAction({
        mode,
        email,
        registrationCode: register ? registrationCode : undefined,
        captchaToken: captchaToken ?? undefined,
      });
      setCaptchaReset((n) => n + 1);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setStep("verify");
      setNotice(`We sent a code to ${email.trim()}.`);
    });
  };

  const onPassword = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const token = captchaToken ?? undefined;
      // Both redirect on success.
      const result = register
        ? await passwordRegisterAction({ email, password, registrationCode, next, captchaToken: token })
        : await passwordSignInAction({ email, password, next, captchaToken: token });
      setCaptchaReset((n) => n + 1);
      if (result && !result.ok) setError(result.error);
    });
  };

  const onSend = (e: FormEvent) => {
    e.preventDefault();
    sendCode();
  };

  const onVerify = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      // Redirects on success.
      const result = await verifyEmailCodeAction({ email, token: otp, next });
      if (result && !result.ok) setError(result.error);
    });
  };

  const onGoogle = () => {
    setError(null);
    if (register && !registrationCode.trim()) {
      setError("Enter the registration code first.");
      return;
    }
    startTransition(async () => {
      const result = await googleSignInAction({ mode, registrationCode, next });
      if (result && !result.ok) setError(result.error);
    });
  };

  const switchHref = `${register ? "/login" : "/register"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;
  const captchaMissing = !!turnstileSiteKey && !captchaToken;

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Worldview
        </Link>
        <h1 className="mt-4 text-lg font-medium text-slate-900 dark:text-slate-100">
          {register ? "Create an account" : "Sign in"}
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {register
            ? "You'll need a registration code to create an account."
            : method === "code"
              ? "We'll email you a 6-digit code to sign in with."
              : "Sign in with your email and password."}
        </p>

        {method === "password" ? (
          <form onSubmit={onPassword} className="mt-6 flex flex-col gap-4">
            {register ? (
              <Field label="Registration code" htmlFor="registrationCode">
                <input
                  id="registrationCode"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  value={registrationCode}
                  onChange={(e) => setRegistrationCode(e.target.value)}
                  className={inputClass}
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoFocus={!register}
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>

            <Field label="Password" htmlFor="password">
              <input
                id="password"
                type="password"
                required
                minLength={register ? 8 : undefined}
                autoComplete={register ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
                placeholder={register ? "At least 8 characters" : undefined}
              />
            </Field>

            {turnstileSiteKey ? (
              <Turnstile siteKey={turnstileSiteKey} resetKey={captchaReset} onToken={onToken} />
            ) : null}

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <Button type="submit" disabled={pending || captchaMissing}>
              {pending ? (register ? "Creating…" : "Signing in…") : register ? "Create account" : "Sign in"}
            </Button>

            {register ? null : (
              <button
                type="button"
                onClick={() => {
                  setMethod("code");
                  setError(null);
                }}
                className="self-start text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Forgot your password? Email me a sign-in code
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
        ) : step === "start" ? (
          <form onSubmit={onSend} className="mt-6 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>

            {turnstileSiteKey ? (
              <Turnstile siteKey={turnstileSiteKey} resetKey={captchaReset} onToken={onToken} />
            ) : null}

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <Button type="submit" disabled={pending || captchaMissing}>
              {pending ? "Sending…" : "Email me a code"}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMethod("password");
                setError(null);
              }}
              className="self-start text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Back to password sign-in
            </button>
          </form>
        ) : (
          <form onSubmit={onVerify} className="mt-6 flex flex-col gap-4">
            {notice ? <p className="text-sm text-slate-700 dark:text-slate-300">{notice}</p> : null}
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

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <Button type="submit" disabled={pending}>
              {pending ? "Checking…" : register ? "Create account" : "Sign in"}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("start");
                  setOtp("");
                  setError(null);
                }}
                className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              >
                Use a different email
              </button>
              {turnstileSiteKey ? null : (
                <button
                  type="button"
                  onClick={sendCode}
                  disabled={pending}
                  className="text-slate-500 hover:text-slate-900 disabled:opacity-50 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  Resend code
                </button>
              )}
            </div>
          </form>
        )}

        <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
          {register ? "Already have an account? " : "New to Worldview? "}
          <Link href={switchHref} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-slate-100">
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </div>
    </div>
  );
}
