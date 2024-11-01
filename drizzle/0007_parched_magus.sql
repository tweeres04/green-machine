CREATE TABLE `rsvps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`game_id` integer NOT NULL,
	`rsvp` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rsvps_id_idx` ON `rsvps` (`id`);--> statement-breakpoint
CREATE INDEX `rsvps_player_id_idx` ON `rsvps` (`player_id`);--> statement-breakpoint
CREATE INDEX `rsvps_game_id_idx` ON `rsvps` (`game_id`);