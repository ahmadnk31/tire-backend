CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone" varchar(20),
	"subject" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"inquiry_type" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"admin_response" text,
	"client_ip" varchar(45),
	"user_agent" text,
	"user_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"source" varchar(50) DEFAULT 'website',
	"tags" jsonb,
	"metadata" jsonb,
	"subscribed_at" timestamp DEFAULT now(),
	"unsubscribed_at" timestamp,
	"last_email_sent" timestamp,
	CONSTRAINT "newsletter_subscriptions_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;