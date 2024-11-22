DROP INDEX IF EXISTS `slug_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);