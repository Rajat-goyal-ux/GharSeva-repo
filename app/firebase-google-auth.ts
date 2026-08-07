"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  User,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";

const firebaseConfig = {
  // Firebase web-app identifiers are public and are delivered to every browser.
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC_8XsX37AuGIhmJV7_c9e-1h7DC_ZVHaY",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "gharseva-db50a.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "gharseva-db50a",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "gharseva-db50a.firebasestorage.app",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:50138058156:web:2db021581b8ec04dd1fe09",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "50138058156",
};

export type GoogleSession = {
  uid: string;
  email: string;
  name: string;
  photoURL: string | null;
  token: string;
};

export function firebaseGoogleError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  const messages: Record<string, string> = {
    "auth/operation-not-allowed": "Firebase Console में Google sign-in provider enable करें.",
    "auth/unauthorized-domain": "GharSeva का domain Firebase Authorized domains में जोड़ें.",
    "auth/popup-blocked": "Google login popup block हो गया. Browser में popups allow करके दोबारा कोशिश करें.",
    "auth/popup-closed-by-user": "Google login पूरा नहीं हुआ. दोबारा कोशिश करें.",
    "auth/cancelled-popup-request": "Google login window बंद हो गई. दोबारा कोशिश करें.",
    "auth/network-request-failed": "Internet connection check करके दोबारा कोशिश करें.",
    "auth/account-exists-with-different-credential": "यह email किसी दूसरे login method से जुड़ा है.",
  };
  if (messages[code]) return messages[code];
  return error instanceof Error ? error.message : "Google login पूरा नहीं हुआ. दोबारा कोशिश करें.";
}

function googleAuth() {
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return getAuth(app);
}

async function sessionFromUser(user: User): Promise<GoogleSession> {
  if (!user.providerData.some((provider) => provider.providerId === "google.com")) {
    throw new Error("Google से sign in करके continue करें.");
  }
  if (!user.email) throw new Error("Google account में email नहीं मिली.");
  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email.split("@")[0],
    photoURL: user.photoURL,
    token: await user.getIdToken(),
  };
}

export async function signInGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(googleAuth(), provider);
  return sessionFromUser(credential.user);
}

export async function currentGoogleSession() {
  const user = googleAuth().currentUser;
  return user?.providerData.some((provider) => provider.providerId === "google.com") ? sessionFromUser(user) : null;
}

export async function restoreGoogleSession() {
  const auth = googleAuth();
  return new Promise<GoogleSession | null>((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      unsubscribe();
      resolve(user?.providerData.some((provider) => provider.providerId === "google.com") ? await sessionFromUser(user) : null);
    });
  });
}

export async function signOutGoogleSession() {
  await signOut(googleAuth());
}
