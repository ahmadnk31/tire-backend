CREATE TABLE "product_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer,
	"user_id" integer,
	"order_id" integer,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"comment" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"is_verified_purchase" boolean DEFAULT false,
	"helpful_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "review_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"review_id" integer,
	"image_url" varchar(500) NOT NULL,
	"alt_text" varchar(255),
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_images" ADD CONSTRAINT "review_images_review_id_product_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."product_reviews"("id") ON DELETE cascade ON UPDATE no action;