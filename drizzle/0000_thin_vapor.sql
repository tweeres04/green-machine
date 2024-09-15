CREATE TABLE `players` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`team_id` integer NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stat_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`timestamp` text NOT NULL,
	`type` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_id_idx` ON `players` (`team_id`);--> statement-breakpoint
CREATE INDEX `player_id_idx` ON `stat_entries` (`player_id`);--> statement-breakpoint
CREATE INDEX `slug_idx` ON `teams` (`slug`);