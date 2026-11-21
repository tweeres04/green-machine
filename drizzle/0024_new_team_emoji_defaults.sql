-- SQLite can't change a column default in place, so rebuild teams with
-- 🎯 / ⭐ as the defaults for new teams. Existing teams keep what they have
CREATE TABLE `teams_new` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`color` text DEFAULT 'gray' NOT NULL,
	`location` text,
	`next_game_forecast` integer DEFAULT false NOT NULL,
	`latitude` real,
	`longitude` real,
	`country_code` text,
	`owner_id` integer,
	`show_rsvps` integer DEFAULT true NOT NULL,
	`assist_emoji` text DEFAULT '🎯' NOT NULL,
	`mvp_emoji` text DEFAULT '⭐' NOT NULL
);--> statement-breakpoint
INSERT INTO `teams_new` (`id`, `name`, `slug`, `color`, `location`, `next_game_forecast`, `latitude`, `longitude`, `country_code`, `owner_id`, `show_rsvps`, `assist_emoji`, `mvp_emoji`)
	SELECT `id`, `name`, `slug`, `color`, `location`, `next_game_forecast`, `latitude`, `longitude`, `country_code`, `owner_id`, `show_rsvps`, `assist_emoji`, `mvp_emoji` FROM `teams`;--> statement-breakpoint
-- Carry the id counter over. The copy only sets it to the highest current id,
-- and with no foreign keys a reused id from a deleted team would inherit its
-- leftover players and games
UPDATE `sqlite_sequence` SET `seq` = (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'teams')
	WHERE `name` = 'teams_new' AND (SELECT `seq` FROM `sqlite_sequence` WHERE `name` = 'teams') > `seq`;--> statement-breakpoint
DROP TABLE `teams`;--> statement-breakpoint
ALTER TABLE `teams_new` RENAME TO `teams`;--> statement-breakpoint
CREATE UNIQUE INDEX `teams_slug_unique` ON `teams` (`slug`);
