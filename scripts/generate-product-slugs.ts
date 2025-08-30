import { db } from '../src/db';
import { products } from '../src/db/schema';
import { generateProductSlug } from '../src/utils/slugGenerator';
import { eq, isNull } from 'drizzle-orm';

async function generateMissingSlugs() {
  try {
    console.log('🔄 Generating slugs for products without slugs...');
    
    // Get all products without slugs
    const productsWithoutSlugs = await db
      .select()
      .from(products)
      .where(isNull(products.slug));
    
    console.log(`📝 Found ${productsWithoutSlugs.length} products without slugs`);
    
    if (productsWithoutSlugs.length === 0) {
      console.log('✅ All products already have slugs!');
      return;
    }
    
    // Get all existing slugs to avoid conflicts
    const allProducts = await db.select({ slug: products.slug }).from(products);
    const existingSlugs = allProducts
      .map(p => p.slug)
      .filter((slug): slug is string => slug !== null);
    
    console.log(`📝 Found ${existingSlugs.length} existing slugs`);
    
    // Generate slugs for products without them
    for (const product of productsWithoutSlugs) {
      const newSlug = generateProductSlug(
        product.brand,
        product.name,
        product.size,
        existingSlugs
      );
      
      // Update the product with the new slug
      await db
        .update(products)
        .set({ slug: newSlug })
        .where(eq(products.id, product.id));
      
      // Add the new slug to existing slugs to avoid conflicts in next iterations
      existingSlugs.push(newSlug);
      
      console.log(`✅ Generated slug "${newSlug}" for product "${product.name}" (ID: ${product.id})`);
    }
    
    console.log('✅ Successfully generated slugs for all products!');
    
  } catch (error) {
    console.error('❌ Error generating slugs:', error);
    process.exit(1);
  }
}

generateMissingSlugs();
