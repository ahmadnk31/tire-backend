import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, categories, productCategories, productImages } from './src/db/schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

// Ariana Banden Service tire data
const tireData = [
  // 13 inch tires - €25-30 with mounting and balancing
  { size: '165/70R13', price: 25, category: 'summer' },
  { size: '165/65R13', price: 25, category: 'summer' },
  { size: '175/65R13', price: 25, category: 'summer' },
  { size: '145/80R13', price: 25, category: 'summer' },
  { size: '155/80R13', price: 25, category: 'summer' },
  { size: '145/70R13', price: 25, category: 'summer' },
  { size: '155/70R13', price: 25, category: 'summer' },
  { size: '175/70R13', price: 25, category: 'summer' },
  { size: '185/70R13', price: 25, category: 'summer' },
  { size: '175/80R13', price: 25, category: 'summer' },
  { size: '185/70R13', price: 25, category: 'summer' },

  // 14 inch tires - €25-30 with mounting and balancing
  { size: '155/65R14', price: 25, category: 'summer' },
  { size: '165/60R14', price: 25, category: 'summer' },
  { size: '165/65R14', price: 25, category: 'summer' },
  { size: '185/55R14', price: 25, category: 'summer' },
  { size: '185/60R14', price: 25, category: 'summer' },
  { size: '175/65R14', price: 25, category: 'summer' },
  { size: '175/70R14', price: 25, category: 'summer' },
  { size: '185/50R14', price: 25, category: 'summer' },
  { size: '185/55R14', price: 25, category: 'summer' },
  { size: '185/65R14', price: 25, category: 'summer' },
  { size: '195/65R14', price: 25, category: 'summer' },
  { size: '175/80R14', price: 25, category: 'summer' },
  { size: '185/70R14', price: 25, category: 'summer' },

  // 15 inch tires - €30-35 with mounting and balancing
  { size: '155/60R15', price: 30, category: 'summer' },
  { size: '165/65R15', price: 30, category: 'summer' },
  { size: '175/50R15', price: 30, category: 'summer' },
  { size: '175/55R15', price: 30, category: 'summer' },
  { size: '175/60R15', price: 30, category: 'summer' },
  { size: '175/65R15', price: 30, category: 'summer' },
  { size: '185/55R15', price: 30, category: 'summer' },
  { size: '185/60R15', price: 30, category: 'summer' },
  { size: '185/65R15', price: 30, category: 'summer' },
  { size: '195/50R15', price: 30, category: 'summer' },
  { size: '195/55R15', price: 30, category: 'summer' },
  { size: '195/60R15', price: 30, category: 'summer' },
  { size: '195/65R15', price: 30, category: 'summer' },
  { size: '205/55R15', price: 30, category: 'summer' },
  { size: '205/60R15', price: 30, category: 'summer' },
  { size: '205/65R15', price: 30, category: 'summer' },
  { size: '215/65R15', price: 30, category: 'summer' },
  { size: '225/60R15', price: 30, category: 'summer' },
  { size: '225/75R15', price: 30, category: 'summer' },

  // 16 inch tires - €35-40 with mounting and balancing
  { size: '185/55R16', price: 35, category: 'summer' },
  { size: '195/55R16', price: 35, category: 'summer' },
  { size: '205/50R16', price: 35, category: 'summer' },
  { size: '205/55R16', price: 35, category: 'summer' },
  { size: '215/55R16', price: 35, category: 'summer' },
  { size: '225/55R16', price: 35, category: 'summer' },
  { size: '215/60R16', price: 35, category: 'summer' },
  { size: '215/65R16', price: 35, category: 'summer' },
  { size: '225/60R16', price: 35, category: 'summer' },
  { size: '195/45R16', price: 35, category: 'summer' },
  { size: '195/50R16', price: 35, category: 'summer' },
  { size: '205/45R16', price: 35, category: 'summer' },
  { size: '225/45R16', price: 35, category: 'summer' },
  { size: '225/50R16', price: 35, category: 'summer' },
  { size: '215/45R16', price: 35, category: 'summer' },
  { size: '195/60R16', price: 35, category: 'summer' },
  { size: '205/60R16', price: 35, category: 'summer' },
  { size: '195/65R16', price: 35, category: 'summer' },
  { size: '205/65R16', price: 35, category: 'summer' },
  { size: '215/60R16', price: 35, category: 'summer' },
  { size: '215/65R16', price: 35, category: 'summer' },
  { size: '225/60R16', price: 35, category: 'summer' },
  { size: '235/55R16', price: 35, category: 'summer' },
  { size: '155/90R16', price: 35, category: 'summer' },
  { size: '205/70R16', price: 35, category: 'summer' },
  { size: '215/65R16', price: 35, category: 'summer' },
  { size: '215/70R16', price: 35, category: 'summer' },
  { size: '225/65R16', price: 35, category: 'summer' },
  { size: '235/60R16', price: 35, category: 'summer' },
  { size: '215/75R16', price: 35, category: 'summer' },
  { size: '225/70R16', price: 35, category: 'summer' },
  { size: '235/65R16', price: 35, category: 'summer' },
  { size: '255/60R16', price: 35, category: 'summer' },

  // 17 inch tires - €40-45 with mounting and balancing
  { size: '195/45R17', price: 40, category: 'summer' },
  { size: '205/40R17', price: 40, category: 'summer' },
  { size: '215/40R17', price: 40, category: 'summer' },
  { size: '245/35R17', price: 40, category: 'summer' },
  { size: '205/45R17', price: 40, category: 'summer' },
  { size: '215/45R17', price: 40, category: 'summer' },
  { size: '225/45R17', price: 40, category: 'summer' },
  { size: '235/40R17', price: 40, category: 'summer' },
  { size: '245/40R17', price: 40, category: 'summer' },
  { size: '205/50R17', price: 40, category: 'summer' },
  { size: '205/55R17', price: 40, category: 'summer' },
  { size: '215/50R17', price: 40, category: 'summer' },
  { size: '225/50R17', price: 40, category: 'summer' },
  { size: '235/45R17', price: 40, category: 'summer' },
  { size: '245/45R17', price: 40, category: 'summer' },
  { size: '255/40R17', price: 40, category: 'summer' },
  { size: '265/40R17', price: 40, category: 'summer' },
  { size: '215/55R17', price: 40, category: 'summer' },
  { size: '225/55R17', price: 40, category: 'summer' },
  { size: '235/50R17', price: 40, category: 'summer' },
  { size: '245/50R17', price: 40, category: 'summer' },
  { size: '255/45R17', price: 40, category: 'summer' },
  { size: '215/60R17', price: 40, category: 'summer' },
  { size: '225/60R17', price: 40, category: 'summer' },
  { size: '235/55R17', price: 40, category: 'summer' },
  { size: '245/55R17', price: 40, category: 'summer' },
  { size: '255/50R17', price: 40, category: 'summer' },

  // 18 inch tires - €40-50 with mounting and balancing
  { size: '205/40R18', price: 40, category: 'summer' },
  { size: '225/40R18', price: 40, category: 'summer' },
  { size: '225/35R18', price: 40, category: 'summer' },
  { size: '245/35R18', price: 40, category: 'summer' },
  { size: '265/35R18', price: 40, category: 'summer' },
  { size: '265/40R18', price: 40, category: 'summer' },
  { size: '285/30R18', price: 40, category: 'summer' },
  { size: '215/45R18', price: 40, category: 'summer' },
  { size: '225/40R18', price: 40, category: 'summer' },
  { size: '235/40R18', price: 40, category: 'summer' },
  { size: '245/40R18', price: 40, category: 'summer' },
  { size: '255/35R18', price: 40, category: 'summer' },
  { size: '265/35R18', price: 40, category: 'summer' },
  { size: '275/35R18', price: 40, category: 'summer' },
  { size: '285/35R18', price: 40, category: 'summer' },
  { size: '295/30R18', price: 40, category: 'summer' },
  { size: '225/45R18', price: 40, category: 'summer' },
  { size: '225/50R18', price: 40, category: 'summer' },
  { size: '235/45R18', price: 40, category: 'summer' },
  { size: '245/45R18', price: 40, category: 'summer' },
  { size: '255/40R18', price: 40, category: 'summer' },
  { size: '265/40R18', price: 40, category: 'summer' },
  { size: '275/40R18', price: 40, category: 'summer' },
  { size: '215/55R18', price: 40, category: 'summer' },
  { size: '225/55R18', price: 40, category: 'summer' },
  { size: '235/50R18', price: 40, category: 'summer' },
  { size: '245/50R18', price: 40, category: 'summer' },
  { size: '225/60R18', price: 40, category: 'summer' },
  { size: '235/55R18', price: 40, category: 'summer' },
  { size: '245/55R18', price: 40, category: 'summer' },
  { size: '255/50R18', price: 40, category: 'summer' },
  { size: '265/50R18', price: 40, category: 'summer' },
  { size: '285/45R18', price: 40, category: 'summer' },
  { size: '295/45R18', price: 40, category: 'summer' },
  { size: '235/60R18', price: 40, category: 'summer' },
  { size: '225/65R18', price: 40, category: 'summer' },
  { size: '245/60R18', price: 40, category: 'summer' },
  { size: '265/55R18', price: 40, category: 'summer' },

  // 19 inch tires - €50-55 with mounting and balancing
  { size: '235/35R19', price: 50, category: 'summer' },
  { size: '245/35R19', price: 50, category: 'summer' },
  { size: '225/35R19', price: 50, category: 'summer' },
  { size: '255/30R19', price: 50, category: 'summer' },
  { size: '255/35R19', price: 50, category: 'summer' },
  { size: '265/35R19', price: 50, category: 'summer' },
  { size: '265/50R19', price: 50, category: 'summer' },
  { size: '255/50R19', price: 50, category: 'summer' },
  { size: '255/55R19', price: 50, category: 'summer' },
  { size: '285/45R19', price: 50, category: 'summer' },
  { size: '285/30R19', price: 50, category: 'summer' },
  { size: '245/40R19', price: 50, category: 'summer' },
  { size: '245/45R19', price: 50, category: 'summer' },
  { size: '255/40R19', price: 50, category: 'summer' },
  { size: '305/30R19', price: 50, category: 'summer' },
  { size: '255/40R19', price: 50, category: 'summer' },
  { size: '285/45R19', price: 50, category: 'summer' },
  { size: '255/50R19', price: 50, category: 'summer' },
  { size: '255/55R19', price: 50, category: 'summer' },
  { size: '265/55R19', price: 50, category: 'summer' },
  { size: '275/30R19', price: 50, category: 'summer' },
  { size: '275/40R19', price: 50, category: 'summer' },
  { size: '275/45R19', price: 50, category: 'summer' },
  { size: '235/55R19', price: 50, category: 'summer' },
  { size: '225/55R19', price: 50, category: 'summer' },
  { size: '295/30R19', price: 50, category: 'summer' },
  { size: '305/30R19', price: 50, category: 'summer' },

  // 20 inch tires - €60-70 with mounting and balancing
  { size: '225/30R20', price: 60, category: 'summer' },
  { size: '235/30R20', price: 60, category: 'summer' },
  { size: '245/30R20', price: 60, category: 'summer' },
  { size: '255/30R20', price: 60, category: 'summer' },
  { size: '245/35R20', price: 60, category: 'summer' },
  { size: '255/30R20', price: 60, category: 'summer' },
  { size: '265/30R20', price: 60, category: 'summer' },
  { size: '275/30R20', price: 60, category: 'summer' },
  { size: '285/30R20', price: 60, category: 'summer' },
  { size: '295/30R20', price: 60, category: 'summer' },
  { size: '305/25R20', price: 60, category: 'summer' },
  { size: '245/40R20', price: 60, category: 'summer' },
  { size: '255/35R20', price: 60, category: 'summer' },
  { size: '265/35R20', price: 60, category: 'summer' },
  { size: '265/30R20', price: 60, category: 'summer' },
  { size: '275/30R20', price: 60, category: 'summer' },
  { size: '275/40R20', price: 60, category: 'summer' },
  { size: '285/35R20', price: 60, category: 'summer' },
  { size: '285/30R20', price: 60, category: 'summer' },
  { size: '295/30R20', price: 60, category: 'summer' },
  { size: '315/35R20', price: 60, category: 'summer' },
  { size: '325/25R20', price: 60, category: 'summer' },

  // 21 inch tires - €60-70 with mounting and balancing
  { size: '21 inch', price: 60, category: 'summer' },

  // Commercial van tires (C) - €40-50 with mounting and balancing
  { size: '175/65R14C', price: 40, category: 'commercial' },
  { size: '195/70R15C', price: 40, category: 'commercial' },
  { size: '215/70R15C', price: 40, category: 'commercial' },
  { size: '225/70R15C', price: 40, category: 'commercial' },
  { size: '225/65R16C', price: 40, category: 'commercial' },
  { size: '235/65R16C', price: 40, category: 'commercial' },
  { size: '205/65R16C', price: 40, category: 'commercial' },
  { size: '215/65R16C', price: 40, category: 'commercial' },
  { size: '195/65R16C', price: 40, category: 'commercial' },
  { size: '225/60R16C', price: 40, category: 'commercial' },
  { size: '215/60R17C', price: 40, category: 'commercial' },
];

