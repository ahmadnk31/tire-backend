-- Migration: Add slug and tire_sound_volume to products table
-- Date: 2025-08-27

-- Add slug column
ALTER TABLE products ADD COLUMN slug VARCHAR(255) UNIQUE;

-- Add tire_sound_volume column
ALTER TABLE products ADD COLUMN tire_sound_volume VARCHAR(50);

-- Create index on slug for better performance
CREATE INDEX idx_products_slug ON products(slug);

-- Update existing products to have a slug based on name and brand
UPDATE products 
SET slug = LOWER(
  REGEXP_REPLACE(
    CONCAT(brand, '-', name, '-', size), 
    '[^a-zA-Z0-9-]', 
    '-', 
    'g'
  )
)
WHERE slug IS NULL;

-- Add comment to explain the tire_sound_volume field
COMMENT ON COLUMN products.tire_sound_volume IS 'Tire noise level: Low, Medium, High, or specific decibel rating';
