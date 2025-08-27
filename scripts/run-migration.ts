import { db } from '../src/db';
import { readFileSync } from 'fs';
import { join } from 'path';
import { sql } from 'drizzle-orm';
import { pool } from '../src/db';

async function runMigration() {
  try {
    console.log('🔄 Running migration: Add slug and tire_sound_volume to products table...');
    
    // Read the migration SQL file
    const migrationPath = join(__dirname, '..', 'migrations', 'add_slug_and_tire_sound_volume.sql');
    const migrationSQL = readFileSync(migrationPath, 'utf8');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    // Execute each statement
    for (const statement of statements) {
      if (statement.trim()) {
        console.log(`📝 Executing: ${statement.substring(0, 50)}...`);
        await db.execute(sql.raw(statement));
      }
    }
    
    console.log('✅ Migration completed successfully!');
    console.log('📊 New fields added:');
    console.log('   - slug (VARCHAR(255), UNIQUE)');
    console.log('   - tire_sound_volume (VARCHAR(50))');
    console.log('   - Index created on slug for better performance');
    console.log('   - Existing products updated with auto-generated slugs');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
