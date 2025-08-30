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

async function checkCategories() {
  try {
    console.log('🔍 Checking current category assignments...');

    // Get all categories
    const allCategories = await db.select().from(categories);
    console.log(`📦 Found ${allCategories.length} categories:`);
    
    allCategories.forEach(cat => {
      console.log(`   - ${cat.name} (${cat.slug}) - ID: ${cat.id}`);
    });

    // Get all products
    const allProducts = await db.select().from(products);
    console.log(`\n📦 Found ${allProducts.length} products`);

    // Check category assignments for each category
    console.log('\n📊 Category assignments:');
    for (const category of allCategories) {
      const assignments = await db.select()
        .from(productCategories)
        .where(eq(productCategories.categoryId, category.id));
      
      console.log(`   - ${category.name}: ${assignments.length} products`);
    }

    // Check Second-Hand category specifically
    const secondHandCategory = allCategories.find(cat => cat.slug === 'second-hand');
    if (secondHandCategory) {
      console.log(`\n🔍 Second-Hand category details:`);
      console.log(`   - ID: ${secondHandCategory.id}`);
      console.log(`   - Name: ${secondHandCategory.name}`);
      console.log(`   - Slug: ${secondHandCategory.slug}`);
      
      const secondHandAssignments = await db.select()
        .from(productCategories)
        .where(eq(productCategories.categoryId, secondHandCategory.id));
      
      console.log(`   - Current assignments: ${secondHandAssignments.length} products`);
      
      if (secondHandAssignments.length < allProducts.length) {
        console.log(`\n⚠️  Not all products are linked to Second-Hand category!`);
        console.log(`   - Products: ${allProducts.length}`);
        console.log(`   - Linked: ${secondHandAssignments.length}`);
        console.log(`   - Missing: ${allProducts.length - secondHandAssignments.length}`);
        
        // Link missing products
        console.log(`\n🔄 Linking missing products to Second-Hand category...`);
        let linkedCount = 0;
        
        for (const product of allProducts) {
          const existingLink = await db.select()
            .from(productCategories)
            .where(
              eq(productCategories.productId, product.id) &&
              eq(productCategories.categoryId, secondHandCategory.id)
            );

          if (existingLink.length === 0) {
            await db.insert(productCategories).values({
              productId: product.id,
              categoryId: secondHandCategory.id
            });
            linkedCount++;
          }
        }
        
        console.log(`✅ Linked ${linkedCount} additional products to Second-Hand category`);
      } else {
        console.log(`✅ All products are already linked to Second-Hand category!`);
      }
    }

    console.log('\n🎉 Category check completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the function
checkCategories().catch((err) => {
  console.error('❌ Failed to check categories:', err);
  process.exit(1);
});
