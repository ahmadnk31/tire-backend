require('dotenv').config();
const { Client } = require('pg');

async function addTestImages() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();

  // Add some test images for existing products
  const queries = [
    `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
     VALUES (48, 'https://via.placeholder.com/400x400/0066cc/ffffff?text=Michelin+Pilot+Sport+4', 'Michelin Pilot Sport 4 - Front View', true, 1)`,
    `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
     VALUES (49, 'https://via.placeholder.com/400x400/cc6600/ffffff?text=Michelin+Primacy+4', 'Michelin Primacy 4 - Front View', true, 1)`,
    `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
     VALUES (50, 'https://via.placeholder.com/400x400/006600/ffffff?text=Bridgestone+Blizzak', 'Bridgestone Blizzak WS90 - Front View', true, 1)`,
    `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
     VALUES (51, 'https://via.placeholder.com/400x400/cc0066/ffffff?text=Bridgestone+Turanza', 'Bridgestone Turanza T005 - Front View', true, 1)`,
    `INSERT INTO product_images (product_id, image_url, alt_text, is_primary, sort_order) 
     VALUES (52, 'https://via.placeholder.com/400x400/666600/ffffff?text=Goodyear+Assurance', 'Goodyear Assurance WeatherReady - Front View', true, 1)`
  ];

  try {
    for (const query of queries) {
      await client.query(query);
    }
    console.log('Added test images for products 48-52');
  } catch (error) {
    console.error('Error adding images:', error);
  }

  await client.end();
}

addTestImages().catch(console.error);
