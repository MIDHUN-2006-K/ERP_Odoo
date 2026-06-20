-- Add reorder_qty column to products table
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "reorder_qty" DECIMAL(14,3) DEFAULT 0;
