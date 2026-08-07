import { and, desc, eq, ne, or } from "drizzle-orm";
import { getDb } from "../../../db";
import { vendors } from "../../../db/schema";
import { firebaseAuthResponse, requireFirebaseGoogleUser } from "../../firebase-server";

const ONLINE_WINDOW_MS = 90_000;
const phone10 = (value = "") => value.replace(/\D/g, "").slice(-10);

function isOnline(row: typeof vendors.$inferSelect) {
  if (!row.available || !row.lastSeenAt) return false;
  const seen = Date.parse(row.lastSeenAt);
  return Number.isFinite(seen) && Date.now() - seen <= ONLINE_WINDOW_MS;
}

function publicVendor(row: typeof vendors.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    workDescription: row.workDescription,
    area: row.area,
    pincode: row.pincode,
    experienceYears: row.experienceYears,
    rate: row.rate,
    rateUnit: row.rateUnit,
    negotiable: row.negotiable,
    available: row.available,
    online: isOnline(row),
    verified: row.verified,
    rating: row.rating,
    completedJobs: row.completedJobs,
    createdAt: row.createdAt,
  };
}

function privateVendor(row: typeof vendors.$inferSelect) {
  return { ...row, online: isOnline(row) };
}

export async function GET(request: Request) {
  try {
    const mine = new URL(request.url).searchParams.get("mine") === "1";
    const db = getDb();
    if (mine) {
      const user = await requireFirebaseGoogleUser(request);
      const rows = await db.select().from(vendors).where(eq(vendors.firebaseUid, user.uid)).limit(1);
      return Response.json({ vendors: rows.map(privateVendor) });
    }
    const rows = await db.select().from(vendors)
      .orderBy(desc(vendors.available), desc(vendors.lastSeenAt), desc(vendors.rating), desc(vendors.completedJobs))
      .limit(200);
    return Response.json({ vendors: rows.map(publicVendor), refreshedAt: new Date().toISOString() });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Vendor list load nahi hui" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const name = String(p.name ?? "").trim();
    const phone = phone10(String(p.phone ?? ""));
    const category = String(p.category ?? "").trim();
    const area = String(p.area ?? "").trim();
    const pincode = String(p.pincode ?? "").replace(/\D/g, "").slice(0, 6);
    const rate = Math.max(0, Number(p.rate ?? 0));
    if (!name || phone.length !== 10 || !category || !area || pincode.length !== 6 || !rate) {
      return Response.json({ error: "Naam, 10 digit contact, category, area, pincode aur rate zaroori hain" }, { status: 400 });
    }

    const db = getDb();
    const [existing] = await db.select().from(vendors).where(or(eq(vendors.firebaseUid, user.uid), eq(vendors.phone, phone))).limit(1);
    if (existing?.firebaseUid === user.uid) {
      return Response.json({ error: "इस Google account से vendor profile पहले से बनी है" }, { status: 409 });
    }
    if (existing) return Response.json({ error: "यह contact mobile किसी vendor profile में पहले से इस्तेमाल है" }, { status: 409 });

    const now = new Date().toISOString();
    const [vendor] = await db.insert(vendors).values({
      firebaseUid: user.uid,
      accountEmail: user.email,
      name,
      phone,
      category,
      area,
      pincode,
      rate,
      workDescription: String(p.workDescription ?? "").trim(),
      experienceYears: Math.max(0, Number(p.experienceYears ?? 0)),
      rateUnit: String(p.rateUnit ?? "visit"),
      negotiable: Boolean(p.negotiable ?? true),
      available: true,
      latitude: p.latitude == null ? null : Number(p.latitude),
      longitude: p.longitude == null ? null : Number(p.longitude),
      lastSeenAt: now,
    }).returning();
    return Response.json({ vendor: privateVendor(vendor) }, { status: 201 });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Registration nahi hua" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const db = getDb();
    const [current] = await db.select().from(vendors).where(eq(vendors.firebaseUid, user.uid)).limit(1);
    if (!current) return Response.json({ error: "पहले vendor profile बनाएँ" }, { status: 404 });

    if (p.profile === true) {
      const name = String(p.name ?? "").trim().slice(0, 80);
      const phone = phone10(String(p.phone ?? ""));
      const category = String(p.category ?? "").trim().slice(0, 80);
      const area = String(p.area ?? "").trim().slice(0, 100);
      const pincode = String(p.pincode ?? "").replace(/\D/g, "").slice(0, 6);
      const rate = Math.max(0, Number(p.rate ?? 0));
      const experienceYears = Math.max(0, Math.min(80, Number(p.experienceYears ?? 0)));
      const rateUnit = String(p.rateUnit ?? "visit");
      if (!name || phone.length !== 10 || !category || !area || pincode.length !== 6 || !rate || !["visit", "hour", "day", "sqft", "job"].includes(rateUnit)) {
        return Response.json({ error: "नाम, 10 digit contact, category, area, pincode और valid rate जरूरी हैं" }, { status: 400 });
      }
      const [phoneOwner] = await db.select({ id: vendors.id }).from(vendors)
        .where(and(eq(vendors.phone, phone), ne(vendors.id, current.id))).limit(1);
      if (phoneOwner) return Response.json({ error: "यह mobile किसी दूसरी vendor profile में इस्तेमाल है" }, { status: 409 });

      const [updated] = await db.update(vendors).set({
        accountEmail: user.email,
        name,
        phone,
        category,
        area,
        pincode,
        rate,
        experienceYears,
        rateUnit,
        workDescription: String(p.workDescription ?? "").trim().slice(0, 800),
        negotiable: Boolean(p.negotiable),
      }).where(eq(vendors.id, current.id)).returning();
      return Response.json({ vendor: privateVendor(updated) });
    }

    const hasAvailability = typeof p.available === "boolean";
    const available = hasAvailability ? Boolean(p.available) : current.available;
    const heartbeat = p.heartbeat === true;
    const lastSeenAt = available && (heartbeat || hasAvailability) ? new Date().toISOString() : available ? current.lastSeenAt : null;
    const [updated] = await db.update(vendors).set({ available, lastSeenAt }).where(eq(vendors.id, current.id)).returning();
    return Response.json({ vendor: privateVendor(updated) });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Online status update nahi hua" }, { status: 500 });
  }
}
