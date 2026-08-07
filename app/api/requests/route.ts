import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { reviews, serviceRequests, vendorResponses, vendors } from "../../../db/schema";
import { firebaseAuthResponse, requireFirebaseGoogleUser } from "../../firebase-server";

const ONLINE_WINDOW_MS = 90_000;
const phone10 = (value = "") => value.replace(/\D/g, "").slice(-10);
const newId = () => `GS${Date.now().toString().slice(-8)}${Math.floor(10 + Math.random() * 90)}`;

function isVendorOnline(row: typeof vendors.$inferSelect) {
  if (!row.available || !row.lastSeenAt) return false;
  const seen = Date.parse(row.lastSeenAt);
  return Number.isFinite(seen) && Date.now() - seen <= ONLINE_WINDOW_MS;
}

function dashboardVendor(row: typeof vendors.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    category: row.category,
    workDescription: row.workDescription,
    area: row.area,
    pincode: row.pincode,
    experienceYears: row.experienceYears,
    rate: row.rate,
    rateUnit: row.rateUnit,
    negotiable: row.negotiable,
    available: row.available,
    online: isVendorOnline(row),
    verified: row.verified,
    rating: row.rating,
    completedJobs: row.completedJobs,
  };
}

function vendorLead(row: typeof serviceRequests.$inferSelect, vendorPhone: string, vendorDecision: string | null = null) {
  const privateAccountFields = { ownerUid: null, ownerEmail: null };
  const acceptedByVendor = row.vendorPhone === vendorPhone && !["open", "sent"].includes(row.status);
  if (acceptedByVendor) return { ...row, ...privateAccountFields, vendorDecision };
  return {
    ...row,
    ...privateAccountFields,
    vendorDecision,
    ownerName: "Customer",
    ownerPhone: "",
    address: "पूरा address काम accept करने के बाद दिखेगा",
    ownerLatitude: null,
    ownerLongitude: null,
  };
}

function matchesVendor(job: typeof serviceRequests.$inferSelect, vendor: typeof vendors.$inferSelect) {
  return job.category === vendor.category && (job.pincode === vendor.pincode || job.area.toLowerCase() === vendor.area.toLowerCase());
}

