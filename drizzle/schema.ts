import { pgTable, serial, varchar, text, integer, boolean, timestamp, unique, foreignKey, numeric, jsonb } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const banners = pgTable("banners", {
	id: serial().primaryKey().notNull(),
	type: varchar({ length: 20 }).notNull(),
	src: varchar({ length: 500 }).notNull(),
	headline: varchar({ length: 255 }),
	subheadline: varchar({ length: 255 }),
	description: text(),
	sortOrder: integer("sort_order").default(0),
	isActive: boolean("is_active").default(true),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
});

export const users = pgTable("users", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	role: varchar({ length: 20 }).default('user').notNull(),
	emailVerified: boolean("email_verified").default(false),
	verificationToken: varchar("verification_token", { length: 255 }),
	resetToken: varchar("reset_token", { length: 255 }),
	isActive: boolean("is_active").default(true),
	phone: varchar({ length: 20 }),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("users_email_unique").on(table.email),
]);

export const cartItems = pgTable("cart_items", {
	id: serial().primaryKey().notNull(),
	sessionId: varchar("session_id", { length: 255 }).notNull(),
	userId: integer("user_id"),
	productId: integer("product_id"),
	quantity: integer().default(1).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "cart_items_user_id_users_id_fk"
		}),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "cart_items_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const products = pgTable("products", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 255 }).notNull(),
	brand: varchar({ length: 100 }).notNull(),
	model: varchar({ length: 100 }).notNull(),
	sku: varchar({ length: 100 }).notNull(),
	description: text(),
	tireWidth: varchar("tire_width", { length: 10 }),
	aspectRatio: varchar("aspect_ratio", { length: 10 }),
	rimDiameter: varchar("rim_diameter", { length: 10 }),
	size: varchar({ length: 50 }).notNull(),
	loadIndex: varchar("load_index", { length: 10 }),
	speedRating: varchar("speed_rating", { length: 5 }),
	seasonType: varchar("season_type", { length: 20 }),
	tireType: varchar("tire_type", { length: 30 }),
	price: numeric({ precision: 10, scale:  2 }).notNull(),
	comparePrice: numeric("compare_price", { precision: 10, scale:  2 }),
	stock: integer().default(0).notNull(),
	lowStockThreshold: integer("low_stock_threshold").default(10),
	status: varchar({ length: 20 }).default('draft').notNull(),
	featured: boolean().default(false),
	rating: numeric({ precision: 3, scale:  2 }).default('0'),
	features: jsonb(),
	specifications: jsonb(),
	tags: jsonb(),
	seoTitle: varchar("seo_title", { length: 255 }),
	seoDescription: text("seo_description"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("products_sku_unique").on(table.sku),
]);

export const orders = pgTable("orders", {
	id: serial().primaryKey().notNull(),
	orderNumber: varchar("order_number", { length: 50 }).notNull(),
	userId: integer("user_id"),
	userEmail: varchar("user_email", { length: 255 }).notNull(),
	userName: varchar("user_name", { length: 255 }).notNull(),
	status: varchar({ length: 20 }).default('pending').notNull(),
	paymentStatus: varchar("payment_status", { length: 20 }).default('pending').notNull(),
	subtotal: numeric({ precision: 10, scale:  2 }).notNull(),
	tax: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	shipping: numeric({ precision: 10, scale:  2 }).default('0').notNull(),
	total: numeric({ precision: 10, scale:  2 }).notNull(),
	shippingAddress: jsonb("shipping_address"),
	billingAddress: jsonb("billing_address"),
	trackingNumber: varchar("tracking_number", { length: 100 }),
	notes: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "orders_user_id_users_id_fk"
		}),
	unique("orders_order_number_unique").on(table.orderNumber),
]);

export const orderItems = pgTable("order_items", {
	id: serial().primaryKey().notNull(),
	orderId: integer("order_id"),
	productId: integer("product_id"),
	productName: varchar("product_name", { length: 255 }).notNull(),
	productSize: varchar("product_size", { length: 50 }).notNull(),
	productSku: varchar("product_sku", { length: 100 }).notNull(),
	quantity: integer().notNull(),
	unitPrice: numeric("unit_price", { precision: 10, scale:  2 }).notNull(),
	totalPrice: numeric("total_price", { precision: 10, scale:  2 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.orderId],
			foreignColumns: [orders.id],
			name: "order_items_order_id_orders_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "order_items_product_id_products_id_fk"
		}),
]);

export const productCategories = pgTable("product_categories", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id"),
	categoryId: integer("category_id"),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_categories_product_id_products_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.categoryId],
			foreignColumns: [categories.id],
			name: "product_categories_category_id_categories_id_fk"
		}).onDelete("cascade"),
]);

export const categories = pgTable("categories", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	slug: varchar({ length: 100 }).notNull(),
	description: text(),
	icon: varchar({ length: 255 }),
	image: varchar({ length: 500 }),
	isActive: boolean("is_active").default(true),
	sortOrder: integer("sort_order").default(0),
	parentId: integer("parent_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	unique("categories_slug_unique").on(table.slug),
]);

export const productImages = pgTable("product_images", {
	id: serial().primaryKey().notNull(),
	productId: integer("product_id"),
	imageUrl: varchar("image_url", { length: 500 }).notNull(),
	altText: varchar("alt_text", { length: 255 }),
	isPrimary: boolean("is_primary").default(false),
	sortOrder: integer("sort_order").default(0),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "product_images_product_id_products_id_fk"
		}).onDelete("cascade"),
]);

export const userAddresses = pgTable("user_addresses", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	type: varchar({ length: 20 }).notNull(),
	street: varchar({ length: 255 }).notNull(),
	city: varchar({ length: 100 }).notNull(),
	state: varchar({ length: 100 }).notNull(),
	zipCode: varchar("zip_code", { length: 20 }).notNull(),
	country: varchar({ length: 100 }).default('USA').notNull(),
	isDefault: boolean("is_default").default(false),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_addresses_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const wishlist = pgTable("wishlist", {
	id: serial().primaryKey().notNull(),
	userId: integer("user_id"),
	productId: integer("product_id"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "wishlist_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.productId],
			foreignColumns: [products.id],
			name: "wishlist_product_id_products_id_fk"
		}).onDelete("cascade"),
]);
