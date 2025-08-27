import { pgTable, serial, varchar, text, decimal, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { is, relations } from 'drizzle-orm';
// Users table for authentication
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  password: varchar('password', { length: 255 }).notNull(),
  role: varchar('role', { length: 20 }).notNull().default('user'), // 'user' or 'admin' 
  emailVerified: boolean('email_verified').default(false),
  verificationToken: varchar('verification_token', { length: 255 }),
  resetToken: varchar('reset_token', { length: 255 }),
  isActive: boolean('is_active').default(true),
  phone : varchar('phone', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wishlist = pgTable('wishlist', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});




// Products table
export const products = pgTable('products', {
  seoTitle: varchar('seo_title', { length: 255 }),
  seoDescription: text('seo_description'),
  id: serial('id').primaryKey(),

  name: varchar('name', { length: 255 }).notNull(),
  brand: varchar('brand', { length: 100 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  size: varchar('size', { length: 50 }).notNull(),
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  comparePrice: decimal('compare_price', { precision: 10, scale: 2 }),
  rating: decimal('rating', { precision: 3, scale: 2 }).default('0'),
  stock: integer('stock').notNull().default(0),

  lowStockThreshold: integer('low_stock_threshold').default(10),

  status: varchar('status', { length: 20 }).notNull().default('draft'), // draft, published, hidden
  featured: boolean('featured').default(false),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 255 }).unique(),
  description: text('description'),
  
  // Additional tire-specific fields that exist in your database
  
  loadIndex: varchar('load_index', { length: 10 }),
  speedRating: varchar('speed_rating', { length: 5 }),
  seasonType: varchar('season_type', { length: 20 }),
  tireType: varchar('tire_type', { length: 30 }),
  treadDepth: varchar('tread_depth', { length: 10 }),
  construction: varchar('construction', { length: 20 }),
  tireSoundVolume: varchar('tire_sound_volume', { length: 50 }), // e.g., "Low", "Medium", "High"
  
  // Sale fields
  saleStartDate: timestamp('sale_start_date'),
  saleEndDate: timestamp('sale_end_date'),
  
  features: jsonb('features'), // Array of feature strings
  specifications: jsonb('specifications'), // JSON object with specs
  tags: jsonb('tags'), // Array of tag strings
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Images table (for better organization)
export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  altText: varchar('alt_text', { length: 255 }),
  isPrimary: boolean('is_primary').default(false),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});


  
// User Addresses table
export const userAddresses = pgTable('user_addresses', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 20 }).notNull(), // billing, shipping
  street: varchar('street', { length: 255 }).notNull(),
  city: varchar('city', { length: 100 }).notNull(),
  state: varchar('state', { length: 100 }).notNull(),
  zipCode: varchar('zip_code', { length: 20 }).notNull(),
  country: varchar('country', { length: 100 }).notNull().default('USA'),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow(),
});

