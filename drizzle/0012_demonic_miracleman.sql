ALTER TABLE `stat_entries` ADD `game_id` integer;--> statement-breakpoint
CREATE INDEX `game_id_idx` ON `stat_entries` (`game_id`);