ALTER TABLE `vendors` ADD `last_seen_at` text;--> statement-breakpoint
CREATE INDEX `vendors_category_area_idx` ON `vendors` (`category`,`area`,`available`);--> statement-breakpoint
CREATE INDEX `vendors_category_pincode_idx` ON `vendors` (`category`,`pincode`,`available`);--> statement-breakpoint
CREATE INDEX `requests_owner_uid_idx` ON `service_requests` (`owner_uid`,`created_at`);--> statement-breakpoint
CREATE INDEX `requests_category_area_status_idx` ON `service_requests` (`category`,`area`,`status`);--> statement-breakpoint
CREATE INDEX `requests_category_pincode_status_idx` ON `service_requests` (`category`,`pincode`,`status`);