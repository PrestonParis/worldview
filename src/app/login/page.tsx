"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Field, inputClass } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Worldview
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Invite-only. Sign in with the email address you were invited on.
        </p>

        {status === "sent" ? (
          <p className="mt-6 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            Check <strong>{email}</strong> for a sign-in link.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-4">
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="you@example.com"
              />
            </Field>

            {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

            <Button type="submit" disabled={status === "sending"}>
              {status === "sending" ? "Sending…" : "Send sign-in link"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
