CREATE TABLE "app_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"firebase_uid" text NOT NULL,
	"email" text NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'hi' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "owner_profiles_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"owner_uid" text NOT NULL,
	"vendor_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"feedback" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_request_id_unique" UNIQUE("request_id")
);
--> statement-breakpoint
CREATE TABLE "service_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"vendor_id" integer,
	"vendor_name" text,
	"vendor_phone" text,
	"owner_uid" text,
	"owner_email" text,
	"owner_name" text NOT NULL,
	"owner_phone" text NOT NULL,
	"category" text NOT NULL,
	"address" text NOT NULL,
	"area" text NOT NULL,
	"pincode" text NOT NULL,
	"budget" integer,
	"rate_unit" text DEFAULT 'visit' NOT NULL,
	"scheduled_for" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"owner_latitude" real,
	"owner_longitude" real,
	"vendor_latitude" real,
	"vendor_longitude" real,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"request_id" text NOT NULL,
	"vendor_id" integer NOT NULL,
	"decision" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"firebase_uid" text,
	"account_email" text,
	"category" text NOT NULL,
	"work_description" text DEFAULT '' NOT NULL,
	"area" text NOT NULL,
	"pincode" text NOT NULL,
	"experience_years" integer DEFAULT 0 NOT NULL,
	"rate" integer NOT NULL,
	"rate_unit" text DEFAULT 'visit' NOT NULL,
	"negotiable" boolean DEFAULT true NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"rating" real DEFAULT 5 NOT NULL,
	"completed_jobs" integer DEFAULT 0 NOT NULL,
	"latitude" real,
	"longitude" real,
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_phone_unique" UNIQUE("phone"),
	CONSTRAINT "vendors_firebase_uid_unique" UNIQUE("firebase_uid")
);
--> statement-breakpoint
CREATE INDEX "app_feedback_user_created_idx" ON "app_feedback" USING btree ("firebase_uid","created_at");--> statement-breakpoint
CREATE INDEX "reviews_vendor_created_idx" ON "reviews" USING btree ("vendor_id","created_at");--> statement-breakpoint
CREATE INDEX "reviews_owner_created_idx" ON "reviews" USING btree ("owner_uid","created_at");--> statement-breakpoint
CREATE INDEX "requests_owner_uid_idx" ON "service_requests" USING btree ("owner_uid","created_at");--> statement-breakpoint
CREATE INDEX "requests_category_area_status_idx" ON "service_requests" USING btree ("category","area","status");--> statement-breakpoint
CREATE INDEX "requests_category_pincode_status_idx" ON "service_requests" USING btree ("category","pincode","status");--> statement-breakpoint
CREATE UNIQUE INDEX "vendor_responses_request_vendor_uidx" ON "vendor_responses" USING btree ("request_id","vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_responses_vendor_idx" ON "vendor_responses" USING btree ("vendor_id","updated_at");--> statement-breakpoint
CREATE INDEX "vendors_category_area_idx" ON "vendors" USING btree ("category","area","available");--> statement-breakpoint
CREATE INDEX "vendors_category_pincode_idx" ON "vendors" USING btree ("category","pincode","available");