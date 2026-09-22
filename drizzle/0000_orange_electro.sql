CREATE TYPE "public"."hero_class" AS ENUM('frontend_mage', 'backend_warrior', 'devops_paladin', 'qa_rogue', 'designer_bard', 'pm_druid');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'in_progress', 'victory', 'defeat', 'error');--> statement-breakpoint
CREATE TABLE "boss_phases" (
	"id" serial PRIMARY KEY NOT NULL,
	"quest_id" integer NOT NULL,
	"phase_order" integer NOT NULL,
	"name" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"max_hp" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "heroes" (
	"id" serial PRIMARY KEY NOT NULL,
	"nickname" varchar(64) NOT NULL,
	"hero_class" "hero_class" NOT NULL,
	"level" integer DEFAULT 1 NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"gold" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "heroes_nickname_unique" UNIQUE("nickname")
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" varchar(64) NOT NULL,
	"title" varchar(128) NOT NULL,
	"description" text NOT NULL,
	"boss_name" varchar(128) NOT NULL,
	"boss_max_hp" integer DEFAULT 100 NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"reward_xp" integer DEFAULT 100 NOT NULL,
	"reward_gold" integer DEFAULT 10 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "quests_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"hero_id" integer NOT NULL,
	"quest_id" integer NOT NULL,
	"repo_url" varchar(512) NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"damage_dealt" integer DEFAULT 0 NOT NULL,
	"report" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boss_phases" ADD CONSTRAINT "boss_phases_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "public"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;