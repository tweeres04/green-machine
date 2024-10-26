CREATE TABLE `games` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`opponent` text NOT NULL,
	`timestamp` text,
	`location` text
);
--> statement-breakpoint
DROP INDEX IF EXISTS `team_id_idx`;--> statement-breakpoint
CREATE INDEX `games_team_id_idx` ON `games` (`team_id`);--> statement-breakpoint
CREATE INDEX `players_team_id_idx` ON `players` (`team_id`);