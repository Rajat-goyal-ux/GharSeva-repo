ALTER TABLE `service_requests` ADD `owner_uid` text;--> statement-breakpoint
ALTER TABLE `service_requests` ADD `owner_email` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `firebase_uid` text;--> statement-breakpoint
ALTER TABLE `vendors` ADD `account_email` text;--> statement-breakpoint
CREATE UNIQUE INDEX `vendors_firebase_uid_unique` ON `vendors` (`firebase_uid`);