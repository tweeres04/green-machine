CREATE TABLE `team_subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`stripe_subscription_id` text NOT NULL,
	`subscription_status` text NOT NULL,
	`period_end` integer NOT NULL,
	`cancel_at_period_end` integer NOT NULL,
	`team_id` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `stripe_customer_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `team_subscriptions_stripe_subscription_id_unique` ON `team_subscriptions` (`stripe_subscription_id`);--> statement-breakpoint
CREATE INDEX `team_subscriptions_team_id_idx` ON `team_subscriptions` (`team_id`);