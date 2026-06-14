CREATE TABLE "auth_challenges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"voice_phrase" text,
	"face_action" varchar(50),
	"token" text NOT NULL,
	"issued_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	"completed" boolean DEFAULT false,
	"completed_at" timestamp,
	CONSTRAINT "auth_challenges_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auth_logs" (
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
CREATE TABLE "liveness_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" varchar(50) NOT NULL,
	"passed" boolean NOT NULL,
	"confidence" numeric(3, 2),
	"metrics" jsonb,
	"attempted_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"face_image_path" text NOT NULL,
	"voice_audio_path" text NOT NULL,
	"face_image_cropped_path" text,
	"face_embedding" jsonb,
	"voice_template" jsonb,
	"face_anti_spoof_score" numeric(3, 2),
	"face_liveness_verified" boolean DEFAULT false,
	"voice_liveness_verified" boolean DEFAULT false,
	"last_auth_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
