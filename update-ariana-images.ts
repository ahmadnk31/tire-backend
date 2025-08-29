import dotenv from 'dotenv';
dotenv.config();
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { products, productImages } from './src/db/schema';
import { like, inArray } from 'drizzle-orm';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/tire',
});
const db = drizzle(pool);

async function updateArianaImages() {
  try {
    console.log('🔄 Starting Ariana Banden Service image update...');

    // Find all Ariana products (they have SKUs starting with ARIANA-)
    const arianaProducts = await db.select().from(products).where(
      like(products.sku, 'ARIANA-%')
    );

    console.log(`📦 Found ${arianaProducts.length} Ariana products to update`);

    if (arianaProducts.length === 0) {
      console.log('❌ No Ariana products found. Make sure to run the seeding script first.');
      return;
    }

    const productIds = arianaProducts.map(p => p.id);
    const newImageUrl = 'https://cdn.pixabay.com/photo/2016/01/12/12/57/tire-1135376_1280.png';

    // Update existing product images for Ariana products
    const updateResult = await db
      .update(productImages)
      .set({
        imageUrl: newImageUrl
      })
      .where(inArray(productImages.productId, productIds));

    console.log(`✅ Updated images for ${arianaProducts.length} Ariana products`);
    console.log(`🖼️  New image URL: ${newImageUrl}`);

    // Show some sample updated products
    console.log('\n📋 Sample updated products:');
    arianaProducts.slice(0, 5).forEach(product => {
      console.log(`   - ${product.name} (${product.size}) - €${product.price}`);
    });

    if (arianaProducts.length > 5) {
      console.log(`   ... and ${arianaProducts.length - 5} more products`);
    }

    console.log('\n🎉 Ariana Banden Service image update completed successfully!');

  } catch (error) {
    console.error('❌ Update error:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the update function
updateArianaImages().catch((err) => {
  console.error('❌ Failed to update Ariana Banden Service images:', err);
  process.exit(1);
});
