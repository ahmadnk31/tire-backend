-- Add payment_intent_id column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id VARCHAR(255);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent_id ON orders(payment_intent_id);
