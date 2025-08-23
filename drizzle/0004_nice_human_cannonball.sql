CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(100) NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"category" varchar(50) DEFAULT 'general' NOT NULL,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "system_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;