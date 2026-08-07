import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  appFeedback,
  ownerProfiles,
  reviews,
  serviceRequests,
  vendorResponses,
  vendors,
} from "../db/schema";

type ExportPayload = {
  schemaVersion: number;
  tables: {
    vendors: Array<typeof vendors.$inferInsert>;
    serviceRequests: Array<typeof serviceRequests.$inferInsert>;
    ownerProfiles: Array<typeof ownerProfiles.$inferInsert>;
    vendorResponses: Array<typeof vendorResponses.$inferInsert>;
    reviews: Array<typeof reviews.$inferInsert>;
    appFeedback: Array<typeof appFeedback.$inferInsert>;
  };
};

const exportPath = process.argv[2];
if (!exportPath) throw new Error("Usage: npm run db:import-d1 -- /absolute/path/to/export.json");

const payload = JSON.parse(await readFile(exportPath, "utf8")) as ExportPayload;
if (payload.schemaVersion !== 1 || !payload.tables) throw new Error("Unsupported migration export");

const db = getDb();

async function insertChunks<T>(rows: T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let start = 0; start < rows.length; start += 100) {
    await insert(rows.slice(start, start + 100));
  }
}

await insertChunks(payload.tables.vendors, (rows) => db.insert(vendors).values(rows).onConflictDoNothing());
await insertChunks(payload.tables.serviceRequests, (rows) => db.insert(serviceRequests).values(rows).onConflictDoNothing());
await insertChunks(payload.tables.ownerProfiles, (rows) => db.insert(ownerProfiles).values(rows).onConflictDoNothing());
await insertChunks(payload.tables.vendorResponses, (rows) => db.insert(vendorResponses).values(rows).onConflictDoNothing());
await insertChunks(payload.tables.reviews, (rows) => db.insert(reviews).values(rows).onConflictDoNothing());
await insertChunks(payload.tables.appFeedback, (rows) => db.insert(appFeedback).values(rows).onConflictDoNothing());

for (const tableName of ["vendors", "owner_profiles", "vendor_responses", "reviews", "app_feedback"]) {
  await db.execute(sql.raw(`
    SELECT setval(
      pg_get_serial_sequence('${tableName}', 'id'),
      GREATEST(COALESCE(MAX(id), 0), 1),
      COALESCE(MAX(id), 0) > 0
    ) FROM ${tableName}
  `));
}

console.log(JSON.stringify({
  imported: {
    vendors: payload.tables.vendors.length,
    serviceRequests: payload.tables.serviceRequests.length,
    ownerProfiles: payload.tables.ownerProfiles.length,
    vendorResponses: payload.tables.vendorResponses.length,
    reviews: payload.tables.reviews.length,
    appFeedback: payload.tables.appFeedback.length,
  },
}));
