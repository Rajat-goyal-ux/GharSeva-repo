import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

export const vendors = pgTable("vendors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().unique(),
  firebaseUid: text("firebase_uid").unique(),
  accountEmail: text("account_email"),
  category: text("category").notNull(),
  workDescription: text("work_description").notNull().default(""),
  area: text("area").notNull(),
  pincode: text("pincode").notNull(),
  experienceYears: integer("experience_years").notNull().default(0),
  rate: integer("rate").notNull(),
  rateUnit: text("rate_unit").notNull().default("visit"),
  negotiable: boolean("negotiable").notNull().default(true),
  available: boolean("available").notNull().default(true),
  verified: boolean("verified").notNull().default(false),
  rating: real("rating").notNull().default(5),
  completedJobs: integer("completed_jobs").notNull().default(0),
  latitude: real("latitude"),
  longitude: real("longitude"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "string" }),
  createdAt: createdAt(),
}, (table) => [
  index("vendors_category_area_idx").on(table.category, table.area, table.available),
  index("vendors_category_pincode_idx").on(table.category, table.pincode, table.available),
]);

export const serviceRequests = pgTable("service_requests", {
  id: text("id").primaryKey(),
  vendorId: integer("vendor_id"),
  vendorName: text("vendor_name"),
  vendorPhone: text("vendor_phone"),
  ownerUid: text("owner_uid"),
  ownerEmail: text("owner_email"),
  ownerName: text("owner_name").notNull(),
  ownerPhone: text("owner_phone").notNull(),
  category: text("category").notNull(),
  address: text("address").notNull(),
  area: text("area").notNull(),
  pincode: text("pincode").notNull(),
  budget: integer("budget"),
  rateUnit: text("rate_unit").notNull().default("visit"),
  scheduledFor: text("scheduled_for").notNull(),
  note: text("note").notNull().default(""),
  ownerLatitude: real("owner_latitude"),
  ownerLongitude: real("owner_longitude"),
  vendorLatitude: real("vendor_latitude"),
  vendorLongitude: real("vendor_longitude"),
  status: text("status").notNull().default("open"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  index("requests_owner_uid_idx").on(table.ownerUid, table.createdAt),
  index("requests_category_area_status_idx").on(table.category, table.area, table.status),
  index("requests_category_pincode_status_idx").on(table.category, table.pincode, table.status),
]);

export const ownerProfiles = pgTable("owner_profiles", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  language: text("language").notNull().default("hi"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const vendorResponses = pgTable("vendor_responses", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull(),
  vendorId: integer("vendor_id").notNull(),
  decision: text("decision").notNull().default("active"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
}, (table) => [
  uniqueIndex("vendor_responses_request_vendor_uidx").on(table.requestId, table.vendorId),
  index("vendor_responses_vendor_idx").on(table.vendorId, table.updatedAt),
]);

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  requestId: text("request_id").notNull().unique(),
  ownerUid: text("owner_uid").notNull(),
  vendorId: integer("vendor_id").notNull(),
  rating: integer("rating").notNull(),
  feedback: text("feedback").notNull().default(""),
  createdAt: createdAt(),
}, (table) => [
  index("reviews_vendor_created_idx").on(table.vendorId, table.createdAt),
  index("reviews_owner_created_idx").on(table.ownerUid, table.createdAt),
]);

export const appFeedback = pgTable("app_feedback", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  createdAt: createdAt(),
}, (table) => [
  index("app_feedback_user_created_idx").on(table.firebaseUid, table.createdAt),
]);
