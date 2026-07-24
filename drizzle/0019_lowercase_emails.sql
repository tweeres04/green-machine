UPDATE `users` SET `email` = lower(trim(`email`));--> statement-breakpoint
UPDATE `user_invites` SET `email` = lower(trim(`email`));
