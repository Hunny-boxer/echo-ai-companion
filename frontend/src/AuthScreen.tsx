import { useState } from "react";
import type { FormEvent } from "react";
import {
  registerWithEmail,
  sendPasswordReset,
  signInWithEmail,
} from "./authService";
import "./auth.css";

type AuthMode = "signin" | "signup" | "reset";

function getAuthError(error: unknown): string {
  const code =
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";

  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists with this email.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Please choose a stronger password.";
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Your email or password is incorrect.";
    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";
    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";
    case "auth/operation-not-allowed":
      return "This sign-in method is not enabled in Firebase.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signin");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (mode === "signup" && password !== confirmPassword) {
      setError("Your passwords do not match.");
      return;
    }

    if (mode === "signup" && password.length < 6) {
      setError("Your password must contain at least 6 characters.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        await registerWithEmail(displayName, email, password);
        setNotice("Your account has been created. Check your email for verification.");
      } else if (mode === "signin") {
        await signInWithEmail(email, password);
      } else {
        await sendPasswordReset(email);
        setNotice("If an account exists for this email, a reset email will be sent.");
      }
    } catch (requestError) {
      setError(getAuthError(requestError));
    } finally {
      setLoading(false);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setNotice("");
  }

  const isReset = mode === "reset";
  const isSignup = mode === "signup";

  return (
    <main className="auth-screen">
      <div className="auth-glow auth-glow-one" />
      <div className="auth-glow auth-glow-two" />

      <section className="auth-card">
        <div className="auth-brand">
          <div className="auth-brand-mark" aria-hidden="true">
            ✦
          </div>
          <span>echo</span>
        </div>

        <div className="auth-orb" aria-hidden="true">
          <div className="auth-orb-inner">e</div>
        </div>

        <p className="auth-eyebrow">
          YOUR PERSONAL AI COMPANION
        </p>

        <h1>
          {isReset
            ? "Reset your password"
            : isSignup
              ? "A space of your own."
              : "Good to have you here."}
        </h1>

        <p className="auth-description">
          {isReset
            ? "Enter your email and we'll help you get back in."
            : isSignup
              ? "Create your account and start a conversation that feels like you."
              : "A little space to think, talk, and be yourself."}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-name">Your name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="What should Echo call you?"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                required
              />
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="auth-email">Email address</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          {!isReset && (
            <div className="auth-field">
              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                autoComplete={
                  isSignup ? "new-password" : "current-password"
                }
                placeholder="At least 6 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          {isSignup && (
            <div className="auth-field">
              <label htmlFor="auth-confirm-password">
                Confirm password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                autoComplete="new-password"
                placeholder="Enter your password again"
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(event.target.value)
                }
                minLength={6}
                required
              />
            </div>
          )}

          {error && (
            <p className="auth-message auth-error" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="auth-message auth-notice" role="status">
              {notice}
            </p>
          )}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
          >
            {loading
              ? "Please wait..."
              : isReset
                ? "Send reset email"
                : isSignup
                  ? "Create your account"
                  : "Sign in to Echo"}
            {!loading && <span aria-hidden="true"> ↗</span>}
          </button>
        </form>

        {!isReset && !isSignup && (
          <button
            className="auth-text-button auth-forgot"
            type="button"
            onClick={() => changeMode("reset")}
          >
            Forgot your password?
          </button>
        )}

        <div className="auth-switch">
          {isReset ? (
            <>
              Remember your password?{" "}
              <button
                className="auth-text-button"
                type="button"
                onClick={() => changeMode("signin")}
              >
                Sign in
              </button>
            </>
          ) : isSignup ? (
            <>
              Already have an account?{" "}
              <button
                className="auth-text-button"
                type="button"
                onClick={() => changeMode("signin")}
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              New to Echo?{" "}
              <button
                className="auth-text-button"
                type="button"
                onClick={() => changeMode("signup")}
              >
                Create an account
              </button>
            </>
          )}
        </div>

        <p className="auth-privacy">
          Your space, your pace. Your conversations are personal.
        </p>
      </section>
    </main>
  );
}
