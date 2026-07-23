ALTER TABLE `teams` ADD `owner_id` integer;--> statement-breakpoint
UPDATE `teams` SET `owner_id` = (SELECT `user_id` FROM `users_teams` WHERE `users_teams`.`team_id` = `teams`.`id` ORDER BY `users_teams`.`id` LIMIT 1);
