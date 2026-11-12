"use client";

import { useEffect, useId, useState } from "react";
import { Eye, EyeOff, Moon, Sun } from "lucide-react";

const HELD = [
  {
    mark: "overdue",
    meta: "Buyer · Borrowdale",
    detail: "Viewing follow-up was due yesterday",
  },
  {
    mark: "today",
    meta: "Offer · US$180,000",
    detail: "Seller sent a counter. The buyer signs again.",
  },
  {
    mark: "waiting",
    meta: "8 Stonechat · US$240,000",
    detail: "Buyer signed the form. The PDF is ready.",
  },
] as const;

type Mode = "password" | "code" | "reset";

export function SignInMock({
  dark,
  onToggleDark,
  onEnter,
}: {
  dark: boolean;
  onToggleDark: () => void;
  onEnter: () => void;
}) {
  const emailId = useId();
  const secretId = useId();
  const emailErrorId = useId();
  const secretErrorId = useId();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [secretError, setSecretError] = useState<string | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "opening" | "reset">("idle");

  useEffect(() => {
    if (phase !== "opening") return;
    const timer = window.setTimeout(onEnter, 640);
    return () => window.clearTimeout(timer);
  }, [onEnter, phase]);

  const busy = phase === "checking" || phase === "opening";

  function checkEmail(value: string) {
    const next = value.trim();
    if (!next) return "Enter the work email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) return "Use the full work email, including the @.";
    return null;
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || phase === "reset") return;
    const nextEmail = checkEmail(email);
    let nextSecret: string | null = null;
    if (mode === "password") {
      if (!secret) nextSecret = "Enter the password.";
      else if (secret === "wrongpassword") nextSecret = "That password does not match this desk.";
      else if (secret.length < 8) nextSecret = "That password is shorter than the one on file.";
    } else if (mode === "code") {
      if (!/^\d{6}$/.test(secret.trim())) nextSecret = "Enter the 6-digit code from the authenticator.";
    }
    setEmailError(nextEmail);
    setSecretError(nextSecret);
    if (nextEmail || nextSecret) return;

    setPhase("checking");
    window.setTimeout(() => {
      setPhase(mode === "reset" ? "reset" : "opening");
    }, 480);
  }

  function switchMode(next: Mode) {
    if (busy) return;
    setMode(next);
    setSecret("");
    setSecretError(null);
    setEmailError(null);
    setShowSecret(false);
    setPhase("idle");
  }

  const secretLabel = mode === "code" ? "Sign-in code" : "Password";
  const action =
    phase === "checking" ? "Checking the desk" : phase === "opening" ? "Opening the desk" : mode === "reset" ? "Prepare reset" : "Sign in";

  return (
    <div className="re-sign">
      <header className="re-sign-bar">
        <img
          src={dark ? "/segmiq-wordmark.png" : "/segmiq-wordmark-black.png"}
          alt="SegmiQ"
          className="re-sign-mark"
        />
        <span className="re-sign-desk">Real estate</span>
        <span className="re-sign-gap" />
        <span className="re-sb-theme" role="group" aria-label="Theme">
          <button type="button" aria-label="Light theme" aria-pressed={!dark} onClick={() => dark && onToggleDark()}>
            <Sun size={15} strokeWidth={1.8} aria-hidden />
          </button>
          <button type="button" aria-label="Dark theme" aria-pressed={dark} onClick={() => !dark && onToggleDark()}>
            <Moon size={15} strokeWidth={1.8} aria-hidden />
          </button>
        </span>
      </header>

      <div className="re-sign-body">
        <div className="re-sign-grid">
          <div className="re-sign-copy">
            <p className="re-sign-date">Monday 9 November</p>
            <h1 className="re-sign-title">Sign in</h1>
            <p className="re-sign-lede">3 items need a next action. Names stay on the desk until you are in.</p>

            <form className="re-sign-form" onSubmit={submit} noValidate>
              {phase === "reset" ? (
                <div className="re-sign-banner" role="status">
                  <p>Reset is ready for {email.trim()}.</p>
                  <p>The live product opens the reset page. This mock stays on the desk.</p>
                </div>
              ) : null}

              <label className="re-sign-label" htmlFor={emailId}>
                Work email
              </label>
              <input
                id={emailId}
                className={emailError ? "re-sign-field is-error" : "re-sign-field"}
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="tatenda@segmiq.test"
                value={email}
                disabled={busy}
                aria-invalid={emailError ? true : undefined}
                aria-describedby={emailError ? emailErrorId : undefined}
                onChange={(event) => {
                  setEmail(event.target.value);
                  if (emailError) setEmailError(null);
                  if (phase === "reset") setPhase("idle");
                }}
              />
              {emailError ? (
                <p id={emailErrorId} className="re-sign-error" role="alert">
                  {emailError}
                </p>
              ) : null}

              {mode !== "reset" && phase !== "reset" ? (
                <>
                  <div className="re-sign-label-row">
                    <label className="re-sign-label" htmlFor={secretId}>
                      {secretLabel}
                    </label>
                    {mode === "password" ? (
                      <button type="button" className="re-sign-text" onClick={() => switchMode("reset")} disabled={busy}>
                        Forgot password
                      </button>
                    ) : null}
                  </div>
                  <div className="re-sign-secret">
                    <input
                      id={secretId}
                      className={secretError ? "re-sign-field is-error" : "re-sign-field"}
                      type={mode === "code" || showSecret ? "text" : "password"}
                      name={mode === "code" ? "one-time-code" : "password"}
                      autoComplete={mode === "code" ? "one-time-code" : "current-password"}
                      inputMode={mode === "code" ? "numeric" : "text"}
                      maxLength={mode === "code" ? 6 : 128}
                      placeholder={mode === "code" ? "6 digits" : undefined}
                      value={secret}
                      disabled={busy}
                      aria-invalid={secretError ? true : undefined}
                      aria-describedby={secretError ? secretErrorId : undefined}
                      onChange={(event) => {
                        const value = mode === "code" ? event.target.value.replace(/\D/g, "").slice(0, 6) : event.target.value;
                        setSecret(value);
                        if (secretError) setSecretError(null);
                      }}
                    />
                    {mode === "password" ? (
                      <button
                        type="button"
                        className="re-sign-reveal"
                        aria-label={showSecret ? "Hide password" : "Show password"}
                        aria-pressed={showSecret}
                        disabled={busy}
                        onClick={() => setShowSecret((value) => !value)}
                      >
                        {showSecret ? <EyeOff size={16} strokeWidth={1.8} aria-hidden /> : <Eye size={16} strokeWidth={1.8} aria-hidden />}
                      </button>
                    ) : null}
                  </div>
                  {secretError ? (
                    <p id={secretErrorId} className="re-sign-error" role="alert">
                      {secretError}
                    </p>
                  ) : null}
                </>
              ) : null}

              {phase === "reset" ? (
                <button type="button" className="re-sign-submit" onClick={() => switchMode("password")}>
                  Back to sign in
                </button>
              ) : (
                <button type="submit" className="re-sign-submit" disabled={busy} aria-busy={busy || undefined} data-phase={phase}>
                  {action}
                </button>
              )}

              {phase !== "reset" ? (
                <div className="re-sign-alts">
                  {mode === "reset" ? (
                    <button type="button" className="re-sign-text" onClick={() => switchMode("password")} disabled={busy}>
                      Back to sign in
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="re-sign-text"
                      onClick={() => switchMode(mode === "code" ? "password" : "code")}
                      disabled={busy}
                    >
                      {mode === "code" ? "Use a password" : "Use a sign-in code"}
                    </button>
                  )}
                </div>
              ) : null}
            </form>
          </div>

          <section className="re-sign-record" aria-labelledby="sign-held">
            <div className="re-sign-record-head">
              <h2 id="sign-held">Needs you</h2>
              <span>3</span>
            </div>
            <ul>
              <li className="re-sign-group">Overdue</li>
              <HeldRow item={HELD[0]} />
              <li className="re-sign-group">Today</li>
              <HeldRow item={HELD[1]} />
              <li className="re-sign-group">Waiting</li>
              <HeldRow item={HELD[2]} />
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function HeldRow({ item }: { item: (typeof HELD)[number] }) {
  return (
    <li className="re-sign-row">
      <span className={`re-sign-rule is-${item.mark}`} aria-hidden />
      <div className="re-sign-row-copy">
        <p className="re-sign-held">
          <span className="sr-only">Name held until sign-in</span>
        </p>
        <p className="re-sign-meta">{item.meta}</p>
        <p className="re-sign-detail">{item.detail}</p>
      </div>
      <button type="button" className="re-sign-held-btn" disabled>
        Held
      </button>
    </li>
  );
}