// Popular tire brands mentioned
const brands = ['Michelin', 'Goodyear', 'Continental', 'Bridgestone', 'Pirelli'];

async function seedArianaBanden() {
  try {
    console.log('Starting Ariana Banden Service seed...');

    // Check if categories already exist, if not create them
    const existingCategories = await db.select().from(categories);
    let insertedCategories = existingCategories;
    
    if (existingCategories.length === 0) {
      // Create categories only if they don't exist
      const categoryData = [
        { name: 'Summer Tires', slug: 'summer-tires', description: 'Zommer banden - Best for warm weather', icon: 'sun', image: '', isActive: true, sortOrder: 1 },
        { name: 'Winter Tires', slug: 'winter-tires', description: 'Winter banden - Best for cold weather', icon: 'snowflake', image: '', isActive: true, sortOrder: 2 },
        { name: 'All-Season Tires', slug: 'all-season-tires', description: '4seasons banden - Versatile tires for all conditions', icon: 'cloud', image: '', isActive: true, sortOrder: 3 },
        { name: 'Commercial Tires', slug: 'commercial-tires', description: 'C of camionette banden - Commercial van tires', icon: 'truck', image: '', isActive: true, sortOrder: 4 },
      ];
      
      insertedCategories = await db.insert(categories).values(categoryData).returning();
      console.log('Categories created:', insertedCategories.length);
    } else {
      console.log('Using existing categories:', existingCategories.length);
      // Find or create the categories we need
      const categoryMap = new Map();
      existingCategories.forEach(cat => categoryMap.set(cat.slug, cat));
      
      const requiredCategories = [
        { name: 'Summer Tires', slug: 'summer-tires', description: 'Zommer banden - Best for warm weather', icon: 'sun', image: '', isActive: true, sortOrder: 1 },
        { name: 'Winter Tires', slug: 'winter-tires', description: 'Winter banden - Best for cold weather', icon: 'snowflake', image: '', isActive: true, sortOrder: 2 },
        { name: 'All-Season Tires', slug: 'all-season-tires', description: '4seasons banden - Versatile tires for all conditions', icon: 'cloud', image: '', isActive: true, sortOrder: 3 },
        { name: 'Commercial Tires', slug: 'commercial-tires', description: 'C of camionette banden - Commercial van tires', icon: 'truck', image: '', isActive: true, sortOrder: 4 },
      ];
      
      const categoriesToCreate = requiredCategories.filter(cat => !categoryMap.has(cat.slug));
      if (categoriesToCreate.length > 0) {
        const newCategories = await db.insert(categories).values(categoriesToCreate).returning();
        insertedCategories = [...existingCategories, ...newCategories];
        console.log('Additional categories created:', newCategories.length);
      }
    }

    // Check for existing products to avoid duplicates
    const existingProducts = await db.select().from(products);
    const existingSkus = new Set(existingProducts.map(p => p.sku));
    
    // Create products for each tire size, avoiding duplicates
    const productData = tireData
      .map((tire, index) => {
        const brand = brands[Math.floor(Math.random() * brands.length)];
        const basePrice = tire.price;
        const comparePrice = Math.round(basePrice * 1.2); // 20% higher for compare price
        const sku = `ARIANA-${tire.size.replace(/[^a-zA-Z0-9]/g, '')}-${index + 1}`;
        
        // Skip if SKU already exists
        if (existingSkus.has(sku)) {
          return null;
        }
        
        return {
          name: `${brand} Tire ${tire.size}`,
          brand: brand,
          model: 'Standard',
          size: tire.size,
          price: basePrice.toString(),
          comparePrice: comparePrice.toString(),
          rating: (4.0 + Math.random() * 1.0).toFixed(1), // Random rating between 4.0-5.0
          stock: Math.floor(Math.random() * 50) + 10, // Random stock between 10-60
          status: 'published',
          featured: Math.random() > 0.8, // 20% chance of being featured
          sku: sku,
          slug: `${brand.toLowerCase()}-tire-${tire.size.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-')}-${Date.now()}-${index}`,
          description: `High quality ${tire.size} tire from ${brand}. Includes mounting and balancing service.`,
          seasonType: tire.category === 'commercial' ? 'commercial' : 'summer',
          tireType: tire.category === 'commercial' ? 'commercial' : 'passenger',
          treadDepth: '5-8mm',
          construction: 'Radial',
          tireSoundVolume: 'Low',
          features: JSON.stringify(['Mounting included', 'Balancing included', 'Quality guarantee']),
          specifications: JSON.stringify({ 
            speedRating: 'H', 
            loadIndex: '91',
            seasonType: tire.category === 'commercial' ? 'commercial' : 'summer'
          }),
          tags: JSON.stringify([tire.category, 'quality', 'service']),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null); // Remove null entries with proper typing

    if (productData.length === 0) {
      console.log('No new products to add - all SKUs already exist');
      return;
    }

    const insertedProducts = await db.insert(products).values(productData).returning();
    console.log('Products created:', insertedProducts.length);

    // Create product images
    const productImageData = insertedProducts.map((product) => ({
      productId: product.id,
      imageUrl: 'https://cdn.pixabay.com/photo/2016/01/12/12/57/tire-1135376_1280.png',
      altText: `${product.name} tire`,
      isPrimary: true,
      sortOrder: 1,
    }));

    await db.insert(productImages).values(productImageData);
    console.log('Product images created:', productImageData.length);

    // Link products to categories
    const productCategoryLinks = insertedProducts.map((product) => {
      const tire = tireData.find(t => t.size === product.size);
      const categoryIndex = tire?.category === 'commercial' ? 3 : 0; // Commercial = index 3, others = Summer (index 0)
      
      return {
        productId: product.id,
        categoryId: insertedCategories[categoryIndex].id,
      };
    });

    await db.insert(productCategories).values(productCategoryLinks);
    console.log('Product-category links created:', productCategoryLinks.length);

    // Add some products to multiple categories (summer + all-season)
    const additionalCategoryLinks = insertedProducts
      .filter((product, index) => {
        const tire = tireData[index];
        return tire && tire.category !== 'commercial' && Math.random() > 0.7; // 30% chance
      })
      .map((product) => ({
        productId: product.id,
        categoryId: insertedCategories[2].id, // All-Season category
      }));

    if (additionalCategoryLinks.length > 0) {
      await db.insert(productCategories).values(additionalCategoryLinks);
      console.log('Additional category links created:', additionalCategoryLinks.length);
    }

    console.log('✅ Ariana Banden Service seed completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`   - Categories: ${insertedCategories.length} (existing + new)`);
    console.log(`   - Products: ${insertedProducts.length} (new Ariana products added)`);
    console.log(`   - Images: ${productImageData.length} (new product images)`);
    console.log(`   - Category links: ${productCategoryLinks.length + additionalCategoryLinks.length} (new links)`);
    console.log(`   - Existing products preserved: ${existingProducts.length}`);

  } catch (error) {
    console.error('❌ Seed error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the seed function
seedArianaBanden().catch((err) => {
  console.error('❌ Failed to seed Ariana Banden Service data:', err);
  process.exit(1);
});
