const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
const { productImages } = require('./dist/db/schema.js');

async function addTestImages() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const db = drizzle(client);

  // Add some test images for existing products
  const testImages = [
    {
      productId: 48,
      imageUrl: 'https://via.placeholder.com/400x400/0066cc/ffffff?text=Michelin+Pilot+Sport+4',
      altText: 'Michelin Pilot Sport 4 - Front View',
      isPrimary: true,
      sortOrder: 1
    },
    {
      productId: 49,
      imageUrl: 'https://via.placeholder.com/400x400/cc6600/ffffff?text=Michelin+Primacy+4',
      altText: 'Michelin Primacy 4 - Front View',
      isPrimary: true,
      sortOrder: 1
    },
    {
      productId: 50,
      imageUrl: 'https://via.placeholder.com/400x400/0066cc/ffffff?text=Bridgestone+Blizzak',
      altText: 'Bridgestone Blizzak WS90 - Front View',
      isPrimary: true,
      sortOrder: 1
    }
  ];

  try {
    const result = await db.insert(productImages).values(testImages).returning();
    console.log(`Added ${result.length} test images`);
    result.forEach(img => console.log(`- Product ${img.productId}: ${img.imageUrl}`));
  } catch (error) {
    console.error('Error adding images:', error);
  }

  await client.end();
}

addTestImages().catch(console.error);
