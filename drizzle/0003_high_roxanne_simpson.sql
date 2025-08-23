ALTER TABLE "products" ADD COLUMN "tread_depth" varchar(10);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "construction" varchar(20);--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_start_date" timestamp;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "sale_end_date" timestamp;