// Orders table
export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  orderNumber: varchar('order_number', { length: 50 }).notNull().unique(),
  userId: integer('user_id').references(() => users.id),
  userEmail: varchar('user_email', { length: 255 }).notNull(),
  userName: varchar('user_name', { length: 255 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, shipped, completed, cancelled
  paymentStatus: varchar('payment_status', { length: 20 }).notNull().default('pending'), // pending, paid, failed, refunded
  subtotal: decimal('subtotal', { precision: 10, scale: 2 }).notNull(),
  tax: decimal('tax', { precision: 10, scale: 2 }).notNull().default('0'),
  shipping: decimal('shipping', { precision: 10, scale: 2 }).notNull().default('0'),
  total: decimal('total', { precision: 10, scale: 2 }).notNull(),
  shippingAddress: jsonb('shipping_address'), // JSON object with address details
  billingAddress: jsonb('billing_address'), // JSON object with address details
  trackingNumber: varchar('tracking_number', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Order Items table
export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id),
  productName: varchar('product_name', { length: 255 }).notNull(),
  productSize: varchar('product_size', { length: 50 }).notNull(),
  productSku: varchar('product_sku', { length: 100 }).notNull(),
  quantity: integer('quantity').notNull(),
  unitPrice: decimal('unit_price', { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal('total_price', { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Shopping Cart table
export const cartItems = pgTable('cart_items', {
  id: serial('id').primaryKey(),
  sessionId: varchar('session_id', { length: 255 }).notNull(), // For guest users
  userId: integer('user_id').references(() => users.id), // For logged-in users
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  quantity: integer('quantity').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
export const banners = pgTable('banners', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 20 }).notNull(), // 'image' or 'video'
  src: varchar('src', { length: 500 }).notNull(),
  headline: varchar('headline', { length: 255 }),
  subheadline: varchar('subheadline', { length: 255 }),
  description: text('description'),
  sortOrder: integer('sort_order').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// Contact Messages table
export const contactMessages = pgTable('contact_messages', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  subject: varchar('subject', { length: 200 }).notNull(),
  message: text('message').notNull(),
  inquiryType: varchar('inquiry_type', { length: 20 }).notNull(), // 'general', 'quote', 'appointment', 'warranty', 'complaint', 'support'
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'in-progress', 'resolved', 'closed'
  adminResponse: text('admin_response'),
  clientIP: varchar('client_ip', { length: 45 }),
  userAgent: text('user_agent'),
  userId: integer('user_id').references(() => users.id), // Optional - if user is logged in
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Newsletter Subscriptions table
export const newsletterSubscriptions = pgTable('newsletter_subscriptions', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  status: varchar('status', { length: 20 }).notNull().default('active'), // 'active', 'unsubscribed', 'bounced'
  source: varchar('source', { length: 50 }).default('website'), // 'website', 'import', 'api'
  tags: jsonb('tags'), // Array of tags for segmentation
  metadata: jsonb('metadata'), // Additional data like preferences
  subscribedAt: timestamp('subscribed_at').defaultNow(),
  unsubscribedAt: timestamp('unsubscribed_at'),
  lastEmailSent: timestamp('last_email_sent'),
});

// Newsletter Campaigns table
export const newsletterCampaigns = pgTable('newsletter_campaigns', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 255 }).notNull(),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('draft'), // 'draft', 'scheduled', 'sent', 'cancelled'
  type: varchar('type', { length: 50 }).notNull().default('general'), // 'general', 'product_catalog', 'promotional'
  scheduledAt: timestamp('scheduled_at'),
  sentAt: timestamp('sent_at'),
  recipientCount: integer('recipient_count').default(0),
  openCount: integer('open_count').default(0),
  clickCount: integer('click_count').default(0),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Product Reviews table
export const productReviews = pgTable('product_reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  orderId: integer('order_id').references(() => orders.id), // Optional - link to specific order
  rating: integer('rating').notNull(), // 1-5 stars
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // 'pending', 'approved', 'rejected'
  isVerifiedPurchase: boolean('is_verified_purchase').default(false),
  helpfulCount: integer('helpful_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Review Images table
export const reviewImages = pgTable('review_images', {
  id: serial('id').primaryKey(),
  reviewId: integer('review_id').references(() => productReviews.id, { onDelete: 'cascade' }),
  imageUrl: varchar('image_url', { length: 500 }).notNull(),
  altText: varchar('alt_text', { length: 255 }),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

// Review Helpful Votes table
export const reviewHelpfulVotes = pgTable('review_helpful_votes', {
  id: serial('id').primaryKey(),
  reviewId: integer('review_id').references(() => productReviews.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
});
 
// Newsletter Campaign Products junction table
export const newsletterCampaignProducts = pgTable('newsletter_campaign_products', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id').references(() => newsletterCampaigns.id, { onDelete: 'cascade' }),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});
// Categories table
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  icon: varchar('icon', { length: 255 }), // Icon name or image URL
  image: varchar('image', { length: 500 }), // Image URL for category
  isActive: boolean('is_active').default(true),
  sortOrder: integer('sort_order').default(0),
  parentId: integer('parent_id'), // For category hierarchy (nullable, no reference constraint)
  createdAt: timestamp('created_at').defaultNow(),
});

// Product Categories relationship table
export const productCategories = pgTable('product_categories', {
  id: serial('id').primaryKey(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'cascade' }),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'cascade' }),
});



// Define relationships
export const productsRelations = relations(products, ({ many }) => ({
  images: many(productImages),
  orderItems: many(orderItems),
  cartItems: many(cartItems),
  categories: many(productCategories),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(userAddresses),
  orders: many(orders),
  cartItems: many(cartItems),
}));

export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
  user: one(users, {
    fields: [userAddresses.userId],
    references: [users.id],
  }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  items: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  user: one(users, {
    fields: [cartItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [cartItems.productId],
    references: [products.id],
  }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(productCategories),
}));

export const productCategoriesRelations = relations(productCategories, ({ one }) => ({
  product: one(products, {
    fields: [productCategories.productId],
    references: [products.id],
  }),
  category: one(categories, {
    fields: [productCategories.categoryId],
    references: [categories.id],
  }),
}));

// System Settings table
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  category: varchar('category', { length: 50 }).notNull().default('general'),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const newsletterCampaignsRelations = relations(newsletterCampaigns, ({ one, many }) => ({
  createdBy: one(users, {
    fields: [newsletterCampaigns.createdBy],
    references: [users.id],
  }),
  products: many(newsletterCampaignProducts),
}));

export const newsletterCampaignProductsRelations = relations(newsletterCampaignProducts, ({ one }) => ({
  campaign: one(newsletterCampaigns, {
    fields: [newsletterCampaignProducts.campaignId],
    references: [newsletterCampaigns.id],
  }),
  product: one(products, {
    fields: [newsletterCampaignProducts.productId],
    references: [products.id],
  }),
}));

export const wishlistRelations = relations(wishlist, ({ one }) => ({
  user: one(users, {
    fields: [wishlist.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [wishlist.productId],
    references: [products.id],
  }),
}));

export const contactMessagesRelations = relations(contactMessages, ({ one }) => ({
  user: one(users, {
    fields: [contactMessages.userId],
    references: [users.id],
  }),
}));

export const productReviewsRelations = relations(productReviews, ({ one, many }) => ({
  product: one(products, {
    fields: [productReviews.productId],
    references: [products.id],
  }),
  user: one(users, {
    fields: [productReviews.userId],
    references: [users.id],
  }),
  order: one(orders, {
    fields: [productReviews.orderId],
    references: [orders.id],
  }),
  images: many(reviewImages),
}));

export const reviewImagesRelations = relations(reviewImages, ({ one }) => ({
  review: one(productReviews, {
    fields: [reviewImages.reviewId],
    references: [productReviews.id],
  }),
}));

// Blog tables
export const blogPosts = pgTable('blog_posts', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  excerpt: text('excerpt'),
  content: text('content').notNull(),
  author: varchar('author', { length: 100 }).notNull(),
  authorId: integer('author_id').references(() => users.id),
  status: varchar('status', { length: 20 }).default('draft').notNull(), // draft, published, archived
  featured: boolean('featured').default(false),
  category: varchar('category', { length: 50 }).notNull(),
  tags: text('tags'), // JSON array of tags
  image: varchar('image', { length: 500 }),
  readTime: varchar('readTime', { length: 20 }),
  views: integer('views').default(0),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const blogComments = pgTable('blog_comments', {
  id: serial('id').primaryKey(),
  postId: integer('post_id').references(() => blogPosts.id, { onDelete: 'cascade' }).notNull(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  authorName: varchar('author_name', { length: 100 }),
  authorEmail: varchar('author_email', { length: 255 }),
  content: text('content').notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending, approved, spam
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const blogSubscribers = pgTable('blog_subscribers', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  name: varchar('name', { length: 100 }),
  status: varchar('status', { length: 20 }).default('active').notNull(), // active, unsubscribed
  subscribedAt: timestamp('subscribed_at').defaultNow().notNull(),
  unsubscribedAt: timestamp('unsubscribed_at'),
});
