-- Newsletter Campaigns table
CREATE TABLE "newsletter_campaigns" (
  "id" SERIAL PRIMARY KEY,
  "title" VARCHAR(255) NOT NULL,
  "subject" VARCHAR(255) NOT NULL,
  "content" TEXT NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
  "type" VARCHAR(50) NOT NULL DEFAULT 'general',
  "scheduled_at" TIMESTAMP,
  "sent_at" TIMESTAMP,
  "recipient_count" INTEGER DEFAULT 0,
  "open_count" INTEGER DEFAULT 0,
  "click_count" INTEGER DEFAULT 0,
  "created_by" INTEGER REFERENCES "users"("id"),
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Newsletter Campaign Products junction table
CREATE TABLE "newsletter_campaign_products" (
  "id" SERIAL PRIMARY KEY,
  "campaign_id" INTEGER REFERENCES "newsletter_campaigns"("id") ON DELETE CASCADE,
  "product_id" INTEGER REFERENCES "products"("id") ON DELETE CASCADE,
  "display_order" INTEGER DEFAULT 0,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX "idx_newsletter_campaigns_status" ON "newsletter_campaigns"("status");
CREATE INDEX "idx_newsletter_campaigns_type" ON "newsletter_campaigns"("type");
CREATE INDEX "idx_newsletter_campaigns_created_by" ON "newsletter_campaigns"("created_by");
CREATE INDEX "idx_newsletter_campaign_products_campaign_id" ON "newsletter_campaign_products"("campaign_id");
CREATE INDEX "idx_newsletter_campaign_products_product_id" ON "newsletter_campaign_products"("product_id");
