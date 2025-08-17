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
  description: text('description'),
  
  // Additional tire-specific fields that exist in your database
  tireWidth: varchar('tire_width', { length: 10 }),
  aspectRatio: varchar('aspect_ratio', { length: 10 }),
  rimDiameter: varchar('rim_diameter', { length: 10 }),
  loadIndex: varchar('load_index', { length: 10 }),
  speedRating: varchar('speed_rating', { length: 5 }),
  seasonType: varchar('season_type', { length: 20 }),
  tireType: varchar('tire_type', { length: 30 }),
  
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
