import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";

import { auth } from "./firebase";
import { signOutCurrentUser } from "./authService";
import AuthScreen from "./AuthScreen";

type AuthGateProps = {
  children: ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [user, setUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingSession(false);
    });
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    setSignOutError("");

    try {
      await signOutCurrentUser();
    } catch {
      setSignOutError("Could not sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }

  if (checkingSession) {
    return (
      <div
        role="status"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0d0b14",
          color: "#c0a5ff",
          fontFamily: "sans-serif",
        }}
      >
        Loading Echo...
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "16px",
          padding: "12px 20px",
          background: "#0d0b14",
          color: "#f4f0fa",
          borderBottom: "1px solid rgba(255,255,255,0.09)",
          fontFamily: "sans-serif",
        }}
      >
        <div>
          <strong style={{ display: "block", fontSize: "14px" }}>
            Welcome{user.displayName ? `, ${user.displayName}` : ""}
          </strong>
          <span style={{ color: "#a49caf", fontSize: "12px" }}>
            {user.email}
          </span>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {signOutError && (
            <span role="alert" style={{ color: "#ffb3c0", fontSize: "12px" }}>
              {signOutError}
            </span>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            style={{
              padding: "9px 14px",
              borderRadius: "9px",
              border: "1px solid rgba(255,255,255,0.15)",
              background: "#211b2d",
              color: "#f4f0fa",
              cursor: isSigningOut ? "wait" : "pointer",
            }}
          >
            {isSigningOut ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}
