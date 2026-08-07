import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { appFeedback, ownerProfiles, vendors } from "../../../db/schema";
import { firebaseAuthResponse, requireFirebaseGoogleUser } from "../../firebase-server";

const phone10 = (value = "") => value.replace(/\D/g, "").slice(-10);

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const db = getDb();
    const [[owner], [vendor]] = await Promise.all([
      db.select().from(ownerProfiles).where(eq(ownerProfiles.firebaseUid, user.uid)).limit(1),
      db.select().from(vendors).where(eq(vendors.firebaseUid, user.uid)).limit(1),
    ]);
    return Response.json({
      owner: owner ?? { firebaseUid: user.uid, email: user.email, name: user.name, phone: "", language: "hi" },
      vendor: vendor ?? null,
    });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Profile load नहीं हुई" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const name = String(p.name ?? "").trim().slice(0, 80);
    const rawPhone = String(p.phone ?? "").trim();
    const phone = phone10(rawPhone);
    const language = p.language === "en" ? "en" : "hi";
    if (!name) return Response.json({ error: "नाम जरूरी है" }, { status: 400 });
    if (rawPhone && phone.length !== 10) return Response.json({ error: "Mobile number 10 digit होना चाहिए" }, { status: 400 });

    const db = getDb();
    const now = new Date().toISOString();
    await db.insert(ownerProfiles).values({
      firebaseUid: user.uid,
      email: user.email,
      name,
      phone,
      language,
      updatedAt: now,
    }).onConflictDoUpdate({
      target: ownerProfiles.firebaseUid,
      set: { email: user.email, name, phone, language, updatedAt: now },
    });
    const [owner] = await db.select().from(ownerProfiles).where(eq(ownerProfiles.firebaseUid, user.uid)).limit(1);
    return Response.json({ owner });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Profile save नहीं हुई" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const message = String(p.message ?? "").trim().slice(0, 1200);
    if (message.length < 5) return Response.json({ error: "Feedback कम से कम 5 अक्षर का लिखें" }, { status: 400 });
    const db = getDb();
    const [feedback] = await db.insert(appFeedback).values({ firebaseUid: user.uid, email: user.email, message }).returning();
    return Response.json({ feedback }, { status: 201 });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Feedback भेजा नहीं गया" }, { status: 500 });
  }
}
