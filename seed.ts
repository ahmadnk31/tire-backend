import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, categories, productCategories, productImages } from './src/db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

async function seed() {
  // Delete existing data to avoid unique constraint errors
  await db.delete(productImages);
  await db.delete(productCategories);
  await db.delete(products);
  await db.delete(categories);

  // Seed categories
  const categoryData = [
    { name: 'Summer Tires', slug: 'summer-tires', description: 'Best for warm weather', icon: 'sun', image: '', isActive: true, sortOrder: 1 },
    { name: 'Winter Tires', slug: 'winter-tires', description: 'Best for cold weather', icon: 'snowflake', image: '', isActive: true, sortOrder: 2 },
    { name: 'All-Season Tires', slug: 'all-season-tires', description: 'Versatile tires for all conditions', icon: 'cloud', image: '', isActive: true, sortOrder: 3 },
    { name: 'Performance Tires', slug: 'performance-tires', description: 'High performance tires', icon: 'speed', image: '', isActive: true, sortOrder: 4 },
  ];
  const insertedCategories = await db.insert(categories).values(categoryData).returning();

  // Seed products (without images field)
  const productData = [
    {
      name: 'Michelin Pilot Sport 4',
      brand: 'Michelin',
      model: 'Pilot Sport 4',
      size: '225/45R17',
      price: '150.00',
      comparePrice: '180.00',
      rating: '4.8',
      stock: 50,
      status: 'published',
      featured: true,
      sku: 'MIC-PS4-2254517',
      description: 'High performance summer tire.',
      features: JSON.stringify(['Excellent grip', 'Long tread life']),
      specifications: JSON.stringify({ speedRating: 'Y', loadIndex: 94 }),
      tags: JSON.stringify(['summer', 'performance']),
    },
    {
      name: 'Michelin Primacy 4',
      brand: 'Michelin',
      model: 'Primacy 4',
      size: '215/55R17',
      price: '140.00',
      comparePrice: '170.00',
      rating: '4.6',
      stock: 30,
      status: 'published',
      featured: false,
      sku: 'MIC-PRI4-2155517',
      description: 'Premium comfort summer tire.',
      features: JSON.stringify(['Comfort', 'Low noise']),
      specifications: JSON.stringify({ speedRating: 'V', loadIndex: 94 }),
      tags: JSON.stringify(['summer', 'comfort']),
    },
    {
      name: 'Bridgestone Blizzak WS90',
      brand: 'Bridgestone',
      model: 'Blizzak WS90',
      size: '205/55R16',
      price: '120.00',
      comparePrice: '140.00',
      rating: '4.7',
      stock: 40,
      status: 'published',
      featured: false,
      sku: 'BRI-BLZ-2055516',
      description: 'Top-rated winter tire.',
      features: JSON.stringify(['Superior snow traction', 'Quiet ride']),
      specifications: JSON.stringify({ speedRating: 'T', loadIndex: 91 }),
      tags: JSON.stringify(['winter']),
    },
    {
      name: 'Bridgestone Turanza T005',
      brand: 'Bridgestone',
      model: 'Turanza T005',
      size: '225/50R17',
      price: '135.00',
      comparePrice: '160.00',
      rating: '4.5',
      stock: 25,
      status: 'published',
      featured: true,
      sku: 'BRI-TUR-2255017',
      description: 'Premium touring tire.',
      features: JSON.stringify(['Wet grip', 'Long life']),
      specifications: JSON.stringify({ speedRating: 'W', loadIndex: 98 }),
      tags: JSON.stringify(['touring']),
    },
    {
      name: 'Goodyear Assurance WeatherReady',
      brand: 'Goodyear',
      model: 'Assurance WeatherReady',
      size: '215/60R16',
      price: '130.00',
      comparePrice: '155.00',
      rating: '4.6',
      stock: 35,
      status: 'published',
      featured: true,
      sku: 'GOO-AWR-2156016',
      description: 'All-season tire for all conditions.',
      features: JSON.stringify(['Wet traction', 'Long tread life']),
      specifications: JSON.stringify({ speedRating: 'H', loadIndex: 95 }),
      tags: JSON.stringify(['all-season']),
    },
    {
      name: 'Goodyear Eagle F1',
      brand: 'Goodyear',
      model: 'Eagle F1',
      size: '245/45R18',
      price: '160.00',
      comparePrice: '190.00',
      rating: '4.8',
      stock: 20,
      status: 'published',
      featured: false,
      sku: 'GOO-EF1-2454518',
      description: 'Ultra high performance tire.',
      features: JSON.stringify(['Sporty', 'Responsive']),
      specifications: JSON.stringify({ speedRating: 'Y', loadIndex: 100 }),
      tags: JSON.stringify(['performance']),
    },
    {
      name: 'Pirelli P Zero',
      brand: 'Pirelli',
      model: 'P Zero',
      size: '245/40R18',
      price: '170.00',
      comparePrice: '200.00',
      rating: '4.9',
      stock: 20,
      status: 'published',
      featured: true,
      sku: 'PIR-PZ-2454018',
      description: 'Ultra high performance tire.',
      features: JSON.stringify(['Responsive handling', 'Sporty feel']),
      specifications: JSON.stringify({ speedRating: 'Y', loadIndex: 97 }),
      tags: JSON.stringify(['performance']),
    },
    {
      name: 'Pirelli Cinturato P7',
      brand: 'Pirelli',
      model: 'Cinturato P7',
      size: '225/45R17',
      price: '145.00',
      comparePrice: '175.00',
      rating: '4.7',
      stock: 15,
      status: 'published',
      featured: false,
      sku: 'PIR-CP7-2254517',
      description: 'Eco-friendly touring tire.',
      features: JSON.stringify(['Eco', 'Comfort']),
      specifications: JSON.stringify({ speedRating: 'V', loadIndex: 91 }),
      tags: JSON.stringify(['eco', 'touring']),
    },
  ];
  const insertedProducts = await db.insert(products).values(productData).returning();

  // Seed product images
  const productImageData = [
    // Michelin Pilot Sport 4
    { productId: insertedProducts[0].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Michelin Pilot Sport 4 tire', isPrimary: true, sortOrder: 1 },
    { productId: insertedProducts[0].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&crop=center', altText: 'Michelin Pilot Sport 4 side view', isPrimary: false, sortOrder: 2 },
    
    // Michelin Primacy 4
    { productId: insertedProducts[1].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Michelin Primacy 4 tire', isPrimary: true, sortOrder: 1 },
    
    // Bridgestone Blizzak WS90
    { productId: insertedProducts[2].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Bridgestone Blizzak WS90 tire', isPrimary: true, sortOrder: 1 },
    
    // Bridgestone Turanza T005
    { productId: insertedProducts[3].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Bridgestone Turanza T005 tire', isPrimary: true, sortOrder: 1 },
    
    // Goodyear Assurance WeatherReady
    { productId: insertedProducts[4].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Goodyear Assurance WeatherReady tire', isPrimary: true, sortOrder: 1 },
    
    // Goodyear Eagle F1
    { productId: insertedProducts[5].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Goodyear Eagle F1 tire', isPrimary: true, sortOrder: 1 },
    
    // Pirelli P Zero
    { productId: insertedProducts[6].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Pirelli P Zero tire', isPrimary: true, sortOrder: 1 },
    
    // Pirelli Cinturato P7
    { productId: insertedProducts[7].id, imageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop', altText: 'Pirelli Cinturato P7 tire', isPrimary: true, sortOrder: 1 },
  ];
  await db.insert(productImages).values(productImageData);

  // Link products to categories (all products)
  const productCategoryLinks = [
    // Michelin Pilot Sport 4: summer, performance
    { productId: insertedProducts[0].id, categoryId: insertedCategories[0].id }, // Summer Tires
    { productId: insertedProducts[0].id, categoryId: insertedCategories[3].id }, // Performance Tires

    // Michelin Primacy 4: summer, comfort
    { productId: insertedProducts[1].id, categoryId: insertedCategories[0].id }, // Summer Tires

    // Bridgestone Blizzak WS90: winter
    { productId: insertedProducts[2].id, categoryId: insertedCategories[1].id }, // Winter Tires

    // Bridgestone Turanza T005: summer, touring
    { productId: insertedProducts[3].id, categoryId: insertedCategories[0].id }, // Summer Tires

    // Goodyear Assurance WeatherReady: all-season
    { productId: insertedProducts[4].id, categoryId: insertedCategories[2].id }, // All-Season Tires

    // Goodyear Eagle F1: performance
    { productId: insertedProducts[5].id, categoryId: insertedCategories[3].id }, // Performance Tires

    // Pirelli P Zero: performance
    { productId: insertedProducts[6].id, categoryId: insertedCategories[3].id }, // Performance Tires

    // Pirelli Cinturato P7: summer, touring
    { productId: insertedProducts[7].id, categoryId: insertedCategories[0].id }, // Summer Tires
    { productId: insertedProducts[7].id, categoryId: insertedCategories[3].id }, // Performance Tires
  ];
  await db.insert(productCategories).values(productCategoryLinks);

  console.log('Seed data inserted!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  pool.end();
});
