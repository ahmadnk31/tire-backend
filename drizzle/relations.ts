import { relations } from "drizzle-orm/relations";
import { users, cartItems, products, orders, orderItems, productCategories, categories, productImages, userAddresses, wishlist } from "./schema";

export const cartItemsRelations = relations(cartItems, ({one}) => ({
	user: one(users, {
		fields: [cartItems.userId],
		references: [users.id]
	}),
	product: one(products, {
		fields: [cartItems.productId],
		references: [products.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	cartItems: many(cartItems),
	orders: many(orders),
	userAddresses: many(userAddresses),
	wishlists: many(wishlist),
}));

export const productsRelations = relations(products, ({many}) => ({
	cartItems: many(cartItems),
	orderItems: many(orderItems),
	productCategories: many(productCategories),
	productImages: many(productImages),
	wishlists: many(wishlist),
}));

export const ordersRelations = relations(orders, ({one, many}) => ({
	user: one(users, {
		fields: [orders.userId],
		references: [users.id]
	}),
	orderItems: many(orderItems),
}));

export const orderItemsRelations = relations(orderItems, ({one}) => ({
	order: one(orders, {
		fields: [orderItems.orderId],
		references: [orders.id]
	}),
	product: one(products, {
		fields: [orderItems.productId],
		references: [products.id]
	}),
}));

export const productCategoriesRelations = relations(productCategories, ({one}) => ({
	product: one(products, {
		fields: [productCategories.productId],
		references: [products.id]
	}),
	category: one(categories, {
		fields: [productCategories.categoryId],
		references: [categories.id]
	}),
}));

export const categoriesRelations = relations(categories, ({many}) => ({
	productCategories: many(productCategories),
}));

export const productImagesRelations = relations(productImages, ({one}) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id]
	}),
}));

export const userAddressesRelations = relations(userAddresses, ({one}) => ({
	user: one(users, {
		fields: [userAddresses.userId],
		references: [users.id]
	}),
}));

export const wishlistRelations = relations(wishlist, ({one}) => ({
	user: one(users, {
		fields: [wishlist.userId],
		references: [users.id]
	}),
	product: one(products, {
		fields: [wishlist.productId],
		references: [products.id]
	}),
}));