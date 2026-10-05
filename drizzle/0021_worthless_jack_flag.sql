-- SQLite can't drop NOT NULL in place, so rebuild users with a nullable
-- password (Google sign in accounts don't have one)
CREATE TABLE `users_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`password` text,
	`name` text NOT NULL,
	`stripe_customer_id` text
);--> statement-breakpoint
INSERT INTO `users_new` (`id`, `email`, `password`, `name`, `stripe_customer_id`)
	SELECT `id`, `email`, `password`, `name`, `stripe_customer_id` FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `users_new` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);
