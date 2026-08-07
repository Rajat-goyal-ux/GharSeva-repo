"use client";

import { useState } from "react";
import { GoogleSession, firebaseGoogleError, signInGoogle } from "./firebase-google-auth";

export default function GoogleLoginModal({
  purpose,
  onClose,
  onAuthenticated,
}: {
  purpose: string | null;
  onClose: () => void;
  onAuthenticated: (session: GoogleSession) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!purpose) return null;

  async function login() {
    setBusy(true);
    setError("");
    try {
      await onAuthenticated(await signInGoogle());
    } catch (cause) {
      setError(firebaseGoogleError(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="backdrop google-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="modal google-modal" role="dialog" aria-modal="true" aria-labelledby="google-login-title">
        <button className="close" onClick={onClose} aria-label="बंद करें">×</button>
        <div className="google-lock">G</div>
        <small>FREE & SECURE LOGIN</small>
        <h2 id="google-login-title">Google से sign in करें</h2>
        <p>{purpose} के लिए अपना Google account चुनें. कोई SMS charge नहीं लगेगा.</p>
        <button className="google-action" disabled={busy} onClick={login}>
          <span>G</span>{busy ? "Google login खुल रहा है…" : "Continue with Google"}
        </button>
        {error && <div className="otp-error">{error}</div>}
        <p className="google-consent">GharSeva को आपका नाम, email और Google account ID मिलेगा; password हमें नहीं मिलता. <a href="/privacy" target="_blank">Privacy policy</a></p>
      </section>
    </div>
  );
}
