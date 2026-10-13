"use client";

import { useActionState } from "react";
import { loginAction, totpAction, type LoginState } from "./actions";

export default function LoginForm({ next, initialStep }: { next: string; initialStep: "password" | "totp" }) {
  const [pwState, pwAction, pwPending] = useActionState<LoginState, FormData>(loginAction, undefined);
  const [otpState, otpAction, otpPending] = useActionState<LoginState, FormData>(totpAction, undefined);
  const step = otpState?.step ?? pwState?.step ?? initialStep;

  if (step === "totp") {
    return (
      <form action={otpAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <p className="text-sm text-muted">Enter the six-digit code from your authenticator app.</p>
        <label className="block">
          <span className="label">Authentication code</span>
          <input name="code" className="field text-center text-2xl tracking-[0.5em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required autoFocus />
        </label>
        {otpState?.error && <p role="alert" className="rounded-lg bg-crimson-soft px-3 py-2 text-sm text-crimson">{otpState.error}</p>}
        <button className="btn btn-green w-full" disabled={otpPending}>{otpPending ? "Verifying…" : "Verify and sign in"}</button>
      </form>
    );
  }

  return (
    <form action={pwAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="label">Email</span>
        <input name="email" type="email" className="field" autoComplete="username" required autoFocus />
      </label>
      <label className="block">
        <span className="label">Password</span>
        <input name="password" type="password" className="field" autoComplete="current-password" required />
      </label>
      {pwState?.error && <p role="alert" className="rounded-lg bg-crimson-soft px-3 py-2 text-sm text-crimson">{pwState.error}</p>}
      <button className="btn btn-green w-full" disabled={pwPending}>{pwPending ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}
