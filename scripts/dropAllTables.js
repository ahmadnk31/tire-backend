// Script to drop all tables in the database using Drizzle ORM and Node.js
const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
require('dotenv').config();

const tables = [
  'wishlist',
  'product_categories',
  'categories',
  'cart_items',
  'order_items',
  'orders',
  'user_addresses',
  'product_images',
  'products',
  'banners',
  'users'
];

async function dropAllTables() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  await client.connect();
  for (const table of tables) {
    try {
      await client.query(`DROP TABLE IF EXISTS ${table} CASCADE;`);
      console.log(`Dropped table: ${table}`);
    } catch (err) {
      console.error(`Error dropping table ${table}:`, err.message);
    }
  }
  await client.end();
  console.log('All tables dropped.');
}

dropAllTables();
