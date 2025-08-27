import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/tire_store',
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000, // Increased from 2000 to 10000ms
});

// Add error handling for the pool
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
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

export const db = drizzle(pool, { schema });
export { pool };

export type DbType = typeof db
