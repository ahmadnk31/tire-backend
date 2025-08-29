import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products } from './src/db/schema';
import { isNotNull } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

async function fixConstructionValues() {
  try {
    console.log('🔍 Checking construction values in database...');

    // Get all products with their construction values
    const allProducts = await db.select({
      id: products.id,
      name: products.name,
      construction: products.construction
    }).from(products);

    console.log(`📦 Found ${allProducts.length} products`);

    // Group by construction values
    const constructionGroups = allProducts.reduce((acc, product) => {
      const construction = product.construction;
      if (construction) {
        if (!acc[construction]) {
          acc[construction] = [];
        }
        acc[construction].push(product);
      }
      return acc;
    }, {} as Record<string, any[]>);

    console.log('\n📊 Current construction values:');
    Object.keys(constructionGroups).forEach(construction => {
      console.log(`   - "${construction}": ${constructionGroups[construction].length} products`);
    });

    // Check for inconsistencies
    const constructions = Object.keys(constructionGroups);
    const hasInconsistencies = constructions.some(c => c !== 'Radial');

    if (hasInconsistencies) {
      console.log('\n⚠️  Found inconsistent construction values!');
      console.log('🔄 Fixing to standardize all to "Radial"...');

      // Update all construction values to "Radial"
      const updateResult = await db
        .update(products)
        .set({ construction: 'Radial' })
        .where(isNotNull(products.construction));

      console.log('✅ Updated all construction values to "Radial"');

      // Verify the fix
      const updatedProducts = await db.select({
        id: products.id,
        name: products.name,
        construction: products.construction
      }).from(products);

      const updatedConstructionGroups = updatedProducts.reduce((acc, product) => {
        const construction = product.construction;
        if (construction) {
          if (!acc[construction]) {
            acc[construction] = [];
          }
          acc[construction].push(product);
        }
        return acc;
      }, {} as Record<string, any[]>);

      console.log('\n📊 Updated construction values:');
      Object.keys(updatedConstructionGroups).forEach(construction => {
        console.log(`   - "${construction}": ${updatedConstructionGroups[construction].length} products`);
      });

    } else {
      console.log('\n✅ All construction values are already consistent!');
    }

    console.log('\n🎉 Construction values check completed!');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the fix function
fixConstructionValues().catch((err) => {
  console.error('❌ Failed to fix construction values:', err);
  process.exit(1);
});
