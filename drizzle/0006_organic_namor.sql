CREATE TABLE "review_helpful_votes" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer,
	"user_id" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "review_helpful_votes_review_id_user_id_unique" UNIQUE("review_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_review_id_product_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."product_reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_helpful_votes" ADD CONSTRAINT "review_helpful_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;