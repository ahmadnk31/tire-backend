-- Create blog_posts table
CREATE TABLE IF NOT EXISTS "blog_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL UNIQUE,
	"excerpt" text,
	"content" text NOT NULL,
	"author" varchar(100) NOT NULL,
	"author_id" integer,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"featured" boolean DEFAULT false,
	"category" varchar(50) NOT NULL,
	"tags" text,
	"image" varchar(500),
	"readTime" varchar(20),
	"views" integer DEFAULT 0,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create blog_comments table
CREATE TABLE IF NOT EXISTS "blog_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer,
	"author_name" varchar(100),
	"author_email" varchar(255),
	"content" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create blog_subscribers table
CREATE TABLE IF NOT EXISTS "blog_subscribers" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL UNIQUE,
	"name" varchar(100),
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp
);

-- Add foreign key constraints
ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_post_id_blog_posts_id_fk" 
FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE;

ALTER TABLE "blog_comments" ADD CONSTRAINT "blog_comments_user_id_users_id_fk" 
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;

ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_author_id_users_id_fk" 
FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL;
