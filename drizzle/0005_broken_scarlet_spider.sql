CREATE TABLE `users_teams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`team_id` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `users_teams_user_id_idx` ON `users_teams` (`user_id`);--> statement-breakpoint
CREATE INDEX `users_teams_team_id_idx` ON `users_teams` (`team_id`);