export async function GET(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const q = new URL(request.url).searchParams;
    const id = String(q.get("id") ?? "").trim().toUpperCase();
    const vendorMode = q.get("vendor") === "1";
    const ownerMode = q.get("owner") === "1";
    const db = getDb();

    if (id) {
      const rows = await db.select().from(serviceRequests)
        .where(and(eq(serviceRequests.id, id), eq(serviceRequests.ownerUid, user.uid)))
        .limit(1);
      return Response.json({ requests: rows, refreshedAt: new Date().toISOString() });
    }
    if (ownerMode) {
      const [rows, reviewRows] = await Promise.all([
        db.select().from(serviceRequests).where(eq(serviceRequests.ownerUid, user.uid)).orderBy(desc(serviceRequests.createdAt)).limit(80),
        db.select().from(reviews).where(eq(reviews.ownerUid, user.uid)).orderBy(desc(reviews.createdAt)).limit(100),
      ]);
      const reviewByRequest = new Map(reviewRows.map((review) => [review.requestId, review]));
      return Response.json({
        requests: rows.map((row) => {
          const review = reviewByRequest.get(row.id);
          return { ...row, reviewRating: review?.rating ?? null, reviewFeedback: review?.feedback ?? "" };
        }),
        refreshedAt: new Date().toISOString(),
      });
    }
    if (vendorMode) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.firebaseUid, user.uid)).limit(1);
      if (!vendor) return Response.json({ error: "इस Google account से vendor profile नहीं मिली" }, { status: 404 });

      const assignedCondition = eq(serviceRequests.vendorPhone, vendor.phone);
      const matchingCondition = and(
        isNull(serviceRequests.vendorId),
        eq(serviceRequests.category, vendor.category),
        or(eq(serviceRequests.pincode, vendor.pincode), eq(serviceRequests.area, vendor.area)),
      );
      const [rows, responseRows] = await Promise.all([
        db.select().from(serviceRequests)
          .where(isVendorOnline(vendor) ? or(assignedCondition, matchingCondition) : assignedCondition)
          .orderBy(desc(serviceRequests.createdAt))
          .limit(80),
        db.select().from(vendorResponses).where(eq(vendorResponses.vendorId, vendor.id)).orderBy(desc(vendorResponses.updatedAt)).limit(300),
      ]);
      const decisionByRequest = new Map(responseRows.map((response) => [response.requestId, response.decision]));
      return Response.json({
        vendor: dashboardVendor(vendor),
        requests: rows.map((row) => vendorLead(row, vendor.phone, decisionByRequest.get(row.id) ?? "active")),
        refreshedAt: new Date().toISOString(),
      });
    }
    return Response.json({ error: "Request ID या vendor mode जरूरी है" }, { status: 400 });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Requests load nahi hui" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const ownerName = String(p.ownerName ?? "").trim();
    const ownerPhone = phone10(String(p.ownerPhone ?? ""));
    const category = String(p.category ?? "").trim();
    const address = String(p.address ?? "").trim();
    const area = String(p.area ?? "").trim();
    const pincode = String(p.pincode ?? "").replace(/\D/g, "").slice(0, 6);
    const scheduledFor = String(p.scheduledFor ?? "").trim();
    if (!ownerName || ownerPhone.length !== 10 || !category || !address || !area || pincode.length !== 6 || !scheduledFor) {
      return Response.json({ error: "Naam, contact mobile, service, address, area, pincode aur time zaroori hain" }, { status: 400 });
    }

    const db = getDb();
    const requestedVendorId = p.vendorId == null ? null : Number(p.vendorId);
    let vendorId: number | null = null;
    let vendorName: string | null = null;
    let vendorPhone: string | null = null;
    let notifiedCount = 0;
    if (requestedVendorId) {
      const [vendor] = await db.select().from(vendors).where(eq(vendors.id, requestedVendorId)).limit(1);
      if (!vendor || !isVendorOnline(vendor)) {
        return Response.json({ error: "यह vendor अभी offline है. दूसरा online vendor चुनें या open request भेजें." }, { status: 409 });
      }
      if (vendor.category !== category) {
        return Response.json({ error: "चुना हुआ vendor " + vendor.category + " में registered है. सही category चुनें." }, { status: 409 });
      }
      vendorId = vendor.id;
      vendorName = vendor.name;
      vendorPhone = vendor.phone;
      notifiedCount = 1;
    } else {
      const candidates = await db.select().from(vendors).where(and(
        eq(vendors.category, category),
        eq(vendors.available, true),
        or(eq(vendors.pincode, pincode), eq(vendors.area, area)),
      )).limit(100);
      notifiedCount = candidates.filter(isVendorOnline).length;
    }

    const [created] = await db.insert(serviceRequests).values({
      id: newId(),
      vendorId,
      vendorName,
      vendorPhone,
      ownerUid: user.uid,
      ownerEmail: user.email,
      ownerName,
      ownerPhone,
      category,
      address,
      area,
      pincode,
      budget: p.budget ? Math.max(0, Number(p.budget)) : null,
      rateUnit: String(p.rateUnit ?? "visit"),
      scheduledFor,
      note: String(p.note ?? "").trim(),
      ownerLatitude: p.ownerLatitude == null ? null : Number(p.ownerLatitude),
      ownerLongitude: p.ownerLongitude == null ? null : Number(p.ownerLongitude),
      status: vendorPhone ? "sent" : "open",
    }).returning();
    return Response.json({ request: created, notifiedCount }, { status: 201 });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Request create nahi hui" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireFirebaseGoogleUser(request);
    const p = (await request.json()) as Record<string, unknown>;
    const id = String(p.id ?? "").trim().toUpperCase();
    const action = String(p.action ?? "");
    if (!id) return Response.json({ error: "Request ID जरूरी है" }, { status: 400 });

    const db = getDb();
    const [vendor] = await db.select().from(vendors).where(eq(vendors.firebaseUid, user.uid)).limit(1);
    const [job] = await db.select().from(serviceRequests).where(eq(serviceRequests.id, id)).limit(1);
    if (!vendor || !job) return Response.json({ error: "Vendor या request नहीं मिली" }, { status: 404 });

    if (action === "reject" || action === "reaccept") {
      if (!["open", "sent"].includes(job.status)) return Response.json({ error: "यह request अब available नहीं है" }, { status: 409 });
      if (job.vendorPhone && job.vendorPhone !== vendor.phone) return Response.json({ error: "यह request दूसरे vendor के लिए है" }, { status: 403 });
      if (!job.vendorPhone && !matchesVendor(job, vendor)) return Response.json({ error: "यह काम आपकी category या area से match नहीं करता" }, { status: 403 });
      const decision = action === "reject" ? "rejected" : "active";
      const now = new Date().toISOString();
      await db.insert(vendorResponses).values({ requestId: id, vendorId: vendor.id, decision, updatedAt: now })
        .onConflictDoUpdate({
          target: [vendorResponses.requestId, vendorResponses.vendorId],
          set: { decision, updatedAt: now },
        });

      let updated = job;
      if (action === "reject" && job.vendorPhone === vendor.phone) {
        const [released] = await db.update(serviceRequests).set({
          vendorId: null,
          vendorName: null,
          vendorPhone: null,
          status: "open",
          updatedAt: now,
        }).where(eq(serviceRequests.id, id)).returning();
        updated = released;
      }
      return Response.json({ request: vendorLead(updated, vendor.phone, decision) });
    }

    if (action === "accept") {
      if (!isVendorOnline(vendor)) return Response.json({ error: "काम accept करने के लिए पहले Online हों" }, { status: 409 });
      if (!["open", "sent"].includes(job.status)) return Response.json({ error: "यह request अब available नहीं है" }, { status: 409 });
      if (job.vendorPhone && job.vendorPhone !== vendor.phone) return Response.json({ error: "Request किसी और vendor ने accept कर ली" }, { status: 409 });
      if (!job.vendorPhone && !matchesVendor(job, vendor)) return Response.json({ error: "यह काम आपकी category या area से match नहीं करता" }, { status: 403 });
      const [updated] = await db.update(serviceRequests).set({
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorPhone: vendor.phone,
        status: "accepted",
        updatedAt: new Date().toISOString(),
      }).where(and(
        eq(serviceRequests.id, id),
        or(isNull(serviceRequests.vendorPhone), eq(serviceRequests.vendorPhone, vendor.phone)),
      )).returning();
      if (!updated) return Response.json({ error: "Request किसी और vendor ने accept कर ली" }, { status: 409 });
      const now = new Date().toISOString();
      await db.insert(vendorResponses).values({ requestId: id, vendorId: vendor.id, decision: "accepted", updatedAt: now })
        .onConflictDoUpdate({
          target: [vendorResponses.requestId, vendorResponses.vendorId],
          set: { decision: "accepted", updatedAt: now },
        });
      return Response.json({ request: vendorLead(updated, vendor.phone, "accepted") });
    }

    if (job.vendorPhone !== vendor.phone) return Response.json({ error: "सिर्फ assigned vendor update कर सकता है" }, { status: 403 });
    if (action === "location") {
      if (!["accepted", "on_the_way"].includes(job.status)) return Response.json({ error: "इस status में location share नहीं हो सकती" }, { status: 409 });
      const latitude = Number(p.latitude);
      const longitude = Number(p.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
        return Response.json({ error: "Valid location नहीं मिली" }, { status: 400 });
      }
      const [updated] = await db.update(serviceRequests).set({ vendorLatitude: latitude, vendorLongitude: longitude, updatedAt: new Date().toISOString() }).where(eq(serviceRequests.id, id)).returning();
      return Response.json({ request: vendorLead(updated, vendor.phone) });
    }

    const nextStatus: Record<string, string[]> = {
      accepted: ["on_the_way", "cancelled"],
      on_the_way: ["arrived", "cancelled"],
      arrived: ["completed", "cancelled"],
    };
    if (!nextStatus[job.status]?.includes(action)) return Response.json({ error: "Invalid status change" }, { status: 400 });
    const [updated] = await db.update(serviceRequests).set({ status: action, updatedAt: new Date().toISOString() }).where(eq(serviceRequests.id, id)).returning();
    if (action === "completed") {
      await db.update(vendors).set({ completedJobs: sql`${vendors.completedJobs} + 1` }).where(eq(vendors.id, vendor.id));
    }
    return Response.json({ request: vendorLead(updated, vendor.phone) });
  } catch (error) {
    const auth = firebaseAuthResponse(error);
    if (auth) return auth;
    return Response.json({ error: error instanceof Error ? error.message : "Update nahi hua" }, { status: 500 });
  }
}
