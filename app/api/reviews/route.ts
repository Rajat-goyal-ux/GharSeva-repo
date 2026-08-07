import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { reviews, serviceRequests, vendors } from "../../../db/schema";
import { firebaseAuthResponse, requireFirebaseGoogleUser } from "../../firebase-server";

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const requestId = String(p.requestId ?? "").trim().toUpperCase();
    const rating = Math.round(Number(p.rating));
    const feedback = String(p.feedback ?? "").trim().slice(0, 800);
    if (!requestId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return Response.json({ error: "1 से 5 star rating चुनें" }, { status: 400 });
    }

    const db = getDb();
    const [job] = await db.select().from(serviceRequests).where(and(
      eq(serviceRequests.id, requestId),
      eq(serviceRequests.ownerUid, user.uid),
    )).limit(1);
    if (!job) return Response.json({ error: "यह request आपके account में नहीं मिली" }, { status: 404 });
    if (job.status !== "completed" || !job.vendorId) {
      return Response.json({ error: "Rating काम पूरा होने के बाद दी जा सकती है" }, { status: 409 });
    }
    const [existing] = await db.select({ id: reviews.id }).from(reviews).where(eq(reviews.requestId, requestId)).limit(1);
    if (existing) return Response.json({ error: "इस काम की rating पहले दी जा चुकी है" }, { status: 409 });

    const [review] = await db.insert(reviews).values({ requestId, ownerUid: user.uid, vendorId: job.vendorId, rating, feedback }).returning();
    const [aggregate] = await db.select({ average: sql<number>`avg(${reviews.rating})` }).from(reviews).where(eq(reviews.vendorId, job.vendorId));
    const average = Math.round(Number(aggregate?.average ?? rating) * 10) / 10;
    await db.update(vendors).set({ rating: average }).where(eq(vendors.id, job.vendorId));
    return Response.json({ review, vendorRating: average }, { status: 201 });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Rating save नहीं हुई" }, { status: 500 });
  }
}
