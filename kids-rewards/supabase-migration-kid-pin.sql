-- Add PIN column to kids table for redemption verification
-- NULL means no PIN set yet (redemption blocked until parent sets one)
ALTER TABLE kids ADD COLUMN pin TEXT;
