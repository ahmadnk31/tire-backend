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

async function forceLinkSecondHand() {
  try {
    console.log('🔄 Force linking all products to Second-Hand category...');

    // Get the Second-Hand category
    const secondHandCategory = await db.select()
      .from(categories)
      .where(eq(categories.slug, 'second-hand'))
      .limit(1);

    if (secondHandCategory.length === 0) {
      console.log('❌ Second-Hand category not found.');
      return;
    }

    const secondHandCategoryId = secondHandCategory[0].id;
    console.log(`✅ Found Second-Hand category (ID: ${secondHandCategoryId})`);

    // Get all products
    const allProducts = await db.select().from(products);
    console.log(`📦 Found ${allProducts.length} products`);

    // Remove all existing Second-Hand category links
    console.log('🗑️  Removing existing Second-Hand category links...');
    await db.delete(productCategories)
      .where(eq(productCategories.categoryId, secondHandCategoryId));
    
    console.log('✅ Removed existing Second-Hand category links');

    // Add all products to Second-Hand category
    console.log('➕ Adding all products to Second-Hand category...');
    
    const linksToInsert = allProducts.map(product => ({
      productId: product.id,
      categoryId: secondHandCategoryId
    }));

    await db.insert(productCategories).values(linksToInsert);
    
    console.log(`✅ Added ${allProducts.length} products to Second-Hand category`);

    // Verify the results
    const finalAssignments = await db.select()
      .from(productCategories)
      .where(eq(productCategories.categoryId, secondHandCategoryId));
    
    console.log(`\n📊 Final Second-Hand category assignments: ${finalAssignments.length} products`);

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

    console.log('\n🎉 All products successfully linked to Second-Hand category!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
forceLinkSecondHand().catch((err) => {
  console.error('❌ Failed to force link products to Second-Hand category:', err);
  process.exit(1);
});
