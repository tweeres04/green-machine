DROP INDEX IF EXISTS `email_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);