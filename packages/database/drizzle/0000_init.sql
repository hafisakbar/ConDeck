CREATE TABLE `actions` (
	`id` text PRIMARY KEY NOT NULL,
	`button_id` text NOT NULL,
	`action_type` text NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`button_id`) REFERENCES `buttons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `actions_button_id_idx` ON `actions` (`button_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `actions_button_position_unique` ON `actions` (`button_id`,`position`);--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text,
	`event_type` text NOT NULL,
	`description` text NOT NULL,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `activity_logs_device_id_idx` ON `activity_logs` (`device_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE TABLE `buttons` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`position` integer NOT NULL,
	`label` text NOT NULL,
	`icon` text,
	`image_asset_id` text,
	`background_color` text NOT NULL,
	`text_color` text NOT NULL,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`image_asset_id`) REFERENCES `media_assets`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `buttons_page_id_idx` ON `buttons` (`page_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `buttons_page_position_unique` ON `buttons` (`page_id`,`position`);--> statement-breakpoint
CREATE TABLE `decks` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text NOT NULL,
	`name` text NOT NULL,
	`columns` integer NOT NULL,
	`rows` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`profile_id`) REFERENCES `profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `decks_profile_id_idx` ON `decks` (`profile_id`);--> statement-breakpoint
CREATE TABLE `device_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`session_status` text NOT NULL,
	`connected_at` text NOT NULL,
	`disconnected_at` text,
	`last_activity_at` text NOT NULL,
	FOREIGN KEY (`device_id`) REFERENCES `devices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `device_sessions_device_id_idx` ON `device_sessions` (`device_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`device_name` text NOT NULL,
	`device_type` text NOT NULL,
	`credential_hash` text NOT NULL,
	`last_seen_at` text,
	`is_authorized` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`host` text,
	`port` integer,
	`credential_reference` text,
	`is_enabled` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `integrations_provider_unique` ON `integrations` (`provider`);--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`file_path` text NOT NULL,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`deck_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`deck_id`) REFERENCES `decks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `pages_deck_id_idx` ON `pages` (`deck_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_deck_position_unique` ON `pages` (`deck_id`,`position`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`is_active` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `profiles_is_active_idx` ON `profiles` (`is_active`);