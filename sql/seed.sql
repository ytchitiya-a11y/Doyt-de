-- =========================================
-- SEED DATA - Sample products for testing
-- Run after schema.sql: psql -d instant_delivery -f sql/seed.sql
-- =========================================

INSERT INTO products (name, category, price, image_url, is_available, stock) VALUES
('Chola Bhatura', 'food', 60.00, '', true, 50),
('Phulki Chaat', 'food', 40.00, '', true, 50),
('Aloo Tikki Chaat', 'food', 35.00, '', true, 50),
('Samosa (2 pcs)', 'food', 20.00, '', true, 100),
('Kachori Sabzi', 'food', 45.00, '', true, 50),
('Litti Chokha', 'food', 70.00, '', true, 30),
('Golgappe (Pani Puri)', 'food', 30.00, '', true, 60),
('Masala Chai', 'food', 15.00, '', true, 100),
('Lassi', 'food', 40.00, '', true, 40),
('Milk (500ml)', 'grocery', 30.00, '', true, 100),
('Bread', 'grocery', 35.00, '', true, 80),
('Eggs (6 pcs)', 'grocery', 45.00, '', true, 60),
('Cold Drink (750ml)', 'grocery', 40.00, '', true, 100),
('Water Bottle (1L)', 'grocery', 20.00, '', true, 100),
('Biscuits Pack', 'grocery', 25.00, '', true, 100);
