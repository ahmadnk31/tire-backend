import { db } from '../src/db';
import { sql } from 'drizzle-orm';

async function runSimpleMigration() {
  try {
    console.log('🔄 Running simple migration: Add slug and tire_sound_volume to products table...');
    
    // Add slug column
    console.log('📝 Adding slug column...');
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS slug VARCHAR(255) UNIQUE`);
    
    // Add tire_sound_volume column
    console.log('📝 Adding tire_sound_volume column...');
    await db.execute(sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS tire_sound_volume VARCHAR(50)`);
    
    // Create index on slug
    console.log('📝 Creating index on slug...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug)`);
    
    // Update existing products to have a slug based on name and brand
    console.log('📝 Updating existing products with slugs...');
    await db.execute(sql`
      UPDATE products 
      SET slug = LOWER(
        REGEXP_REPLACE(
          CONCAT(brand, '-', name, '-', size), 
          '[^a-zA-Z0-9-]', 
          '-', 
          'g'
        )
      )
      WHERE slug IS NULL
    `);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 New fields added:');
    console.log('   - slug (VARCHAR(255), UNIQUE)');
    console.log('   - tire_sound_volume (VARCHAR(50))');
    console.log('   - Index created on slug for better performance');
    console.log('   - Existing products updated with auto-generated slugs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runSimpleMigration();
