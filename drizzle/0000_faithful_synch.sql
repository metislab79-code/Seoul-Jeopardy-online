CREATE TABLE `answers` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`qid` integer NOT NULL,
	`player` text NOT NULL,
	`answer` text NOT NULL,
	`points` integer NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `one_answer` ON `answers` (`room`,`qid`,`player`);--> statement-breakpoint
CREATE INDEX `answers_player` ON `answers` (`player`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`token` text NOT NULL,
	`name` text NOT NULL,
	`team` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_name` ON `players` (`room`,`team`,`name`);--> statement-breakpoint
CREATE INDEX `players_room` ON `players` (`room`);--> statement-breakpoint
CREATE TABLE `rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`host` text NOT NULL,
	`teams` integer NOT NULL,
	`seconds` integer NOT NULL,
	`phase` text DEFAULT 'lobby' NOT NULL,
	`current` integer,
	`deadline` integer,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rounds` (
	`id` text PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`qid` integer NOT NULL,
	`revealed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `round_question` ON `rounds` (`room`,`qid`);