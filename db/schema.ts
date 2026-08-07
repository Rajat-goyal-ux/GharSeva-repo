import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const vendors = sqliteTable("vendors", {
  id: integer("id").primaryKey({ autoIncrement: true }), name: text("name").notNull(), phone: text("phone").notNull().unique(),
  firebaseUid: text("firebase_uid").unique(), accountEmail: text("account_email"),
  category: text("category").notNull(), workDescription: text("work_description").notNull().default(""), area: text("area").notNull(), pincode: text("pincode").notNull(),
  experienceYears: integer("experience_years").notNull().default(0), rate: integer("rate").notNull(), rateUnit: text("rate_unit").notNull().default("visit"),
  negotiable: integer("negotiable", { mode: "boolean" }).notNull().default(true), available: integer("available", { mode: "boolean" }).notNull().default(true),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false), rating: real("rating").notNull().default(5), completedJobs: integer("completed_jobs").notNull().default(0),
  latitude: real("latitude"), longitude: real("longitude"), lastSeenAt: text("last_seen_at"), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("vendors_category_area_idx").on(table.category, table.area, table.available),
  index("vendors_category_pincode_idx").on(table.category, table.pincode, table.available),
]);

export const serviceRequests = sqliteTable("service_requests", {
  id: text("id").primaryKey(), vendorId: integer("vendor_id"), vendorName: text("vendor_name"), vendorPhone: text("vendor_phone"),
  ownerUid: text("owner_uid"), ownerEmail: text("owner_email"), ownerName: text("owner_name").notNull(), ownerPhone: text("owner_phone").notNull(), category: text("category").notNull(),
  address: text("address").notNull(), area: text("area").notNull(), pincode: text("pincode").notNull(), budget: integer("budget"), rateUnit: text("rate_unit").notNull().default("visit"),
  scheduledFor: text("scheduled_for").notNull(), note: text("note").notNull().default(""), ownerLatitude: real("owner_latitude"), ownerLongitude: real("owner_longitude"),
  vendorLatitude: real("vendor_latitude"), vendorLongitude: real("vendor_longitude"), status: text("status").notNull().default("open"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`), updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("requests_owner_uid_idx").on(table.ownerUid, table.createdAt),
  index("requests_category_area_status_idx").on(table.category, table.area, table.status),
  index("requests_category_pincode_status_idx").on(table.category, table.pincode, table.status),
]);

export const ownerProfiles = sqliteTable("owner_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  language: text("language").notNull().default("hi"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const vendorResponses = sqliteTable("vendor_responses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  decision: text("decision").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("vendor_responses_request_vendor_uidx").on(table.requestId, table.vendorId),
  index("vendor_responses_vendor_idx").on(table.vendorId, table.updatedAt),
]);

export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  requestId: text("request_id").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  vendorId: integer("vendor_id").notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("reviews_vendor_created_idx").on(table.vendorId, table.createdAt),
  index("reviews_owner_created_idx").on(table.ownerUid, table.createdAt),
]);

export const appFeedback = sqliteTable("app_feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  firebaseUid: text("firebase_uid").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("app_feedback_user_created_idx").on(table.firebaseUid, table.createdAt),
]);
