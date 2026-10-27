import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
  type UserCredential,
} from "firebase/auth";

import { auth } from "./firebase";

export async function registerWithEmail(
  displayName: string,
  email: string,
  password: string
): Promise<UserCredential> {
  const credential = await createUserWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );

  const name = displayName.trim();

  if (name) {
    await updateProfile(credential.user, {
      displayName: name,
    });
  }

  await sendEmailVerification(credential.user);

  return credential;
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(
    auth,
    email.trim(),
    password
  );
}

export async function signOutCurrentUser(): Promise<void> {
  await signOut(auth);
}

export async function sendPasswordReset(
  email: string
): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function resendVerificationEmail(
  user: User | null = auth.currentUser
): Promise<void> {
  if (!user) {
    throw new Error("You must be signed in to verify your email.");
  }

  await sendEmailVerification(user);
}
