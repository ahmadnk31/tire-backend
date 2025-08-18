"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("./db/index.js");
const schema_js_1 = require("./db/schema.js");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function seedDatabase() {
    try {
        console.log('Starting database seeding...');
        await index_js_1.db.delete(schema_js_1.productCategories);
        await index_js_1.db.delete(schema_js_1.productImages);
        await index_js_1.db.delete(schema_js_1.products);
        await index_js_1.db.delete(schema_js_1.categories);
        await index_js_1.db.delete(schema_js_1.users);
        console.log('Cleared existing data');
        const hashedPassword = await bcrypt_1.default.hash('password123', 10);
        const seedUsers = await index_js_1.db.insert(schema_js_1.users).values([
            {
                name: 'Admin User',
                email: 'admin@tirestore.com',
                password: hashedPassword,
                role: 'admin',
                emailVerified: true,
                phone: '+1-555-0001',
                isActive: true,
            },
            {
                name: 'John Doe',
                email: 'john@example.com',
                password: hashedPassword,
                role: 'user',
                emailVerified: true,
                phone: '+1-555-0002',
                isActive: true,
            },
            {
                name: 'Jane Smith',
                email: 'jane@example.com',
                password: hashedPassword,
                role: 'user',
                emailVerified: false,
                phone: '+1-555-0003',
                isActive: true,
            },
        ]).returning();
        console.log(`Seeded ${seedUsers.length} users`);
        const seedCategories = await index_js_1.db.insert(schema_js_1.categories).values([
            {
                name: 'Passenger Tires',
                slug: 'passenger-tires',
                description: 'Tires for cars, sedans, and small SUVs',
                icon: 'car',
                sortOrder: 1,
                isActive: true,
            },
            {
                name: 'Truck Tires',
                slug: 'truck-tires',
                description: 'Heavy-duty tires for trucks and commercial vehicles',
                icon: 'truck',
                sortOrder: 2,
                isActive: true,
            },
            {
                name: 'SUV Tires',
                slug: 'suv-tires',
                description: 'All-terrain and highway tires for SUVs',
                icon: 'suv',
                sortOrder: 3,
                isActive: true,
            },
            {
                name: 'Motorcycle Tires',
                slug: 'motorcycle-tires',
                description: 'Sport and touring tires for motorcycles',
                icon: 'motorcycle',
                sortOrder: 4,
                isActive: true,
            },
        ]).returning();
        const subCategories = await index_js_1.db.insert(schema_js_1.categories).values([
            {
                name: 'All-Season',
                slug: 'passenger-all-season',
                description: 'Year-round passenger car tires',
                parentId: seedCategories[0].id,
                sortOrder: 1,
                isActive: true,
            },
            {
                name: 'Summer Performance',
                slug: 'passenger-summer',
                description: 'High-performance summer tires',
                parentId: seedCategories[0].id,
                sortOrder: 2,
                isActive: true,
            },
            {
                name: 'Winter',
                slug: 'passenger-winter',
                description: 'Snow and ice tires for passenger cars',
                parentId: seedCategories[0].id,
                sortOrder: 3,
                isActive: true,
            },
            {
                name: 'Highway',
                slug: 'truck-highway',
                description: 'Long-haul highway truck tires',
                parentId: seedCategories[1].id,
                sortOrder: 1,
                isActive: true,
            },
            {
                name: 'Off-Road',
                slug: 'truck-offroad',
                description: 'Heavy-duty off-road truck tires',
                parentId: seedCategories[1].id,
                sortOrder: 2,
                isActive: true,
            },
        ]).returning();
        const allCategories = [...seedCategories, ...subCategories];
        console.log(`Seeded ${allCategories.length} categories`);
        const productData = [
            {
                name: 'EcoMax All-Season Tire',
                brand: 'EcoMax',
                model: 'AS-Pro',
                sku: 'ECO-AS-225-60-16',
                description: 'Premium all-season tire with excellent fuel efficiency and long tread life. Features advanced silica compound for superior wet and dry traction.',
                tireWidth: '225',
                aspectRatio: '60',
                rimDiameter: '16',
                size: '225/60R16',
                loadIndex: '98',
                speedRating: 'H',
                seasonType: 'all-season',
                tireType: 'passenger',
                price: '129.99',
                comparePrice: '149.99',
                stock: 45,
                status: 'published',
                featured: false,
                rating: '4.5',
                features: ['Low Rolling Resistance', 'Enhanced Wet Grip', 'Long Tread Life'],
            },
            {
                name: 'SportMax Ultra Performance',
                brand: 'SportMax',
                model: 'Ultra-S',
                sku: 'SPT-UHP-245-35-18',
                description: 'Ultra-high performance summer tire designed for sports cars and performance vehicles. Exceptional cornering and braking capabilities.',
                tireWidth: '245',
                aspectRatio: '35',
                rimDiameter: '18',
                size: '245/35R18',
                loadIndex: '92',
                speedRating: 'Y',
                seasonType: 'summer',
                tireType: 'performance',
                price: '249.99',
                comparePrice: '279.99',
                stock: 28,
                status: 'published',
                featured: true,
                rating: '4.8',
                features: ['Racing-Inspired Tread', 'Asymmetric Design', 'Enhanced Cornering'],
            },
            {
                name: 'WinterGrip Snow Master',
                brand: 'WinterGrip',
                model: 'SnowMaster',
                sku: 'WG-WIN-215-65-16',
                description: 'Dedicated winter tire with severe snow service rating. Deep tread blocks and specialized rubber compound for maximum traction in snow and ice.',
                tireWidth: '215',
                aspectRatio: '65',
                rimDiameter: '16',
                size: '215/65R16',
                loadIndex: '98',
                speedRating: 'T',
                seasonType: 'winter',
                tireType: 'passenger',
                price: '189.99',
                comparePrice: '219.99',
                stock: 32,
                status: 'published',
                featured: false,
                rating: '4.6',
                features: ['3PMSF Rated', 'Deep Snow Traction', 'Ice Grip Technology'],
            },
            {
                name: 'HeavyDuty Highway Pro',
                brand: 'HeavyDuty',
                model: 'Highway-Pro',
                sku: 'HD-HWY-295-75-22.5',
                description: 'Commercial truck tire designed for long-haul highway applications. Optimized for fuel efficiency and extended mileage.',
                tireWidth: '295',
                aspectRatio: '75',
                rimDiameter: '22.5',
                size: '295/75R22.5',
                loadIndex: '144',
                speedRating: 'L',
                seasonType: 'all-season',
                tireType: 'commercial',
                price: '459.99',
                comparePrice: '499.99',
                stock: 12,
                status: 'published',
                featured: false,
                rating: '4.3',
                features: ['SmartWay Verified', 'Retreadable', 'Fuel Efficient'],
            },
            {
                name: 'ToughTread Off-Road Beast',
                brand: 'ToughTread',
                model: 'Beast-OTR',
                sku: 'TT-OTR-385-65-22.5',
                description: 'Aggressive off-road tire for construction and mining applications. Deep lugs and reinforced sidewalls for maximum traction and durability.',
                tireWidth: '385',
                aspectRatio: '65',
                rimDiameter: '22.5',
                size: '385/65R22.5',
                loadIndex: '160',
                speedRating: 'K',
                seasonType: 'all-season',
                tireType: 'off-road',
                price: '529.99',
                comparePrice: '579.99',
                stock: 8,
                status: 'published',
                featured: false,
                rating: '4.4',
                features: ['Deep Lug Pattern', 'Stone Ejectors', 'Reinforced Sidewall'],
            },
            {
                name: 'AllTerrain Explorer',
                brand: 'AllTerrain',
                model: 'Explorer-AT',
                sku: 'AT-EXP-265-70-17',
                description: 'Versatile all-terrain tire perfect for SUVs that see both highway and light off-road use. Balanced performance on all surfaces.',
                tireWidth: '265',
                aspectRatio: '70',
                rimDiameter: '17',
                size: '265/70R17',
                loadIndex: '115',
                speedRating: 'T',
                seasonType: 'all-season',
                tireType: 'all-terrain',
                price: '199.99',
                comparePrice: '229.99',
                stock: 36,
                status: 'published',
                featured: true,
                rating: '4.5',
                features: ['All-Terrain Capability', 'Comfortable Highway Ride', 'Sidewall Protection'],
            },
            {
                name: 'SportBike Racing Pro',
                brand: 'SportBike',
                model: 'Racing-Pro',
                sku: 'SB-RAC-190-55-17',
                description: 'Track-focused motorcycle tire with dual compound technology. Maximum grip for aggressive riding and track days.',
                tireWidth: '190',
                aspectRatio: '55',
                rimDiameter: '17',
                size: '190/55R17',
                loadIndex: '75',
                speedRating: 'W',
                seasonType: 'summer',
                tireType: 'motorcycle',
                price: '299.99',
                comparePrice: '349.99',
                stock: 15,
                status: 'published',
                featured: false,
                rating: '4.9',
                features: ['Dual Compound', 'Racing Proven', 'Quick Warm-Up'],
            },
        ];
        const seedProducts = [];
        for (const product of productData) {
            const inserted = await index_js_1.db.insert(schema_js_1.products).values(product).returning();
            seedProducts.push(inserted[0]);
        }
        console.log(`Seeded ${seedProducts.length} products`);
        const productImageData = [
            { productId: seedProducts[0].id, imageUrl: 'https://example.com/images/ecomax-all-season-1.jpg', altText: 'EcoMax All-Season Tire - Front View', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[0].id, imageUrl: 'https://example.com/images/ecomax-all-season-2.jpg', altText: 'EcoMax All-Season Tire - Side View', sortOrder: 2, isPrimary: false },
            { productId: seedProducts[1].id, imageUrl: 'https://example.com/images/sportmax-ultra-1.jpg', altText: 'SportMax Ultra Performance - Front View', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[1].id, imageUrl: 'https://example.com/images/sportmax-ultra-2.jpg', altText: 'SportMax Ultra Performance - Tread Pattern', sortOrder: 2, isPrimary: false },
            { productId: seedProducts[2].id, imageUrl: 'https://example.com/images/wintergrip-snow-1.jpg', altText: 'WinterGrip Snow Master - Front View', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[3].id, imageUrl: 'https://example.com/images/heavyduty-highway-1.jpg', altText: 'HeavyDuty Highway Pro - Side View', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[4].id, imageUrl: 'https://example.com/images/toughtread-beast-1.jpg', altText: 'ToughTread Off-Road Beast - Tread Pattern', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[5].id, imageUrl: 'https://example.com/images/allterrain-explorer-1.jpg', altText: 'AllTerrain Explorer - Front View', sortOrder: 1, isPrimary: true },
            { productId: seedProducts[6].id, imageUrl: 'https://example.com/images/sportbike-racing-1.jpg', altText: 'SportBike Racing Pro - Side View', sortOrder: 1, isPrimary: true },
        ];
        const seedImages = await index_js_1.db.insert(schema_js_1.productImages).values(productImageData).returning();
        console.log(`Seeded ${seedImages.length} product images`);
        const productCategoryData = [
            { productId: seedProducts[0].id, categoryId: seedCategories[0].id },
            { productId: seedProducts[0].id, categoryId: allCategories.find(c => c.slug === 'passenger-all-season').id },
            { productId: seedProducts[1].id, categoryId: seedCategories[0].id },
            { productId: seedProducts[1].id, categoryId: allCategories.find(c => c.slug === 'passenger-summer').id },
            { productId: seedProducts[2].id, categoryId: seedCategories[0].id },
            { productId: seedProducts[2].id, categoryId: allCategories.find(c => c.slug === 'passenger-winter').id },
            { productId: seedProducts[3].id, categoryId: seedCategories[1].id },
            { productId: seedProducts[3].id, categoryId: allCategories.find(c => c.slug === 'truck-highway').id },
            { productId: seedProducts[4].id, categoryId: seedCategories[1].id },
            { productId: seedProducts[4].id, categoryId: allCategories.find(c => c.slug === 'truck-offroad').id },
            { productId: seedProducts[5].id, categoryId: seedCategories[2].id },
            { productId: seedProducts[6].id, categoryId: seedCategories[3].id },
        ];
        const seedProductCategories = await index_js_1.db.insert(schema_js_1.productCategories).values(productCategoryData).returning();
        console.log(`Seeded ${seedProductCategories.length} product-category relationships`);
        console.log('Database seeding completed successfully!');
        console.log('\nSeeded data summary:');
        console.log(`- Users: ${seedUsers.length}`);
        console.log(`- Categories: ${allCategories.length}`);
        console.log(`- Products: ${seedProducts.length}`);
        console.log(`- Product Images: ${seedImages.length}`);
        console.log(`- Product-Category Relations: ${seedProductCategories.length}`);
        console.log('\nTest credentials:');
        console.log('Admin: admin@tirestore.com / password123');
        console.log('User: john@example.com / password123');
    }
    catch (error) {
        console.error('Error seeding database:', error);
        throw error;
    }
}
if (require.main === module) {
    seedDatabase()
        .then(() => {
        console.log('Seeding complete');
        process.exit(0);
    })
        .catch((error) => {
        console.error('Seeding failed:', error);
        process.exit(1);
    });
}
exports.default = seedDatabase;
