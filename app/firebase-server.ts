import { createRemoteJWKSet, jwtVerify } from "jose";

const firebaseJwks = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

export type FirebaseGoogleUser = {
  uid: string;
  email: string;
  name: string;
};

export class FirebaseAuthError extends Error {
  constructor(message: string, public status = 401) {
    super(message);
    this.name = "FirebaseAuthError";
  }
}

export async function requireFirebaseGoogleUser(request: Request): Promise<FirebaseGoogleUser> {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || "gharseva-db50a";
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new FirebaseAuthError("Google से sign in करके continue करें");

  try {
    const { payload } = await jwtVerify(match[1], firebaseJwks, {
      algorithms: ["RS256"],
      audience: projectId,
      issuer: `https://securetoken.google.com/${projectId}`,
      clockTolerance: 5,
    });
    const firebase = typeof payload.firebase === "object" && payload.firebase ? payload.firebase as Record<string, unknown> : null;
    if (!payload.sub || typeof payload.sub !== "string") throw new Error("Missing subject");
    if (firebase?.sign_in_provider !== "google.com") throw new Error("Google provider required");
    if (typeof payload.email !== "string" || payload.email_verified !== true) throw new Error("Verified Google email required");
    return {
      uid: payload.sub,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : payload.email.split("@")[0],
    };
  } catch (error) {
    if (error instanceof FirebaseAuthError) throw error;
    throw new FirebaseAuthError("Google login session invalid या expire हो गया. दोबारा sign in करें");
  }
}

export function firebaseAuthResponse(error: unknown) {
  if (!(error instanceof FirebaseAuthError)) return null;
  return Response.json(
    { error: error.message, code: error.status === 403 ? "AUTH_FORBIDDEN" : "AUTH_REQUIRED" },
    { status: error.status },
  );
}
