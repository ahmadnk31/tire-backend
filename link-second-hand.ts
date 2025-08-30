import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, categories, productCategories } from './src/db/schema';
import { eq } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

async function linkAllToSecondHand() {
  try {
    console.log('🔄 Linking all products to Second-Hand category...');

    // Get the Second-Hand category
    const secondHandCategory = await db.select()
      .from(categories)
      .where(eq(categories.slug, 'second-hand'))
      .limit(1);

    if (secondHandCategory.length === 0) {
      console.log('❌ Second-Hand category not found. Run update:specs first.');
      return;
    }

    const secondHandCategoryId = secondHandCategory[0].id;
    console.log(`✅ Found Second-Hand category (ID: ${secondHandCategoryId})`);

    // Get all products
    const allProducts = await db.select().from(products);
    console.log(`📦 Found ${allProducts.length} products`);

    let linkedCount = 0;

    for (const product of allProducts) {
      // Check if product is already linked to Second-Hand category
      const existingLink = await db.select()
        .from(productCategories)
        .where(
          eq(productCategories.productId, product.id) &&
          eq(productCategories.categoryId, secondHandCategoryId)
        );

      if (existingLink.length === 0) {
        // Link product to Second-Hand category
        await db.insert(productCategories).values({
          productId: product.id,
          categoryId: secondHandCategoryId
        });
        linkedCount++;
      }
    }

    console.log(`✅ Linked ${linkedCount} products to Second-Hand category`);

    // Show updated category summary
    const categorySummary = await db.select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug
    }).from(categories);

    console.log('\n📊 Updated category summary:');
    for (const cat of categorySummary) {
      const productCount = await db.select()
        .from(productCategories)
        .where(eq(productCategories.categoryId, cat.id));
      console.log(`   - ${cat.name} (${cat.slug}): ${productCount.length} products`);
    }

    console.log('\n🎉 All products linked to Second-Hand category successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
linkAllToSecondHand().catch((err) => {
  console.error('❌ Failed to link products to Second-Hand category:', err);
  process.exit(1);
});
