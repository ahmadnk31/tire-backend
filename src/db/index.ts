import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/tire_store',
  max: 10, // Reduced from 20 to prevent too many connections
  min: 1, // Reduced from 2
  idleTimeoutMillis: 60000, // Increased to 60 seconds
  connectionTimeoutMillis: 10000,
  // Add keep-alive settings for Neon
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  // Add statement timeout
  statement_timeout: 30000,
  // Add query timeout
  query_timeout: 30000,
});

// Add error handling for the pool - don't exit process on connection errors
pool.on('error', (err) => {
  console.error('Database pool error:', err.message);
  // Don't exit the process, just log the error
  // process.exit(-1); // Removed this line
});

// Add connection event logging
pool.on('connect', () => {
  console.log('New database connection established');
});

pool.on('acquire', () => {
  console.log('Database connection acquired from pool');
});

pool.on('release', () => {
  console.log('Database connection released back to pool');
});

// Add periodic connection health check
setInterval(async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
  } catch (error) {
    console.error('Database health check failed:', error);
  }
}, 30000); // Check every 30 seconds

export const db = drizzle(pool, { schema });
export { pool };

export type DbType = typeof db
