import { db, pool } from '../src/db';
import { sql } from 'drizzle-orm';

async function runPaymentIntentIdMigration() {
  try {
    console.log('🔄 Running migration: Add payment_intent_id to orders table...');
    
    // Add payment_intent_id column
    console.log('📝 Adding payment_intent_id column...');
    await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255)`);
    
    // Create index for better query performance
    console.log('📝 Creating index on payment_intent_id...');
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id)`);
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 New fields added:');
    console.log('   - payment_intent_id (VARCHAR(255))');
    console.log('   - Index created on payment_intent_id for better performance');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runPaymentIntentIdMigration();

