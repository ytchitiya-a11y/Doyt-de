-- =========================================
-- MIGRATION: Add Razorpay payment tracking columns
-- Run this ONLY if your database already existed before Razorpay was added.
-- (If you're setting up fresh, schema.sql already includes these columns.)
-- psql -d instant_delivery -f sql/migration_razorpay.sql
-- =========================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_order_id VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS razorpay_payment_id VARCHAR(100);
