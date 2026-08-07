CREATE TABLE `app_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firebase_uid` text NOT NULL,
	`email` text NOT NULL,
	`message` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `app_feedback_user_created_idx` ON `app_feedback` (`firebase_uid`,`created_at`);--> statement-breakpoint
CREATE TABLE `owner_profiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`firebase_uid` text NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'hi' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `owner_profiles_firebase_uid_unique` ON `owner_profiles` (`firebase_uid`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`owner_uid` text NOT NULL,
	`vendor_id` integer NOT NULL,
	`rating` integer NOT NULL,
	`feedback` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_request_id_unique` ON `reviews` (`request_id`);--> statement-breakpoint
CREATE INDEX `reviews_vendor_created_idx` ON `reviews` (`vendor_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_owner_created_idx` ON `reviews` (`owner_uid`,`created_at`);--> statement-breakpoint
CREATE TABLE `vendor_responses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_id` text NOT NULL,
	`vendor_id` integer NOT NULL,
	`decision` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `vendor_responses_request_vendor_uidx` ON `vendor_responses` (`request_id`,`vendor_id`);--> statement-breakpoint
CREATE INDEX `vendor_responses_vendor_idx` ON `vendor_responses` (`vendor_id`,`updated_at`);