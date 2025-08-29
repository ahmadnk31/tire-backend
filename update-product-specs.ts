import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, categories, productCategories } from './src/db/schema';
import { isNotNull, eq } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

// Common speed ratings and load indexes based on tire sizes
const getSpeedRatingAndLoadIndex = (size: string) => {
  const inch = parseInt(size.match(/R(\d+)/)?.[1] || '0');
  
  // Speed ratings based on tire size
  let speedRating = 'H'; // Default
  if (inch <= 13) speedRating = 'T';
  else if (inch <= 14) speedRating = 'H';
  else if (inch <= 15) speedRating = 'H';
  else if (inch <= 16) speedRating = 'V';
  else if (inch <= 17) speedRating = 'W';
  else if (inch <= 18) speedRating = 'Y';
  else if (inch <= 19) speedRating = 'Y';
  else if (inch <= 20) speedRating = 'Y';
  else speedRating = 'Y';

  // Load indexes based on tire size
  let loadIndex = '91'; // Default
  if (inch <= 13) loadIndex = '79';
  else if (inch <= 14) loadIndex = '82';
  else if (inch <= 15) loadIndex = '88';
  else if (inch <= 16) loadIndex = '91';
  else if (inch <= 17) loadIndex = '94';
  else if (inch <= 18) loadIndex = '97';
  else if (inch <= 19) loadIndex = '100';
  else if (inch <= 20) loadIndex = '103';
  else loadIndex = '106';

  return { speedRating, loadIndex };
};

async function updateProductSpecs() {
  try {
    console.log('🔧 Starting product specifications update...');

    // First, create Second-Hand category if it doesn't exist
    const existingCategories = await db.select().from(categories);
    const secondHandCategory = existingCategories.find(cat => cat.slug === 'second-hand');
    
    let secondHandCategoryId: number;
    
    if (!secondHandCategory) {
      console.log('📦 Creating Second-Hand category...');
      const newCategory = await db.insert(categories).values({
        name: 'Second-Hand Tires',
        slug: 'second-hand',
        description: 'Used tires in good condition - Tweedehands banden',
        icon: 'recycle',
        image: '',
        isActive: true,
        sortOrder: 5
      }).returning();
      
      secondHandCategoryId = newCategory[0].id;
      console.log('✅ Second-Hand category created');
    } else {
      secondHandCategoryId = secondHandCategory.id;
      console.log('✅ Second-Hand category already exists');
    }

    // Get all products that need updating
    const allProducts = await db.select().from(products);
    console.log(`📦 Found ${allProducts.length} products to update`);

    let updatedCount = 0;
    let secondHandLinkedCount = 0;

    for (const product of allProducts) {
      const updates: any = {};
      
      // Add speed rating if missing
      if (!product.speedRating) {
        const { speedRating } = getSpeedRatingAndLoadIndex(product.size);
        updates.speedRating = speedRating;
      }
      
      // Add load index if missing
      if (!product.loadIndex) {
        const { loadIndex } = getSpeedRatingAndLoadIndex(product.size);
        updates.loadIndex = loadIndex;
      }

      // Update specifications JSON if needed
      let specifications: any = {};
      if (product.specifications) {
        if (typeof product.specifications === 'string') {
          specifications = JSON.parse(product.specifications);
        } else {
          specifications = product.specifications;
        }
      }
      let needsSpecUpdate = false;

      if (!specifications.speedRating && !product.speedRating) {
        const { speedRating } = getSpeedRatingAndLoadIndex(product.size);
        specifications.speedRating = speedRating;
        needsSpecUpdate = true;
      }

      if (!specifications.loadIndex && !product.loadIndex) {
        const { loadIndex } = getSpeedRatingAndLoadIndex(product.size);
        specifications.loadIndex = loadIndex;
        needsSpecUpdate = true;
      }

      if (needsSpecUpdate) {
        updates.specifications = JSON.stringify(specifications);
      }

      // Update product if there are changes
      if (Object.keys(updates).length > 0) {
        await db.update(products)
          .set(updates)
          .where(eq(products.id, product.id));
        updatedCount++;
      }

      // Link all products to Second-Hand category (since Ariana sells second-hand tires)
      const existingLink = await db.select()
        .from(productCategories)
        .where(
          eq(productCategories.productId, product.id) &&
          eq(productCategories.categoryId, secondHandCategoryId)
        );

      if (existingLink.length === 0) {
        await db.insert(productCategories).values({
          productId: product.id,
          categoryId: secondHandCategoryId
        });
        secondHandLinkedCount++;
      }
    }

    console.log(`✅ Updated ${updatedCount} products with speed ratings and load indexes`);
    console.log(`✅ Linked ${secondHandLinkedCount} products to Second-Hand category`);

    // Show sample updated products
    const sampleProducts = await db.select({
      id: products.id,
      name: products.name,
      size: products.size,
      speedRating: products.speedRating,
      loadIndex: products.loadIndex
    }).from(products).limit(5);

    console.log('\n📋 Sample updated products:');
    sampleProducts.forEach(product => {
      console.log(`   - ${product.name} (${product.size}) - Speed: ${product.speedRating}, Load: ${product.loadIndex}`);
    });

    // Show category summary
    const categorySummary = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug
    }).from(categories);

    console.log('\n📊 Category summary:');
    for (const cat of categorySummary) {
      const productCount = await db.select()
        .from(productCategories)
        .where(eq(productCategories.categoryId, cat.id));
      console.log(`   - ${cat.name} (${cat.slug}): ${productCount.length} products`);
    }

    console.log('\n🎉 Product specifications update completed successfully!');

  } catch (error) {
    console.error('❌ Update error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update function
updateProductSpecs().catch((err) => {
  console.error('❌ Failed to update product specifications:', err);
  process.exit(1);
});
