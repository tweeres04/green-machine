CREATE TABLE `weather_forecasts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`game_id` integer,
	`forecast_data` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `teams` ADD `location` text;--> statement-breakpoint
ALTER TABLE `teams` ADD `next_game_forecast` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `weather_forecasts_game_id_idx` ON `weather_forecasts` (`game_id`);--> statement-breakpoint
CREATE INDEX `weather_forecasts_created_at_idx` ON `weather_forecasts` (`game_id`);