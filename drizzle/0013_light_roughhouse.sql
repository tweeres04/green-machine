CREATE TABLE `user_invite_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`team_id` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` text NOT NULL,
	`accepted_at` text
);
--> statement-breakpoint
CREATE INDEX `user_invite_requests_user_id_idx` ON `user_invite_requests` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_invite_requests_team_id_idx` ON `user_invite_requests` (`team_id`);