CREATE TABLE `user_invites` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer,
	`email` text NOT NULL,
	`player_id` integer NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text,
	`token` text NOT NULL,
	`inviter_id` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_invites_id_idx` ON `user_invites` (`id`);--> statement-breakpoint
CREATE INDEX `user_invites_user_id_idx` ON `user_invites` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_invites_player_id_idx` ON `user_invites` (`player_id`);--> statement-breakpoint
CREATE INDEX `user_invites_inviter_id_idx` ON `user_invites` (`inviter_id`);