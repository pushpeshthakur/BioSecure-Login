CREATE TABLE IF NOT EXISTS "auth_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"voice_phrase" text,
	"face_action" varchar(50),
	"token" text NOT NULL UNIQUE,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "liveness_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"passed" boolean NOT NULL,
	"confidence" numeric(3, 2),
	"metrics" jsonb,
	"attempted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "auth_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"success" boolean NOT NULL,
	"failure_reason" text,
	"face_confidence" numeric(3, 2),
	"voice_confidence" numeric(3, 2),
	"ip_address" varchar(45),
	"attempted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_image_cropped_path" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_embedding" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voice_template" jsonb;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_anti_spoof_score" numeric(3, 2);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "face_liveness_verified" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "voice_liveness_verified" boolean DEFAULT false;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_auth_at" timestamp;
