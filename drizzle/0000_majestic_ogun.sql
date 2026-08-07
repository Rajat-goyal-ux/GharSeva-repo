CREATE TABLE `service_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor_id` integer,
	`vendor_name` text,
	`vendor_phone` text,
	`owner_name` text NOT NULL,
	`owner_phone` text NOT NULL,
	`category` text NOT NULL,
	`address` text NOT NULL,
	`area` text NOT NULL,
	`pincode` text NOT NULL,
	`budget` integer,
	`rate_unit` text DEFAULT 'visit' NOT NULL,
	`scheduled_for` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`owner_latitude` real,
	`owner_longitude` real,
	`vendor_latitude` real,
	`vendor_longitude` real,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `vendors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`phone` text NOT NULL,
	`category` text NOT NULL,
	`work_description` text DEFAULT '' NOT NULL,
	`area` text NOT NULL,
	`pincode` text NOT NULL,
	`experience_years` integer DEFAULT 0 NOT NULL,
	`rate` integer NOT NULL,
	`rate_unit` text DEFAULT 'visit' NOT NULL,
	`negotiable` integer DEFAULT true NOT NULL,
	`available` integer DEFAULT true NOT NULL,
	`verified` integer DEFAULT false NOT NULL,
	`rating` real DEFAULT 5 NOT NULL,
	`completed_jobs` integer DEFAULT 0 NOT NULL,
	`latitude` real,
	`longitude` real,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_phone_unique` ON `vendors` (`phone`);