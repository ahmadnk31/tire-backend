"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.blogSubscribers = exports.blogComments = exports.blogPosts = exports.reviewImagesRelations = exports.productReviewsRelations = exports.contactMessagesRelations = exports.wishlistRelations = exports.newsletterCampaignProductsRelations = exports.newsletterCampaignsRelations = exports.systemSettings = exports.productCategoriesRelations = exports.categoriesRelations = exports.cartItemsRelations = exports.orderItemsRelations = exports.ordersRelations = exports.userAddressesRelations = exports.usersRelations = exports.productImagesRelations = exports.productsRelations = exports.productCategories = exports.categories = exports.newsletterCampaignProducts = exports.reviewHelpfulVotes = exports.reviewImages = exports.productReviews = exports.newsletterCampaigns = exports.newsletterSubscriptions = exports.contactMessages = exports.banners = exports.cartItems = exports.orderItems = exports.orders = exports.userAddresses = exports.productImages = exports.products = exports.wishlist = exports.users = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
const drizzle_orm_1 = require("drizzle-orm");
exports.users = (0, pg_core_1.pgTable)('users', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    password: (0, pg_core_1.varchar)('password', { length: 255 }).notNull(),
    role: (0, pg_core_1.varchar)('role', { length: 20 }).notNull().default('user'),
    emailVerified: (0, pg_core_1.boolean)('email_verified').default(false),
    verificationToken: (0, pg_core_1.varchar)('verification_token', { length: 255 }),
    resetToken: (0, pg_core_1.varchar)('reset_token', { length: 255 }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.wishlist = (0, pg_core_1.pgTable)('wishlist', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.products = (0, pg_core_1.pgTable)('products', {
    seoTitle: (0, pg_core_1.varchar)('seo_title', { length: 255 }),
    seoDescription: (0, pg_core_1.text)('seo_description'),
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 255 }).notNull(),
    brand: (0, pg_core_1.varchar)('brand', { length: 100 }).notNull(),
    model: (0, pg_core_1.varchar)('model', { length: 100 }).notNull(),
    size: (0, pg_core_1.varchar)('size', { length: 50 }).notNull(),
    price: (0, pg_core_1.decimal)('price', { precision: 10, scale: 2 }).notNull(),
    comparePrice: (0, pg_core_1.decimal)('compare_price', { precision: 10, scale: 2 }),
    rating: (0, pg_core_1.decimal)('rating', { precision: 3, scale: 2 }).default('0'),
    stock: (0, pg_core_1.integer)('stock').notNull().default(0),
    lowStockThreshold: (0, pg_core_1.integer)('low_stock_threshold').default(10),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('draft'),
    featured: (0, pg_core_1.boolean)('featured').default(false),
    sku: (0, pg_core_1.varchar)('sku', { length: 100 }).notNull().unique(),
    slug: (0, pg_core_1.varchar)('slug', { length: 255 }).unique(),
    description: (0, pg_core_1.text)('description'),
    loadIndex: (0, pg_core_1.varchar)('load_index', { length: 10 }),
    speedRating: (0, pg_core_1.varchar)('speed_rating', { length: 5 }),
    seasonType: (0, pg_core_1.varchar)('season_type', { length: 20 }),
    tireType: (0, pg_core_1.varchar)('tire_type', { length: 30 }),
    treadDepth: (0, pg_core_1.varchar)('tread_depth', { length: 10 }),
    construction: (0, pg_core_1.varchar)('construction', { length: 20 }),
    tireSoundVolume: (0, pg_core_1.varchar)('tire_sound_volume', { length: 50 }),
    saleStartDate: (0, pg_core_1.timestamp)('sale_start_date'),
    saleEndDate: (0, pg_core_1.timestamp)('sale_end_date'),
    features: (0, pg_core_1.jsonb)('features'),
    specifications: (0, pg_core_1.jsonb)('specifications'),
    tags: (0, pg_core_1.jsonb)('tags'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.productImages = (0, pg_core_1.pgTable)('product_images', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 500 }).notNull(),
    altText: (0, pg_core_1.varchar)('alt_text', { length: 255 }),
    isPrimary: (0, pg_core_1.boolean)('is_primary').default(false),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.userAddresses = (0, pg_core_1.pgTable)('user_addresses', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    type: (0, pg_core_1.varchar)('type', { length: 20 }).notNull(),
    street: (0, pg_core_1.varchar)('street', { length: 255 }).notNull(),
    city: (0, pg_core_1.varchar)('city', { length: 100 }).notNull(),
    state: (0, pg_core_1.varchar)('state', { length: 100 }).notNull(),
    zipCode: (0, pg_core_1.varchar)('zip_code', { length: 20 }).notNull(),
    country: (0, pg_core_1.varchar)('country', { length: 100 }).notNull().default('USA'),
    isDefault: (0, pg_core_1.boolean)('is_default').default(false),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.orders = (0, pg_core_1.pgTable)('orders', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderNumber: (0, pg_core_1.varchar)('order_number', { length: 50 }).notNull().unique(),
    paymentIntentId: (0, pg_core_1.varchar)('payment_intent_id', { length: 255 }),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id),
    userEmail: (0, pg_core_1.varchar)('user_email', { length: 255 }).notNull(),
    userName: (0, pg_core_1.varchar)('user_name', { length: 255 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    paymentStatus: (0, pg_core_1.varchar)('payment_status', { length: 20 }).notNull().default('pending'),
    subtotal: (0, pg_core_1.decimal)('subtotal', { precision: 10, scale: 2 }).notNull(),
    tax: (0, pg_core_1.decimal)('tax', { precision: 10, scale: 2 }).notNull().default('0'),
    shipping: (0, pg_core_1.decimal)('shipping', { precision: 10, scale: 2 }).notNull().default('0'),
    total: (0, pg_core_1.decimal)('total', { precision: 10, scale: 2 }).notNull(),
    shippingAddress: (0, pg_core_1.jsonb)('shipping_address'),
    billingAddress: (0, pg_core_1.jsonb)('billing_address'),
    trackingNumber: (0, pg_core_1.varchar)('tracking_number', { length: 100 }),
    notes: (0, pg_core_1.text)('notes'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.orderItems = (0, pg_core_1.pgTable)('order_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    orderId: (0, pg_core_1.integer)('order_id').references(() => exports.orders.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id),
    productName: (0, pg_core_1.varchar)('product_name', { length: 255 }).notNull(),
    productSize: (0, pg_core_1.varchar)('product_size', { length: 50 }).notNull(),
    productSku: (0, pg_core_1.varchar)('product_sku', { length: 100 }).notNull(),
    quantity: (0, pg_core_1.integer)('quantity').notNull(),
    unitPrice: (0, pg_core_1.decimal)('unit_price', { precision: 10, scale: 2 }).notNull(),
    totalPrice: (0, pg_core_1.decimal)('total_price', { precision: 10, scale: 2 }).notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.cartItems = (0, pg_core_1.pgTable)('cart_items', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    sessionId: (0, pg_core_1.varchar)('session_id', { length: 255 }).notNull(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    quantity: (0, pg_core_1.integer)('quantity').notNull().default(1),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.banners = (0, pg_core_1.pgTable)('banners', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    type: (0, pg_core_1.varchar)('type', { length: 20 }).notNull(),
    src: (0, pg_core_1.varchar)('src', { length: 500 }).notNull(),
    headline: (0, pg_core_1.varchar)('headline', { length: 255 }),
    subheadline: (0, pg_core_1.varchar)('subheadline', { length: 255 }),
    description: (0, pg_core_1.text)('description'),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.contactMessages = (0, pg_core_1.pgTable)('contact_messages', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull(),
    phone: (0, pg_core_1.varchar)('phone', { length: 20 }),
    subject: (0, pg_core_1.varchar)('subject', { length: 200 }).notNull(),
    message: (0, pg_core_1.text)('message').notNull(),
    inquiryType: (0, pg_core_1.varchar)('inquiry_type', { length: 20 }).notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    adminResponse: (0, pg_core_1.text)('admin_response'),
    clientIP: (0, pg_core_1.varchar)('client_ip', { length: 45 }),
    userAgent: (0, pg_core_1.text)('user_agent'),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.newsletterSubscriptions = (0, pg_core_1.pgTable)('newsletter_subscriptions', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('active'),
    source: (0, pg_core_1.varchar)('source', { length: 50 }).default('website'),
    tags: (0, pg_core_1.jsonb)('tags'),
    metadata: (0, pg_core_1.jsonb)('metadata'),
    subscribedAt: (0, pg_core_1.timestamp)('subscribed_at').defaultNow(),
    unsubscribedAt: (0, pg_core_1.timestamp)('unsubscribed_at'),
    lastEmailSent: (0, pg_core_1.timestamp)('last_email_sent'),
});
exports.newsletterCampaigns = (0, pg_core_1.pgTable)('newsletter_campaigns', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    subject: (0, pg_core_1.varchar)('subject', { length: 255 }).notNull(),
    content: (0, pg_core_1.text)('content').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('draft'),
    type: (0, pg_core_1.varchar)('type', { length: 50 }).notNull().default('general'),
    scheduledAt: (0, pg_core_1.timestamp)('scheduled_at'),
    sentAt: (0, pg_core_1.timestamp)('sent_at'),
    recipientCount: (0, pg_core_1.integer)('recipient_count').default(0),
    openCount: (0, pg_core_1.integer)('open_count').default(0),
    clickCount: (0, pg_core_1.integer)('click_count').default(0),
    createdBy: (0, pg_core_1.integer)('created_by').references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.productReviews = (0, pg_core_1.pgTable)('product_reviews', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    orderId: (0, pg_core_1.integer)('order_id').references(() => exports.orders.id),
    rating: (0, pg_core_1.integer)('rating').notNull(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }),
    comment: (0, pg_core_1.text)('comment'),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).notNull().default('pending'),
    isVerifiedPurchase: (0, pg_core_1.boolean)('is_verified_purchase').default(false),
    helpfulCount: (0, pg_core_1.integer)('helpful_count').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
});
exports.reviewImages = (0, pg_core_1.pgTable)('review_images', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    reviewId: (0, pg_core_1.integer)('review_id').references(() => exports.productReviews.id, { onDelete: 'cascade' }),
    imageUrl: (0, pg_core_1.varchar)('image_url', { length: 500 }).notNull(),
    altText: (0, pg_core_1.varchar)('alt_text', { length: 255 }),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.reviewHelpfulVotes = (0, pg_core_1.pgTable)('review_helpful_votes', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    reviewId: (0, pg_core_1.integer)('review_id').references(() => exports.productReviews.id, { onDelete: 'cascade' }),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.newsletterCampaignProducts = (0, pg_core_1.pgTable)('newsletter_campaign_products', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    campaignId: (0, pg_core_1.integer)('campaign_id').references(() => exports.newsletterCampaigns.id, { onDelete: 'cascade' }),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    displayOrder: (0, pg_core_1.integer)('display_order').default(0),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.categories = (0, pg_core_1.pgTable)('categories', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 100 }).notNull().unique(),
    description: (0, pg_core_1.text)('description'),
    icon: (0, pg_core_1.varchar)('icon', { length: 255 }),
    image: (0, pg_core_1.varchar)('image', { length: 500 }),
    isActive: (0, pg_core_1.boolean)('is_active').default(true),
    sortOrder: (0, pg_core_1.integer)('sort_order').default(0),
    parentId: (0, pg_core_1.integer)('parent_id'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.productCategories = (0, pg_core_1.pgTable)('product_categories', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    productId: (0, pg_core_1.integer)('product_id').references(() => exports.products.id, { onDelete: 'cascade' }),
    categoryId: (0, pg_core_1.integer)('category_id').references(() => exports.categories.id, { onDelete: 'cascade' }),
});
exports.productsRelations = (0, drizzle_orm_1.relations)(exports.products, ({ many }) => ({
    images: many(exports.productImages),
    orderItems: many(exports.orderItems),
    cartItems: many(exports.cartItems),
    categories: many(exports.productCategories),
}));
exports.productImagesRelations = (0, drizzle_orm_1.relations)(exports.productImages, ({ one }) => ({
    product: one(exports.products, {
        fields: [exports.productImages.productId],
        references: [exports.products.id],
    }),
}));
exports.usersRelations = (0, drizzle_orm_1.relations)(exports.users, ({ many }) => ({
    addresses: many(exports.userAddresses),
    orders: many(exports.orders),
    cartItems: many(exports.cartItems),
}));
exports.userAddressesRelations = (0, drizzle_orm_1.relations)(exports.userAddresses, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.userAddresses.userId],
        references: [exports.users.id],
    }),
}));
exports.ordersRelations = (0, drizzle_orm_1.relations)(exports.orders, ({ one, many }) => ({
    user: one(exports.users, {
        fields: [exports.orders.userId],
        references: [exports.users.id],
    }),
    items: many(exports.orderItems),
}));
exports.orderItemsRelations = (0, drizzle_orm_1.relations)(exports.orderItems, ({ one }) => ({
    order: one(exports.orders, {
        fields: [exports.orderItems.orderId],
        references: [exports.orders.id],
    }),
    product: one(exports.products, {
        fields: [exports.orderItems.productId],
        references: [exports.products.id],
    }),
}));
exports.cartItemsRelations = (0, drizzle_orm_1.relations)(exports.cartItems, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.cartItems.userId],
        references: [exports.users.id],
    }),
    product: one(exports.products, {
        fields: [exports.cartItems.productId],
        references: [exports.products.id],
    }),
}));
exports.categoriesRelations = (0, drizzle_orm_1.relations)(exports.categories, ({ many }) => ({
    products: many(exports.productCategories),
}));
exports.productCategoriesRelations = (0, drizzle_orm_1.relations)(exports.productCategories, ({ one }) => ({
    product: one(exports.products, {
        fields: [exports.productCategories.productId],
        references: [exports.products.id],
    }),
    category: one(exports.categories, {
        fields: [exports.productCategories.categoryId],
        references: [exports.categories.id],
    }),
}));
exports.systemSettings = (0, pg_core_1.pgTable)('system_settings', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    key: (0, pg_core_1.varchar)('key', { length: 100 }).notNull().unique(),
    value: (0, pg_core_1.text)('value').notNull(),
    description: (0, pg_core_1.text)('description'),
    category: (0, pg_core_1.varchar)('category', { length: 50 }).notNull().default('general'),
    updatedBy: (0, pg_core_1.integer)('updated_by').references(() => exports.users.id),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow(),
});
exports.newsletterCampaignsRelations = (0, drizzle_orm_1.relations)(exports.newsletterCampaigns, ({ one, many }) => ({
    createdBy: one(exports.users, {
        fields: [exports.newsletterCampaigns.createdBy],
        references: [exports.users.id],
    }),
    products: many(exports.newsletterCampaignProducts),
}));
exports.newsletterCampaignProductsRelations = (0, drizzle_orm_1.relations)(exports.newsletterCampaignProducts, ({ one }) => ({
    campaign: one(exports.newsletterCampaigns, {
        fields: [exports.newsletterCampaignProducts.campaignId],
        references: [exports.newsletterCampaigns.id],
    }),
    product: one(exports.products, {
        fields: [exports.newsletterCampaignProducts.productId],
        references: [exports.products.id],
    }),
}));
exports.wishlistRelations = (0, drizzle_orm_1.relations)(exports.wishlist, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.wishlist.userId],
        references: [exports.users.id],
    }),
    product: one(exports.products, {
        fields: [exports.wishlist.productId],
        references: [exports.products.id],
    }),
}));
exports.contactMessagesRelations = (0, drizzle_orm_1.relations)(exports.contactMessages, ({ one }) => ({
    user: one(exports.users, {
        fields: [exports.contactMessages.userId],
        references: [exports.users.id],
    }),
}));
exports.productReviewsRelations = (0, drizzle_orm_1.relations)(exports.productReviews, ({ one, many }) => ({
    product: one(exports.products, {
        fields: [exports.productReviews.productId],
        references: [exports.products.id],
    }),
    user: one(exports.users, {
        fields: [exports.productReviews.userId],
        references: [exports.users.id],
    }),
    order: one(exports.orders, {
        fields: [exports.productReviews.orderId],
        references: [exports.orders.id],
    }),
    images: many(exports.reviewImages),
}));
exports.reviewImagesRelations = (0, drizzle_orm_1.relations)(exports.reviewImages, ({ one }) => ({
    review: one(exports.productReviews, {
        fields: [exports.reviewImages.reviewId],
        references: [exports.productReviews.id],
    }),
}));
exports.blogPosts = (0, pg_core_1.pgTable)('blog_posts', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    title: (0, pg_core_1.varchar)('title', { length: 255 }).notNull(),
    slug: (0, pg_core_1.varchar)('slug', { length: 255 }).notNull().unique(),
    excerpt: (0, pg_core_1.text)('excerpt'),
    content: (0, pg_core_1.text)('content').notNull(),
    author: (0, pg_core_1.varchar)('author', { length: 100 }).notNull(),
    authorId: (0, pg_core_1.integer)('author_id').references(() => exports.users.id),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('draft').notNull(),
    featured: (0, pg_core_1.boolean)('featured').default(false),
    category: (0, pg_core_1.varchar)('category', { length: 50 }).notNull(),
    tags: (0, pg_core_1.text)('tags'),
    image: (0, pg_core_1.varchar)('image', { length: 500 }),
    readTime: (0, pg_core_1.varchar)('readTime', { length: 20 }),
    views: (0, pg_core_1.integer)('views').default(0),
    publishedAt: (0, pg_core_1.timestamp)('published_at'),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.blogComments = (0, pg_core_1.pgTable)('blog_comments', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    postId: (0, pg_core_1.integer)('post_id').references(() => exports.blogPosts.id, { onDelete: 'cascade' }).notNull(),
    userId: (0, pg_core_1.integer)('user_id').references(() => exports.users.id, { onDelete: 'cascade' }),
    authorName: (0, pg_core_1.varchar)('author_name', { length: 100 }),
    authorEmail: (0, pg_core_1.varchar)('author_email', { length: 255 }),
    content: (0, pg_core_1.text)('content').notNull(),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('pending').notNull(),
    createdAt: (0, pg_core_1.timestamp)('created_at').defaultNow().notNull(),
    updatedAt: (0, pg_core_1.timestamp)('updated_at').defaultNow().notNull(),
});
exports.blogSubscribers = (0, pg_core_1.pgTable)('blog_subscribers', {
    id: (0, pg_core_1.serial)('id').primaryKey(),
    email: (0, pg_core_1.varchar)('email', { length: 255 }).notNull().unique(),
    name: (0, pg_core_1.varchar)('name', { length: 100 }),
    status: (0, pg_core_1.varchar)('status', { length: 20 }).default('active').notNull(),
    subscribedAt: (0, pg_core_1.timestamp)('subscribed_at').defaultNow().notNull(),
    unsubscribedAt: (0, pg_core_1.timestamp)('unsubscribed_at'),
});
